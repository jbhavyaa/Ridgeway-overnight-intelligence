'use client'

import { useEffect, useState, useRef } from 'react'
import { Thread, Severity, DispatchResult } from '@/lib/types'
import { NIGHTS, signalsJun19 } from '@/lib/seed/signals'
import SiteMap from '@/components/SiteMap'
import ReviewQueue from '@/components/ReviewQueue'

const DEFAULT_DAY = '2026-06-19'

function cacheKey(day: string) { return `ridgeway_threads_${day}` }

function loadCached(day: string): Thread[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(day))
    return raw ? (JSON.parse(raw) as Thread[]) : null
  } catch { return null }
}

function saveCache(day: string, threads: Thread[]) {
  try { localStorage.setItem(cacheKey(day), JSON.stringify(threads)) } catch { /* ignore */ }
}

function clearCache(day: string) {
  try { localStorage.removeItem(cacheKey(day)) } catch { /* ignore */ }
}

function mergeThread(prev: Thread[], thread: Thread): Thread[] {
  const exists = prev.find(t => t.id === thread.id)
  if (exists) return prev.map(t => t.id === thread.id ? thread : t)
  return [...prev, thread]
}

export default function Home() {
  const [selectedDay, setSelectedDay] = useState(DEFAULT_DAY)
  const [threads, setThreads] = useState<Thread[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'complete'>('idle')
  const [log, setLog] = useState<string[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [newDroneRoute, setNewDroneRoute] = useState<DispatchResult | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  const currentNight = NIGHTS[selectedDay] ?? NIGHTS[DEFAULT_DAY]
  const currentSignals = currentNight?.signals ?? signalsJun19

  useEffect(() => {
    hasStarted.current = false
    setThreads([])
    setLog([])
    setStatus('idle')
    setSelectedThreadId(null)
    setNewDroneRoute(null)
  }, [selectedDay])

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    const cached = loadCached(selectedDay)
    if (cached && cached.length > 0) {
      setThreads(cached)
      setStatus('complete')
    } else {
      startInvestigation()
    }
  })

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const startInvestigation = () => {
    setStatus('running')
    setLog([])
    setThreads([])
    const es = new EventSource(`/api/investigate?day=${selectedDay}`)
    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'log') setLog(prev => [...prev, data.message])
      else if (data.type === 'thread') {
        setThreads(prev => mergeThread(prev, data.thread))
      } else if (data.type === 'done') {
        setThreads(data.threads)
        saveCache(selectedDay, data.threads)
        setStatus('complete')
        es.close()
      } else if (data.type === 'running') {
        setThreads(data.threads)
        setStatus('running')
        es.close()
      } else if (data.type === 'error') {
        setLog(prev => [...prev, 'ERROR: ' + String(data.message)])
        setStatus('idle')
        es.close()
      }
    }
    es.onerror = () => { setStatus('complete'); es.close() }
  }

  const resetAndReinvestigate = async () => {
    clearCache(selectedDay)
    await fetch('/api/investigate', { method: 'DELETE' })
    hasStarted.current = false
    setStatus('idle'); setThreads([]); setLog([]); setSelectedThreadId(null); setNewDroneRoute(null)
  }

  const updateThreads = (updated: Thread[]) => {
    setThreads(updated)
    saveCache(selectedDay, updated)
  }

  const handleApprove = (threadId: string) =>
    updateThreads(threads.map(t => t.id === threadId ? { ...t, status: 'approved' as const } : t))

  const handleChangeSeverity = (threadId: string, severity: Severity) =>
    updateThreads(threads.map(t => t.id === threadId ? { ...t, status: 'overridden' as const, overriddenSeverity: severity } : t))

  const handleDismiss = (threadId: string) =>
    updateThreads(threads.map(t => t.id === threadId ? { ...t, status: 'dismissed' as const } : t))

  const handleDispatch = async (threadId: string, zone: string, reason: string) => {
    const res = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zone, reason }) })
    const { mission } = await res.json()
    updateThreads(threads.map(t => t.id === threadId
      ? { ...t, dispatchedMissions: [...(t.dispatchedMissions ?? []), mission] }
      : t
    ))
    setNewDroneRoute(mission)
  }

  const approvedCount = threads.filter(t => t.status === 'approved' || t.status === 'overridden').length
  const escalateCount = threads.filter(t => (t.overriddenSeverity ?? t.severity) === 'escalate' && t.status !== 'dismissed').length
  const watchCount = threads.filter(t => (t.overriddenSeverity ?? t.severity) === 'watch' && t.status !== 'dismissed').length

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-sm font-bold text-slate-800 tracking-wider uppercase">
              <span className="text-sky-600">Ridgeway</span>{' '}Overnight Intelligence
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{currentNight.label} · 22:00 → 06:00</p>
          </div>
          {/* Night selector */}
          <select
            value={selectedDay}
            onChange={e => setSelectedDay(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 hover:border-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {Object.entries(NIGHTS).map(([day, night]) => (
              <option key={day} value={day}>{night.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          {status === 'running' && (
            <span className="text-xs text-amber-600 flex items-center gap-1.5 font-medium">
              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              Investigating…
            </span>
          )}
          {status === 'complete' && (
            <>
              <span className="text-xs text-slate-500">
                <span className="text-green-500 font-bold">✓</span> {threads.length} findings
              </span>
              {escalateCount > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
                  {escalateCount} escalate
                </span>
              )}
              {watchCount > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                  {watchCount} follow-up
                </span>
              )}
              {escalateCount === 0 && watchCount === 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                  All clear
                </span>
              )}
            </>
          )}
          {status === 'idle' && (
            <button type="button" onClick={startInvestigation}
              className="text-xs px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium shadow-sm">
              Start investigation
            </button>
          )}
          <button type="button" onClick={resetAndReinvestigate}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg bg-white">
            Re-investigate
          </button>
          {status === 'complete' && approvedCount > 0 && (
            <a href="/briefing"
              className="text-xs px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium shadow-sm">
              Morning briefing →
            </a>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* Left: Map panel */}
        <div className="flex flex-col shrink-0" style={{ width: '52%' }}>
          <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden flex flex-col bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Site Map</span>
              <span className="text-xs text-slate-400">{selectedDay === '2026-06-21' ? 'NP-121 patrol route shown' : 'NP-118 patrol route shown'}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <SiteMap
                signals={currentSignals}
                threads={threads}
                selectedThreadId={selectedThreadId}
                onSelectSignal={(signalId) => {
                  const thread = threads.find(t => t.signalIds.includes(signalId))
                  if (thread) setSelectedThreadId(thread.id)
                }}
                newDroneRoute={newDroneRoute?.route}
              />
            </div>
          </div>

          {/* Live log */}
          {status === 'running' && log.length > 0 && (
            <div ref={logRef} className="mt-3 rounded-xl border border-slate-200 bg-white p-3 h-28 overflow-y-auto shrink-0 shadow-sm">
              <p className="text-xs text-sky-600 font-mono font-semibold mb-1">Investigation log</p>
              {log.map((line, i) => (
                <p key={`log-${i}-${line.slice(0, 20)}`} className="text-xs font-mono text-slate-400">{line}</p>
              ))}
              <p className="text-xs font-mono text-amber-500 animate-pulse">▌</p>
            </div>
          )}
        </div>

        {/* Right: Review queue */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-1 py-1 mb-2 shrink-0 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {threads.length > 0 ? `Review Queue (${threads.length})` : 'Review Queue'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-1">
            {threads.length === 0 && status === 'running' && (
              <p className="text-sm text-slate-400 text-center mt-16">Findings will appear as investigation completes…</p>
            )}
            {threads.length === 0 && status === 'idle' && (
              <p className="text-sm text-slate-400 text-center mt-16">Start investigation to see findings.</p>
            )}
            <ReviewQueue
              threads={threads}
              selectedThreadId={selectedThreadId}
              onSelectThread={setSelectedThreadId}
              onApprove={handleApprove}
              onChangeSeverity={handleChangeSeverity}
              onDismiss={handleDismiss}
              onDispatch={handleDispatch}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
