import Groq from 'groq-sdk'
import type { ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/resources/chat/completions'
import { toolDefinitions, executeTool } from './tools'
import { Signal, Thread, EvidenceItem } from './types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `You are a security intelligence agent investigating overnight signals at an industrial site before the operator arrives each morning.

For each cluster of signals, reason about what happened. Use tools to check context before concluding. Your job is to investigate, not just summarize.

Rules:
- You MUST call at least one context tool (get_weather, get_shift_roster, get_access_records, get_zone_history, or check_drone_coverage) before calling submit_findings on any multi-signal cluster.
- You MUST populate the unknowns array with at least one item. For noise threads, list what visual confirmation would have made you more certain. For escalate threads, list what the drone did NOT observe.
- Fence alerts near the east perimeter (gate-3) REQUIRE a weather check — east wind explains false positives.
- Badge failures REQUIRE a roster check AND access records check.
- Unexplained vehicle movements REQUIRE roster + access records.
- Yard-a motion at 02:30+ may be cleaning crew — check the roster.
- Be willing to be wrong. State theories, not conclusions. Uncertainty is accuracy.
- When you have gathered sufficient evidence, call submit_findings.`

const submitFindingsTool: Groq.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'submit_findings',
    description: 'Submit your final structured finding for this cluster. Call this when you have gathered sufficient evidence.',
    parameters: {
      type: 'object',
      properties: {
        hypothesis: { type: 'string', description: 'One sentence theory about what happened' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        severity: { type: 'string', enum: ['noise', 'watch', 'escalate'] },
        recommendation: { type: 'string', description: 'Dismiss, Dispatch drone to X, or Escalate to Nisha' },
        unknowns: { type: 'array', items: { type: 'string' }, description: 'MANDATORY: what could not be verified, min 1 item' },
        reasoning: { type: 'string', description: 'Brief explanation of which tools drove the conclusion' }
      },
      required: ['hypothesis', 'confidence', 'severity', 'recommendation', 'unknowns', 'reasoning']
    }
  }
}

function isDailyLimitError(err: unknown): boolean {
  return String(err).includes('tokens per day') || String(err).includes('TPD')
}

async function callGroq(
  params: ChatCompletionCreateParamsNonStreaming
): Promise<Groq.Chat.ChatCompletion> {
  const MAX_RETRIES = 3
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await groq.chat.completions.create(params)
    } catch (err) {
      lastErr = err
      // Daily quota exhausted — retrying won't help, fail immediately
      if (isDailyLimitError(err)) throw err
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }
  }
  throw lastErr
}

function fallbackThread(signals: Signal[], reason: string): Thread {
  return {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    signalIds: signals.map(s => s.id),
    hypothesis: 'Investigation could not complete — API error.',
    confidence: 'low',
    severity: 'watch',
    evidence: [],
    unknowns: [`API error prevented investigation: ${reason}`],
    recommendation: 'Manual review required.',
    status: 'ai_draft',
    dispatchedMissions: []
  }
}

export async function investigateCluster(
  signals: Signal[],
  onToolCall?: (entry: string) => void
): Promise<Thread> {
  try {
    return await runInvestigation(signals, onToolCall)
  } catch (err) {
    return fallbackThread(signals, String(err))
  }
}

async function runInvestigation(
  signals: Signal[],
  onToolCall?: (entry: string) => void
): Promise<Thread> {
  const signalSummary = signals.map(s =>
    `- ${s.id} [${s.type}] at ${s.zone} (${s.ts}): ${JSON.stringify(s.payload)}`
  ).join('\n')

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Investigate this cluster of ${signals.length} signal(s):\n\n${signalSummary}\n\nUse the available tools to gather context, then call submit_findings with your conclusion.`
    }
  ]

  const evidence: EvidenceItem[] = []
  const allTools = [...toolDefinitions, submitFindingsTool]
  let finding: {
    hypothesis: string
    confidence: 'low' | 'medium' | 'high'
    severity: 'noise' | 'watch' | 'escalate'
    recommendation: string
    unknowns: string[]
    reasoning: string
  } | null = null

  for (let turn = 0; turn < 8; turn++) {
    const response = await callGroq({
      model: 'llama-3.3-70b-versatile',
      messages,
      tools: allTools,
      tool_choice: 'auto',
      temperature: 0
    })

    const message = response.choices[0].message
    messages.push(message)

    if (!message.tool_calls || message.tool_calls.length === 0) break

    const toolResultMessages: Groq.Chat.ChatCompletionMessageParam[] = []

    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments)

      if (toolCall.function.name === 'submit_findings') {
        finding = args
        toolResultMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: 'Findings submitted successfully.'
        })
        break
      }

      onToolCall?.(`  → calling ${toolCall.function.name}(${JSON.stringify(args)})`)

      let result: unknown
      try {
        result = await executeTool(toolCall.function.name, args)
      } catch (err) {
        result = { error: String(err) }
      }

      evidence.push({ tool: toolCall.function.name, input: args, result })

      toolResultMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      })
    }

    messages.push(...toolResultMessages)
    if (finding) break
  }

  finding ??= {
    hypothesis: 'Unable to reach a conclusion — investigation loop exhausted.',
    confidence: 'low',
    severity: 'watch',
    recommendation: 'Manual review required.',
    unknowns: ['Investigation loop exhausted without conclusion — manual review needed'],
    reasoning: 'Max turns reached without submit_findings call'
  }

  return {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    signalIds: signals.map(s => s.id),
    hypothesis: finding.hypothesis,
    confidence: finding.confidence,
    severity: finding.severity,
    evidence,
    unknowns: finding.unknowns.length > 0 ? finding.unknowns : ['No explicit unknowns stated'],
    recommendation: finding.recommendation,
    status: 'ai_draft',
    dispatchedMissions: []
  }
}
