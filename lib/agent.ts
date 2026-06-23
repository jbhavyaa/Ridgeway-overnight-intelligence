import Anthropic from '@anthropic-ai/sdk'
import { toolDefinitions, executeTool } from './tools'
import { Signal, Thread, EvidenceItem } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

const submitFindingsTool: Anthropic.Tool = {
  name: 'submit_findings',
  description: 'Submit your final structured finding for this cluster. Call this when you have gathered sufficient evidence.',
  input_schema: {
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

function isOverloaded(err: unknown): boolean {
  const msg = String(err)
  return msg.includes('overloaded_error') || msg.includes('529')
}

async function callClaude(
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[]
): Promise<Anthropic.Message> {
  const MAX_RETRIES = 5
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
        tools,
        tool_choice: { type: 'auto' },
      })
    } catch (err) {
      lastErr = err
      if (attempt < MAX_RETRIES - 1) {
        const delay = isOverloaded(err) ? 4000 * (attempt + 1) : 1000 * Math.pow(2, attempt)
        await new Promise(r => setTimeout(r, delay))
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

  const messages: Anthropic.MessageParam[] = [
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

  for (let turn = 0; turn < 5; turn++) {
    const response = await callClaude(messages, allTools)

    // Push the assistant message
    messages.push({ role: 'assistant', content: response.content })

    // Extract tool use blocks
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    if (toolUseBlocks.length === 0) break

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolBlock of toolUseBlocks) {
      const { id, name, input } = toolBlock
      const args = input as Record<string, unknown>

      if (name === 'submit_findings') {
        finding = args as unknown as typeof finding
        toolResults.push({
          type: 'tool_result',
          tool_use_id: id,
          content: 'Findings submitted successfully.'
        })
        break
      }

      onToolCall?.(`  → calling ${name}(${JSON.stringify(args)})`)

      let result: unknown
      try {
        result = await executeTool(name, args)
      } catch (err) {
        result = { error: String(err) }
      }

      evidence.push({ tool: name, input: args, result })

      toolResults.push({
        type: 'tool_result',
        tool_use_id: id,
        content: JSON.stringify(result)
      })
    }

    messages.push({ role: 'user', content: toolResults })
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
