import { NextRequest } from 'next/server'
import { Thread } from '@/lib/types'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { threads } = await req.json() as { threads: Thread[] }

  if (!threads || threads.length === 0) {
    return Response.json({ error: 'No approved threads found' }, { status: 400 })
  }

  const findingsSummary = threads.map((t: Thread) => {
    const effectiveSeverity = t.overriddenSeverity || t.severity
    const droneLines = t.dispatchedMissions && t.dispatchedMissions.length > 0
      ? 'Drone dispatched: ' + t.dispatchedMissions.map(m => m.zone + ' — ' + m.observations.join(', ')).join('; ')
      : ''
    return [
      `## Thread ${t.id}`,
      `Severity: ${effectiveSeverity} | Confidence: ${t.confidence} | Status: ${t.status}`,
      `Hypothesis: ${t.hypothesis}`,
      `Recommendation: ${t.recommendation}`,
      `Unknowns: ${t.unknowns.join('; ')}`,
      `Evidence tools used: ${t.evidence.map(e => e.tool).join(', ')}`,
      droneLines,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: 'You are a security briefing writer. Use only the findings provided. Preserve all unknowns exactly as stated. Do not speculate beyond the evidence. You MUST respond with valid JSON only — no markdown, no prose outside the JSON object.',
    messages: [
      {
        role: 'user',
        content: `Using ONLY the following approved security findings, write a morning briefing for the site operations lead.

Return a JSON object with exactly these keys:
{
  "what_happened": "A single paragraph summarising all overnight events.",
  "what_was_harmless": ["bullet string 1", "bullet string 2"],
  "what_needs_escalation": "A single paragraph describing what requires escalation and the recommended action.",
  "what_drone_checked": "A single paragraph on what the drone confirmed vs what was unobserved.",
  "what_needs_followup": ["bullet string 1", "bullet string 2"]
}

IMPORTANT: Preserve all unknowns exactly as stated. Do not add context not in the findings. Output ONLY the JSON object, nothing else.

FINDINGS:
${findingsSummary}`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const sections = JSON.parse(raw)
    return Response.json({ sections })
  } catch {
    return Response.json({ briefing: raw })
  }
}
