'use client'

import { useEffect, useState } from 'react'
import { Thread } from '@/lib/types'

interface BriefingSections {
  what_happened: string
  what_was_harmless: string[]
  what_needs_escalation: string
  what_drone_checked: string
  what_needs_followup: string[]
}

interface BriefingResponse {
  sections?: BriefingSections
  briefing?: string // backward compat
}

export default function BriefingPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [sections, setSections] = useState<BriefingSections | null>(null)
  const [legacyText, setLegacyText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ridgeway_threads_v1')
      if (raw) setThreads(JSON.parse(raw) as Thread[])
    } catch { /* ignore */ }
  }, [])

  const approvedThreads = threads.filter(t => t.status === 'approved' || t.status === 'overridden')
  const escalateCount = approvedThreads.filter(t => (t.overriddenSeverity ?? t.severity) === 'escalate').length
  const watchCount = approvedThreads.filter(t => (t.overriddenSeverity ?? t.severity) === 'watch').length

  const generateBriefing = async () => {
    setLoading(true)
    const res = await fetch('/api/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threads: approvedThreads }),
    })
    const data: BriefingResponse = await res.json()
    if (data.sections) {
      setSections(data.sections)
      setLegacyText('')
    } else if (data.briefing) {
      setLegacyText(data.briefing)
      setSections(null)
    }
    setLoading(false)
  }

  const bullets = (items: string[]) => items.map(b => '• ' + b).join('\n')

  const briefingText = sections
    ? [
        'WHAT HAPPENED\n' + sections.what_happened,
        'WHAT WAS HARMLESS\n' + bullets(sections.what_was_harmless),
        'WHAT NEEDS ESCALATION\n' + sections.what_needs_escalation,
        'WHAT THE DRONE CHECKED\n' + sections.what_drone_checked,
        'WHAT STILL NEEDS FOLLOW-UP\n' + bullets(sections.what_needs_followup),
      ].join('\n\n')
    : legacyText

  const copyToClipboard = () => {
    navigator.clipboard.writeText(briefingText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadMd = () => {
    const blob = new Blob([briefingText], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ridgeway-briefing-2026-06-20.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasBriefing = sections !== null || legacyText !== ''

  return (
    <div className="min-h-screen" style={{ background: '#faf9f5', color: '#1c1917' }}>
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Title block */}
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-2xl font-bold text-stone-900 leading-tight">
            Morning briefing — 19 Jun overnight
          </h1>
          <a href="/" className="text-xs text-stone-400 hover:text-stone-600 mt-1.5 shrink-0">← Console</a>
        </div>
        <p className="text-sm text-stone-500 mb-3">
          Prepared for Nisha (site head) · approved by Maya · 06:42
        </p>

        {/* Status badges */}
        <div className="flex items-center gap-2 mb-5">
          {escalateCount > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">
              {escalateCount} escalation{escalateCount > 1 ? 's' : ''}
            </span>
          )}
          {watchCount > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
              {watchCount} follow-up{watchCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <hr className="border-stone-200 mb-6" />

        {/* States */}
        {threads.length === 0 && (
          <p className="text-sm text-stone-400">No threads loaded. Run the investigation first.</p>
        )}
        {threads.length > 0 && approvedThreads.length === 0 && (
          <p className="text-sm text-stone-400">No approved threads. Go approve findings in the console first.</p>
        )}

        {approvedThreads.length > 0 && !hasBriefing && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generateBriefing}
              disabled={loading}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {loading ? 'Generating…' : 'Generate briefing'}
            </button>
            <span className="text-xs text-stone-400">{approvedThreads.length} approved findings ready</span>
          </div>
        )}

        {/* Structured sections */}
        {sections && (
          <div className="space-y-7">
            <Section label="What happened">
              <p className="text-sm text-stone-700 leading-relaxed">{sections.what_happened}</p>
            </Section>

            <Section label="What was harmless">
              <ul className="space-y-1">
                {sections.what_was_harmless.map(item => (
                  <li key={item} className="text-sm text-stone-700 flex gap-2">
                    <span className="text-stone-400 shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section label="What needs escalation" badge={{ text: 'ACTION', color: 'red' }}>
              <p className="text-sm text-stone-700 leading-relaxed font-medium">{sections.what_needs_escalation}</p>
            </Section>

            <Section label="What the drone checked">
              <p className="text-sm text-stone-700 leading-relaxed">{sections.what_drone_checked}</p>
            </Section>

            <Section label="What still needs follow-up" badge={{ text: 'OPEN', color: 'amber' }}>
              <ul className="space-y-1">
                {sections.what_needs_followup.map(item => (
                  <li key={item} className="text-sm text-stone-700 flex gap-2">
                    <span className="text-stone-400 shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={copyToClipboard}
                className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={downloadMd}
                className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600"
              >
                Download .md
              </button>
              <button
                type="button"
                onClick={generateBriefing}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-500 disabled:opacity-50"
              >
                {loading ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </div>
        )}

        {/* Legacy plain-text fallback */}
        {legacyText && (
          <div>
            <div className="bg-white border border-stone-200 rounded-xl p-6 mb-4">
              <pre className="text-sm text-stone-700 whitespace-pre-wrap font-sans leading-relaxed">{legacyText}</pre>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={copyToClipboard}
                className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={downloadMd}
                className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600"
              >
                Download .md
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  label,
  badge,
  children,
}: {
  readonly label: string
  readonly badge?: { text: string; color: 'red' | 'amber' }
  readonly children: React.ReactNode
}) {
  const badgeClass = badge?.color === 'red'
    ? 'bg-red-100 text-red-700 border border-red-200'
    : 'bg-amber-100 text-amber-700 border border-amber-200'

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">{label}</p>
        {badge && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>
            {badge.text}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
