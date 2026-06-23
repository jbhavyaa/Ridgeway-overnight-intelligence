import Anthropic from '@anthropic-ai/sdk'
import { toolDefinitions, executeTool } from './tools'
import { Signal, Thread, EvidenceItem } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a security intelligence agent investigating overnight signals at an industrial site before the morning operator arrives.

Investigate each cluster by reasoning step-by-step in plain English, then calling tools to verify. Think out loud — explain WHY you are calling each tool before calling it, and what the result means for your theory.

HARD RULES (non-negotiable):
- Fence alerts at gate-3 (east perimeter): MUST call get_weather first. East wind above 40 kph is the definitive noise explanation.
- Badge failures anywhere: MUST call get_shift_roster AND get_access_records. Check if the badge holder was legitimately on site.
- Unexplained vehicle movements: MUST call get_shift_roster AND get_access_records. No scheduled vehicle = anomaly.
- Motion in yard-a between 02:00–04:00: MUST call get_shift_roster. SiteClean crew is routinely authorized there.
- Always call get_zone_history to establish whether activity is normal for that zone.
- NEVER skip tools. NEVER submit_findings without consulting at least one context tool per cluster.

SEVERITY CRITERIA (apply consistently):
- noise: Activity is fully explained by weather, roster, or known baseline. Nothing anomalous.
- watch: Activity is partially explained but has unverified elements worth monitoring. No immediate threat.
- escalate: Activity cannot be explained and represents a potential security breach. Immediate action required.

UNKNOWNS: Always list at least one thing you could not verify — even for noise findings.`

const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_weather: 'Checking weather conditions',
  get_shift_roster: 'Checking shift roster',
  get_access_records: 'Pulling access records',
  get_zone_history: 'Looking up zone baseline',
  check_drone_coverage: 'Reviewing drone coverage',
  dispatch_drone_mission: 'Dispatching drone',
}

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

type Finding = {
  hypothesis: string
  confidence: 'low' | 'medium' | 'high'
  severity: 'noise' | 'watch' | 'escalate'
  recommendation: string
  unknowns: string[]
  reasoning: string
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
        temperature: 0,
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

function emitReasoning(text: string, onLog: (msg: string) => void) {
  const paragraphs = text.trim().split(/\n\n+/)
  for (const para of paragraphs) {
    const clean = para.trim().replaceAll('\n', ' ')
    if (clean) onLog(`◈ ${clean}`)
  }
}

function toolContext(args: Record<string, unknown>): string {
  const val = args.zone ?? args.accessPoint ?? args.date ?? args.windowStart
  if (val == null) return ''
  return typeof val === 'string' ? val : JSON.stringify(val)
}

function verdictLine(finding: Finding): string {
  if (finding.severity === 'escalate') return `🚨 VERDICT: ESCALATE — ${finding.hypothesis}`
  if (finding.severity === 'watch') return `⚠️ VERDICT: WATCH — ${finding.hypothesis}`
  return `✓ VERDICT: NOISE — ${finding.hypothesis}`
}

async function executeToolBlock(
  toolBlock: Anthropic.ToolUseBlock,
  evidence: EvidenceItem[],
  onLog: (msg: string) => void
): Promise<Anthropic.ToolResultBlockParam> {
  const { id, name, input } = toolBlock
  const args = input as Record<string, unknown>
  const label = TOOL_DESCRIPTIONS[name] ?? name
  const ctx = toolContext(args)
  const suffix = ctx ? ` — ${ctx}` : ''
  onLog(`→ ${label}${suffix}`)

  let result: unknown
  try {
    result = await executeTool(name, args)
  } catch (err) {
    result = { error: String(err) }
  }

  evidence.push({ tool: name, input: args, result })
  return { type: 'tool_result', tool_use_id: id, content: JSON.stringify(result) }
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
  onLog?: (entry: string) => void
): Promise<Thread> {
  try {
    return await runInvestigation(signals, onLog ?? (() => undefined))
  } catch (err) {
    return fallbackThread(signals, String(err))
  }
}

type TurnResult = { finding: Finding; done: true } | { done: false }

async function processTurn(
  messages: Anthropic.MessageParam[],
  allTools: Anthropic.Tool[],
  evidence: EvidenceItem[],
  onLog: (entry: string) => void
): Promise<TurnResult> {
  const response = await callClaude(messages, allTools)
  messages.push({ role: 'assistant', content: response.content })

  for (const block of response.content) {
    if (block.type === 'text' && block.text.trim()) emitReasoning(block.text, onLog)
  }

  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
  )
  if (toolUseBlocks.length === 0) return { done: false }

  const toolResults: Anthropic.ToolResultBlockParam[] = []

  for (const toolBlock of toolUseBlocks) {
    if (toolBlock.name === 'submit_findings') {
      toolResults.push({ type: 'tool_result', tool_use_id: toolBlock.id, content: 'Findings submitted successfully.' })
      messages.push({ role: 'user', content: toolResults })
      return { finding: toolBlock.input as Finding, done: true }
    }
    toolResults.push(await executeToolBlock(toolBlock, evidence, onLog))
  }

  messages.push({ role: 'user', content: toolResults })
  return { done: false }
}

async function runInvestigation(
  signals: Signal[],
  onLog: (entry: string) => void
): Promise<Thread> {
  const signalSummary = signals.map(s =>
    `- ${s.id} [${s.type}] at ${s.zone} (${s.ts}): ${JSON.stringify(s.payload)}`
  ).join('\n')

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Investigate this cluster of ${signals.length} signal(s):\n\n${signalSummary}\n\nThink through what might have happened, then use tools to verify. When you have enough evidence, call submit_findings.`
    }
  ]

  const evidence: EvidenceItem[] = []
  const allTools = [...toolDefinitions, submitFindingsTool]
  let finding: Finding | null = null

  for (let turn = 0; turn < 5; turn++) {
    const result = await processTurn(messages, allTools, evidence, onLog)
    if (result.done) { finding = result.finding; break }
  }

  finding ??= {
    hypothesis: 'Unable to reach a conclusion — investigation loop exhausted.',
    confidence: 'low',
    severity: 'watch',
    recommendation: 'Manual review required.',
    unknowns: ['Investigation loop exhausted without conclusion — manual review needed'],
    reasoning: 'Max turns reached without submit_findings call'
  }

  onLog(verdictLine(finding))

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
