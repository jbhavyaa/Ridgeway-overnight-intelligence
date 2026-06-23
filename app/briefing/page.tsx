'use client'

import { useEffect, useState } from 'react'
import { Thread } from '@/lib/types'
import { NIGHTS } from '@/lib/seed/signals'

interface BriefingSections {
  what_happened: string
  what_was_harmless: string[]
  what_needs_escalation: string
  what_drone_checked: string
  what_needs_followup: string[]
}

interface BriefingResponse {
  sections?: BriefingSections
  briefing?: string
}

export default function BriefingPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [sections, setSections] = useState<BriefingSections | null>(null)
  const [legacyText, setLegacyText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const all: Thread[] = []
      for (const day of Object.keys(NIGHTS)) {
        const raw = localStorage.getItem(`ridgeway_threads_${day}`)
        if (raw) all.push(...(JSON.parse(raw) as Thread[]))
      }
      if (all.length > 0) setThreads(all)
    } catch { /* ignore */ }
  }, [])

  const approvedThreads = threads.filter(t => t.status === 'approved' || t.status === 'overridden')
  const escalateCount = approvedThreads.filter(t => (t.overriddenSeverity ?? t.severity) === 'escalate').length
  const watchCount = approvedThreads.filter(t => (t.overriddenSeverity ?? t.severity) === 'watch').length
  const noiseCount = approvedThreads.filter(t => (t.overriddenSeverity ?? t.severity) === 'noise').length

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
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">← Console</a>
            <span className="text-gray-200">|</span>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Morning Briefing</span>
          </div>
          {hasBriefing && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={copyToClipboard}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button type="button" onClick={downloadMd}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">
                Download .md
              </button>
              <button type="button" onClick={generateBriefing} disabled={loading}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-40">
                {loading ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-2">Ridgeway Industrial Site</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Night of Mon 19 Jun</h1>
          <p className="text-sm text-gray-500">22:00 → 06:00 · Prepared 06:42 · For Nisha (site head)</p>

          <div className="flex items-center gap-3 mt-5 flex-wrap">
            {escalateCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {escalateCount} escalation{escalateCount > 1 ? 's' : ''}
              </span>
            )}
            {watchCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {watchCount} follow-up{watchCount > 1 ? 's' : ''}
              </span>
            )}
            {noiseCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                {noiseCount} noise
              </span>
            )}
            {escalateCount === 0 && watchCount === 0 && approvedThreads.length > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500" />{'All clear'}
              </span>
            )}
          </div>
        </div>

        {/* Empty states */}
        {threads.length === 0 && (
          <div className="text-center py-24">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold text-gray-700 mb-1">No investigation data</p>
            <p className="text-sm text-gray-400 mb-4">Run an investigation from the console first.</p>
            <a href="/" className="text-sm text-sky-600 hover:underline">← Go to console</a>
          </div>
        )}
        {threads.length > 0 && approvedThreads.length === 0 && (
          <div className="text-center py-24">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold text-gray-700 mb-1">No approved findings</p>
            <p className="text-sm text-gray-400 mb-4">Approve findings in the console before generating a briefing.</p>
            <a href="/" className="text-sm text-sky-600 hover:underline">← Review queue</a>
          </div>
        )}

        {/* Generate button */}
        {approvedThreads.length > 0 && !hasBriefing && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-gray-600 font-medium">{approvedThreads.length} approved finding{approvedThreads.length > 1 ? 's' : ''} ready</p>
            <button
              type="button"
              onClick={generateBriefing}
              disabled={loading}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              {loading
                ? <span className="flex items-center gap-2"><Spinner />Generating briefing…</span>
                : 'Generate briefing'}
            </button>
          </div>
        )}

        {/* Structured sections */}
        {sections && (
          <div className="space-y-4">
            <Card label="What happened" icon="🗂" accent="blue">
              <p className="text-gray-700 leading-relaxed">{sections.what_happened}</p>
            </Card>

            <Card label="What was harmless" icon="✅" accent="green">
              <ul className="space-y-2">
                {sections.what_was_harmless.map(item => (
                  <li key={item} className="flex gap-2 text-gray-700">
                    <span className="text-green-500 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>

            <Card label="What needs escalation" icon="🚨" accent="red">
              <p className="text-red-800 font-medium leading-relaxed">{sections.what_needs_escalation}</p>
            </Card>

            <Card label="What the drone checked" icon="🚁" accent="sky">
              <p className="text-gray-700 leading-relaxed">{sections.what_drone_checked}</p>
            </Card>

            <Card label="What still needs follow-up" icon="🔲" accent="amber">
              <ul className="space-y-2">
                {sections.what_needs_followup.map(item => (
                  <li key={item} className="flex gap-2 text-gray-700">
                    <span className="text-amber-500 shrink-0">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>

            <div className="pt-6 flex items-center justify-between border-t border-gray-200">
              <p className="text-xs text-gray-400">Ridgeway Overnight Intelligence · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <div className="flex gap-2">
                <button type="button" onClick={copyToClipboard}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600">
                  {copied ? '✓ Copied' : 'Copy text'}
                </button>
                <button type="button" onClick={downloadMd}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600">
                  Download .md
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legacy fallback */}
        {legacyText && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{legacyText}</pre>
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <button type="button" onClick={copyToClipboard}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button type="button" onClick={downloadMd}
                className="text-xs px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600">
                Download .md
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Card({
  icon, label, accent, children,
}: {
  readonly icon: string
  readonly label: string
  readonly accent: 'blue' | 'green' | 'red' | 'sky' | 'amber'
  readonly children: React.ReactNode
}) {
  const styles = {
    blue:  { border: 'border-blue-100',  bg: 'bg-white',         label: 'text-blue-600' },
    green: { border: 'border-green-100', bg: 'bg-white',         label: 'text-green-600' },
    red:   { border: 'border-red-200',   bg: 'bg-red-50',        label: 'text-red-600' },
    sky:   { border: 'border-sky-100',   bg: 'bg-white',         label: 'text-sky-600' },
    amber: { border: 'border-amber-100', bg: 'bg-amber-50/50',   label: 'text-amber-600' },
  }[accent]

  return (
    <div className={`rounded-2xl border ${styles.border} ${styles.bg} p-6 shadow-sm`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <h2 className={`text-xs font-bold uppercase tracking-widest ${styles.label}`}>{label}</h2>
      </div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}
