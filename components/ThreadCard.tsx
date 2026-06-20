'use client'

import { Thread, Severity, EvidenceItem } from '@/lib/types'
import { useState } from 'react'
import EvidenceTrail from './EvidenceTrail'

interface Props {
  readonly thread: Thread
  readonly selected: boolean
  readonly onSelect: () => void
  readonly onApprove: () => void
  readonly onChangeSeverity: (s: Severity) => void
  readonly onDismiss: () => void
  readonly onDispatch: (zone: string, reason: string) => void
}

const SEVERITY_STYLES = {
  escalate: {
    badge: 'bg-red-50 text-red-600 border border-red-200',
    card: 'border-l-4 border-l-red-500 border border-red-100 bg-white',
    label: 'Escalate',
  },
  watch: {
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    card: 'border-l-4 border-l-amber-400 border border-amber-100 bg-white',
    label: 'Follow-up',
  },
  noise: {
    badge: 'bg-slate-100 text-slate-500 border border-slate-200',
    card: 'border border-slate-200 bg-white',
    label: 'Noise',
  },
}

const TOOL_NAMES: Record<string, string> = {
  get_weather: 'Weather',
  get_shift_roster: 'Shift roster',
  get_access_records: 'Access log',
  get_zone_history: 'Zone history',
  check_drone_coverage: 'Drone coverage',
  dispatch_drone_mission: 'Drone dispatch',
}

function summariseAccessRecords(records: Array<{ event: string }>): string {
  const denials = records.filter(r => r.event === 'badge_denied').length
  const grants = records.filter(r => r.event === 'badge_granted' || r.event === 'vehicle_gate_open').length
  const parts: string[] = []
  if (denials > 0) parts.push(`${denials} badge denial${denials > 1 ? 's' : ''}`)
  if (grants > 0) parts.push(`${grants} entry event${grants > 1 ? 's' : ''}`)
  return parts.join(', ') || `${records.length} records`
}

function summariseWeather(r: Record<string, unknown>): string {
  const kph = typeof r.wind_kph === 'number' ? String(r.wind_kph) : '?'
  const dir = typeof r.dir === 'string' ? r.dir : ''
  const note = typeof r.note === 'string' ? r.note : ''
  const base = `${kph} kph ${dir}`.trim()
  return note ? `${base} — ${note}` : base
}

function summariseRoster(r: Record<string, unknown>): string {
  const entries = Array.isArray(r.entries)
    ? (r.entries as Array<{ name: string; shift: string; authorized_zones?: string[] }>)
    : []
  const contractors = entries.filter(e => 'badge' in e)
  if (contractors.length > 0) {
    return contractors.map(e => `${e.name}: ${e.shift}, auth ${(e.authorized_zones ?? []).join('/')}`).join('; ')
  }
  return `${entries.length} staff on shift`
}

function summariseZoneHistory(r: Record<string, unknown>): string {
  const baseline = typeof r.baseline === 'string' ? r.baseline : ''
  const summary = typeof r.summary === 'string' ? r.summary.split('.')[0] : ''
  return baseline || summary || 'No baseline data'
}

function summariseDroneCoverage(r: Record<string, unknown>): string {
  const gaps = Array.isArray(r.coverage_gaps) ? (r.coverage_gaps as string[]) : []
  const findings = typeof r.findings === 'string' ? r.findings.split('.')[0] : ''
  return gaps.length > 0 ? `${findings}; gap: ${gaps[0]}` : findings
}

function summariseDroneDispatch(r: Record<string, unknown>): string {
  const obs = Array.isArray(r.observations) ? (r.observations as string[]) : []
  return obs[0] ?? 'Dispatched'
}

const TOOL_SUMMARISERS: Record<string, (r: Record<string, unknown>) => string> = {
  get_weather: summariseWeather,
  get_shift_roster: summariseRoster,
  get_zone_history: summariseZoneHistory,
  check_drone_coverage: summariseDroneCoverage,
  dispatch_drone_mission: summariseDroneDispatch,
}

function getToolSummary(tool: string, result: unknown): string {
  try {
    if (Array.isArray(result)) {
      return tool === 'get_access_records'
        ? summariseAccessRecords(result as Array<{ event: string }>)
        : `${result.length} records`
    }
    const r = result as Record<string, unknown>
    const fn = TOOL_SUMMARISERS[tool]
    return fn ? fn(r) : JSON.stringify(result).slice(0, 80)
  } catch {
    return typeof result === 'string' ? result.slice(0, 80) : JSON.stringify(result).slice(0, 80)
  }
}

export default function ThreadCard({
  thread, selected, onSelect, onApprove, onChangeSeverity, onDismiss, onDispatch,
}: Props) {
  const [showRawEvidence, setShowRawEvidence] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)
  const [dispatchZone, setDispatchZone] = useState('')
  const [expanded, setExpanded] = useState(false)

  const effectiveSeverity = thread.overriddenSeverity ?? thread.severity
  const styles = SEVERITY_STYLES[effectiveSeverity]
  const isNoise = effectiveSeverity === 'noise'
  const showDetail = !isNoise || expanded
  const canDispatch = (effectiveSeverity === 'escalate' || effectiveSeverity === 'watch') && thread.status !== 'dismissed'

  return (
    <div className={`rounded-xl mb-3 shadow-sm ${styles.card} ${selected ? 'ring-2 ring-sky-400' : ''}`}>

      {/* Selection trigger */}
      <button
        type="button"
        className="w-full text-left px-4 pt-4 pb-0"
        onClick={onSelect}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles.badge}`}>
            {styles.label}
            {thread.overriddenSeverity && <span className="ml-1 opacity-60">·override</span>}
          </span>
          <span className="text-xs text-slate-400">
            {thread.confidence} confidence · {thread.signalIds.length} signal{thread.signalIds.length > 1 ? 's' : ''}
          </span>
          {thread.status === 'approved' && (
            <span className="ml-auto text-xs text-green-600 font-semibold">✓ approved</span>
          )}
          {thread.status === 'dismissed' && (
            <span className="ml-auto text-xs text-slate-400">dismissed</span>
          )}
        </div>

        {/* Hypothesis */}
        <p className="text-sm font-semibold text-slate-800 mb-1 leading-snug">{thread.hypothesis}</p>

        {/* Recommendation */}
        <p className="text-xs text-slate-500 mb-3">→ {thread.recommendation}</p>

        {/* Signal chips */}
        <div className="flex flex-wrap gap-1 mb-3">
          {thread.signalIds.map(id => (
            <span key={id} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono border border-slate-200">{id}</span>
          ))}
        </div>
      </button>

      {/* Detail area */}
      <div className="px-4 pb-4">
        {isNoise && !expanded && (
          <button
            type="button"
            className="text-xs text-sky-600 hover:text-sky-700 mb-2 font-medium"
            onClick={() => setExpanded(true)}
          >
            Show evidence →
          </button>
        )}

        {/* Evidence summary */}
        {showDetail && thread.evidence.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Evidence checked</p>
            <div className="space-y-1.5">
              {thread.evidence.map((item: EvidenceItem, i: number) => (
                <div key={`${item.tool}-${i}`} className="flex gap-2 text-xs">
                  <span className="font-semibold text-sky-600 shrink-0 w-28">
                    {TOOL_NAMES[item.tool] ?? item.tool}
                  </span>
                  <span className="text-slate-500">→ {getToolSummary(item.tool, item.result)}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setShowRawEvidence(v => !v)}
            >
              {showRawEvidence ? '▼ Hide raw trail' : '▶ Raw evidence trail'}
            </button>
            {showRawEvidence && <div className="mt-2"><EvidenceTrail evidence={thread.evidence} /></div>}
          </div>
        )}

        {/* Unknowns */}
        {showDetail && thread.unknowns.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 mb-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚠ Couldn&apos;t verify</p>
            {thread.unknowns.map((u) => (
              <p key={u} className="text-xs text-amber-700 leading-snug">· {u}</p>
            ))}
          </div>
        )}

        {/* Dispatched missions */}
        {(thread.dispatchedMissions?.length ?? 0) > 0 && (
          <div className="mb-3 space-y-1.5">
            {thread.dispatchedMissions!.map(m => (
              <div key={m.missionId} className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
                <p className="text-xs font-semibold text-sky-700">{m.missionId} → {m.zone}</p>
                {m.observations.map((obs) => (
                  <p key={obs} className="text-xs text-sky-600">· {obs}</p>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {thread.status !== 'dismissed' && (
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {thread.status !== 'approved' && (
              <button
                type="button"
                className="text-xs px-3 py-1 rounded-full border border-green-300 hover:bg-green-50 text-green-700 font-medium"
                onClick={onApprove}
              >Approve</button>
            )}
            <select
              className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-600 cursor-pointer"
              value={thread.overriddenSeverity ?? thread.severity}
              onChange={e => onChangeSeverity(e.target.value as Severity)}
            >
              <option value="noise">Noise</option>
              <option value="watch">Follow-up</option>
              <option value="escalate">Escalate</option>
            </select>
            {canDispatch && !showDispatch && (
              <button
                type="button"
                className="text-xs px-3 py-1 rounded-full border border-sky-300 hover:bg-sky-50 text-sky-700 font-medium"
                onClick={() => setShowDispatch(true)}
              >Dispatch drone</button>
            )}
            <button
              type="button"
              className="text-xs px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-500"
              onClick={onDismiss}
            >Dismiss</button>
          </div>
        )}

        {showDispatch && (
          <div className="mt-2 flex gap-2">
            <input
              className="flex-1 text-xs border border-slate-200 rounded-full px-3 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
              placeholder="zone, e.g. yard-b"
              value={dispatchZone}
              onChange={e => setDispatchZone(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="text-xs px-3 py-1 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-medium"
              onClick={() => { onDispatch(dispatchZone || 'yard-b', thread.recommendation); setShowDispatch(false) }}
            >Go</button>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setShowDispatch(false)}
            >Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}
