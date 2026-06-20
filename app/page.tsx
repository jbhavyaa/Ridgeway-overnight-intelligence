'use client'

import { useEffect, useState, useRef } from 'react'
import { Thread, Severity, DispatchResult } from '@/lib/types'
import { signals } from '@/lib/seed/signals'
import SiteMap from '@/components/SiteMap'
import ReviewQueue from '@/components/ReviewQueue'

export default function Home() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'complete'>('idle')
  const [log, setLog] = useState<string[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [newDroneRoute, setNewDroneRoute] = useState<DispatchResult | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    startInvestigation()
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const startInvestigation = () => {
    setStatus('running')
    setLog([])
    setThreads([])
    const es = new EventSource('/api/investigate')
    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'log') setLog(prev => [...prev, data.message])
      else if (data.type === 'thread') {
        setThreads(prev => {
          const exists = prev.find(t => t.id === data.thread.id)
          if (exists) return prev.map(t => t.id === data.thread.id ? data.thread : t)
          return [...prev, data.thread]
        })
      } else if (data.type === 'done') {
        setThreads(data.threads)
        setStatus('complete')
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
    await fetch('/api/investigate', { method: 'DELETE' })
    hasStarted.current = false
    setStatus('idle'); setThreads([]); setLog([]); setSelectedThreadId(null); setNewDroneRoute(null)
    setTimeout(() => { hasStarted.current = true; startInvestigation() }, 100)
  }

  const handleApprove = async (threadId: string) => {
    const res = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId, action: 'approve' }) })
    const { thread } = await res.json()
    setThreads(prev => prev.map(t => t.id === threadId ? thread : t))
  }

  const handleChangeSeverity = async (threadId: string, severity: Severity) => {
    const res = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId, action: 'change_severity', severity }) })
    const { thread } = await res.json()
    setThreads(prev => prev.map(t => t.id === threadId ? thread : t))
  }

  const handleDismiss = async (threadId: string) => {
    const res = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId, action: 'dismiss' }) })
    const { thread } = await res.json()
    setThreads(prev => prev.map(t => t.id === threadId ? thread : t))
  }

  const handleDispatch = async (threadId: string, zone: string, reason: string) => {
    const res = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId, zone, reason }) })
    const { mission, thread } = await res.json()
    setThreads(prev => prev.map(t => t.id === threadId ? thread : t))
    setNewDroneRoute(mission)
  }

  const approvedCount = threads.filter(t => t.status === 'approved' || t.status === 'overridden').length
  const escalateCount = threads.filter(t => (t.overriddenSeverity ?? t.severity) === 'escalate' && t.status !== 'dismissed').length
  const watchCount = threads.filter(t => (t.overriddenSeverity ?? t.severity) === 'watch' && t.status !== 'dismissed').length

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div>
          <h1 className="text-sm font-bold text-cyan-400 tracking-wider uppercase">Ridgeway Overnight Intelligence</h1>
          <p className="text-xs text-gray-500 mt-0.5">Night of Mon 19 Jun · 22:00 → 06:00 · now 06:10</p>
        </div>
        <div className="flex items-center gap-3">
          {status === 'running' && (
            <span className="text-xs text-amber-400 animate-pulse flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              Investigating…
            </span>
          )}
          {status === 'complete' && (
            <>
              <span className="text-xs text-gray-500">
                <span className="text-green-400">✓</span> {threads.length} findings
              </span>
              {escalateCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
                  {escalateCount} escalate
                </span>
              )}
              {watchCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
                  {watchCount} follow-up
                </span>
              )}
            </>
          )}
          {status === 'idle' && (
            <button type="button" onClick={startInvestigation} className="text-xs px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded">
              Start investigation
            </button>
          )}
          <button type="button" onClick={resetAndReinvestigate} className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-3 py-1 rounded">
            Re-investigate
          </button>
          {status === 'complete' && approvedCount > 0 && (
            <a href="/briefing" className="text-xs px-3 py-1.5 bg-cyan-800 hover:bg-cyan-700 text-cyan-200 rounded">
              Morning briefing →
            </a>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* Left: Map panel */}
        <div className="flex flex-col shrink-0" style={{ width: '42%' }}>
          <div className="flex-1 rounded-lg border border-gray-800 overflow-hidden flex flex-col bg-gray-900">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800 shrink-0">
              <span className="text-xs font-medium text-gray-400">Site map</span>
              <span className="text-xs text-gray-600">last night</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <SiteMap
                signals={signals}
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

          {/* Live log during investigation */}
          {status === 'running' && log.length > 0 && (
            <div ref={logRef} className="mt-3 rounded-lg border border-gray-800 bg-gray-900 p-3 h-28 overflow-y-auto shrink-0">
              <p className="text-xs text-cyan-500 font-mono mb-1">Investigation log</p>
              {log.map((line, i) => (
                <p key={`log-${i}-${line.slice(0, 20)}`} className="text-xs font-mono text-gray-500">{line}</p>
              ))}
              <p className="text-xs font-mono text-amber-400 animate-pulse">▌</p>
            </div>
          )}
        </div>

        {/* Right: Review queue */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-1 py-1 mb-2 shrink-0">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {threads.length > 0 ? `Review Queue (${threads.length})` : 'Review Queue'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-1">
            {threads.length === 0 && status === 'running' && (
              <p className="text-sm text-gray-600 text-center mt-16">Findings will appear as investigation completes…</p>
            )}
            {threads.length === 0 && status === 'idle' && (
              <p className="text-sm text-gray-600 text-center mt-16">Start investigation to see findings.</p>
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
