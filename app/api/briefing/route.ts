import { NextRequest } from 'next/server'
import { store } from '@/lib/store'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const { threadIds } = await req.json()

  const threads = threadIds
    .map((id: string) => store.getThread(id))
    .filter(Boolean)

  if (threads.length === 0) {
    return Response.json({ error: 'No approved threads found' }, { status: 400 })
  }

  const findingsSummary = threads.map((t: NonNullable<ReturnType<typeof store.getThread>>) => {
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

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a security briefing writer. Use only the findings provided. Preserve all unknowns exactly as stated. Do not speculate beyond the evidence. You MUST respond with valid JSON only — no markdown, no prose outside the JSON object.',
      },
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

IMPORTANT: Preserve all unknowns exactly as stated. Do not add context not in the findings.

FINDINGS:
${findingsSummary}`,
      },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'
  try {
    const sections = JSON.parse(raw)
    return Response.json({ sections })
  } catch {
    // Fallback: return raw text for backward compat
    return Response.json({ briefing: raw })
  }
}
