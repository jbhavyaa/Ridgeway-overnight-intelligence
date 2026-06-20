'use client'

import { Signal, Thread } from '@/lib/types'
import { zones } from '@/lib/seed/zones'

interface SiteMapProps {
  readonly signals: Signal[]
  readonly threads: Thread[]
  readonly selectedThreadId: string | null
  readonly onSelectSignal: (signalId: string) => void
  readonly newDroneRoute?: Array<{ x: number; y: number; t: string; zone: string }>
}

const ZONE_SIZES: Record<string, { w: number; h: number }> = {
  gate:         { w: 52,  h: 36 },
  yard:         { w: 130, h: 95 },
  restricted:   { w: 130, h: 95 },
  building:     { w: 105, h: 68 },
  access_point: { w: 42,  h: 30 },
  service:      { w: 62,  h: 42 },
}

const ZONE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  gate:         { fill: '#0e7490', stroke: '#22d3ee', text: '#cffafe' },
  yard:         { fill: '#1e3a5f', stroke: '#3b82f6', text: '#bfdbfe' },
  restricted:   { fill: '#78350f', stroke: '#f59e0b', text: '#fef3c7' },
  building:     { fill: '#1f2937', stroke: '#6b7280', text: '#d1d5db' },
  access_point: { fill: '#4c1d95', stroke: '#a78bfa', text: '#ede9fe' },
  service:      { fill: '#111827', stroke: '#374151', text: '#9ca3af' },
}

function getSignalColor(signal: Signal, threads: Thread[], selectedThreadId: string | null): string {
  const thread = threads.find(t => t.signalIds.includes(signal.id))
  if (!thread) return '#4b5563'
  const sev = thread.overriddenSeverity ?? thread.severity
  if (thread.id === selectedThreadId) return '#ffffff'
  switch (sev) {
    case 'escalate': return '#ef4444'
    case 'watch':    return '#f59e0b'
    case 'noise':    return '#6b7280'
    default:         return '#4b5563'
  }
}

export default function SiteMap({ signals, threads, selectedThreadId, onSelectSignal, newDroneRoute }: SiteMapProps) {
  const selectedThread = threads.find(t => t.id === selectedThreadId)
  const selectedSignalIds = new Set(selectedThread?.signalIds ?? [])

  const droneWaypoints = [
    { x: 500, y: 640 }, { x: 460, y: 310 }, { x: 655, y: 515 }, { x: 765, y: 435 }, { x: 500, y: 650 },
  ]
  const dronePolyline = droneWaypoints.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox="0 0 1000 700" className="w-full h-full" style={{ background: '#0f172a' }}>
      {/* Grid */}
      {Array.from({ length: 10 }, (_, i) => (
        <line key={`vg-${i}`} x1={i * 100} y1={0} x2={i * 100} y2={700} stroke="#1e293b" strokeWidth={0.5} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`hg-${i}`} x1={0} y1={i * 100} x2={1000} y2={i * 100} stroke="#1e293b" strokeWidth={0.5} />
      ))}

      {/* Site boundary */}
      <rect x={30} y={30} width={940} height={640} fill="none" stroke="#334155" strokeWidth={2} strokeDasharray="8,4" rx={4} />

      {/* Zone rectangles */}
      {zones.map(zone => {
        const size = ZONE_SIZES[zone.kind] ?? { w: 80, h: 50 }
        const colors = ZONE_COLORS[zone.kind] ?? ZONE_COLORS.building
        return (
          <g key={zone.id}>
            <rect
              x={zone.x - size.w / 2}
              y={zone.y - size.h / 2}
              width={size.w}
              height={size.h}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={1.5}
              rx={3}
              opacity={0.85}
            />
            <text
              x={zone.x}
              y={zone.y - size.h / 2 - 4}
              textAnchor="middle"
              fill={colors.text}
              fontSize={9}
              fontFamily="monospace"
              opacity={0.9}
            >
              {zone.id}
            </text>
          </g>
        )
      })}

      {/* NP-118 patrol polyline */}
      <polyline
        points={dronePolyline}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={1.5}
        strokeDasharray="6,4"
        opacity={0.5}
      />

      {/* Dispatched drone route */}
      {newDroneRoute && newDroneRoute.length > 1 && (
        <polyline
          points={newDroneRoute.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={2}
          strokeDasharray="4,3"
          opacity={0.8}
        />
      )}

      {/* Signal pins */}
      {signals.map(signal => {
        const color = getSignalColor(signal, threads, selectedThreadId)
        const isSelected = selectedSignalIds.has(signal.id)
        const r = isSelected ? 10 : 7
        return (
          <g key={signal.id} onClick={() => onSelectSignal(signal.id)} style={{ cursor: 'pointer' }}>
            {isSelected && (
              <circle cx={signal.x} cy={signal.y} r={r + 6} fill={color} opacity={0.2} />
            )}
            <circle
              cx={signal.x}
              cy={signal.y}
              r={r}
              fill={color}
              stroke={isSelected ? '#ffffff' : color}
              strokeWidth={isSelected ? 2 : 1}
              opacity={0.9}
            />
            {signal.type === 'badge_failure' && (
              <>
                <line x1={signal.x - 4} y1={signal.y - 4} x2={signal.x + 4} y2={signal.y + 4} stroke="white" strokeWidth={1.5} />
                <line x1={signal.x + 4} y1={signal.y - 4} x2={signal.x - 4} y2={signal.y + 4} stroke="white" strokeWidth={1.5} />
              </>
            )}
          </g>
        )
      })}

      {/* Labels for selected thread's signals */}
      {signals.filter(s => selectedSignalIds.has(s.id)).map(signal => (
        <text
          key={`lbl-${signal.id}`}
          x={signal.x + 12}
          y={signal.y + 4}
          fill="#ffffff"
          fontSize={8}
          fontFamily="monospace"
          style={{ pointerEvents: 'none' }}
        >
          {signal.id}
        </text>
      ))}

      {/* Legend */}
      <g transform="translate(38, 618)">
        <rect x={0} y={0} width={230} height={34} fill="#0f172a" stroke="#334155" strokeWidth={1} rx={3} opacity={0.9} />
        {[
          { color: '#ef4444', label: 'escalate',   dashed: false },
          { color: '#f59e0b', label: 'follow-up',  dashed: false },
          { color: '#6b7280', label: 'noise',       dashed: false },
          { color: '#3b82f6', label: 'drone route', dashed: true  },
        ].map((item, i) => (
          <g key={item.label} transform={`translate(${8 + i * 57}, 17)`}>
            {item.dashed
              ? <line x1={0} y1={0} x2={10} y2={0} stroke={item.color} strokeWidth={1.5} strokeDasharray="3,2" />
              : <circle cx={5} cy={0} r={4} fill={item.color} />
            }
            <text x={item.dashed ? 13 : 12} y={4} fill="#94a3b8" fontSize={8} fontFamily="monospace">{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}
