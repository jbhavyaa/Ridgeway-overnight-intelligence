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
  gate:         { w: 56,  h: 40  },
  yard:         { w: 140, h: 100 },
  restricted:   { w: 140, h: 100 },
  building:     { w: 115, h: 75  },
  access_point: { w: 46,  h: 34  },
  service:      { w: 68,  h: 46  },
}

const ZONE_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  gate:         { fill: '#e0f2fe', stroke: '#0284c7', label: '#0c4a6e' },
  yard:         { fill: '#dbeafe', stroke: '#3b82f6', label: '#1e3a8a' },
  restricted:   { fill: '#fef3c7', stroke: '#d97706', label: '#78350f' },
  building:     { fill: '#f1f5f9', stroke: '#64748b', label: '#1e293b' },
  access_point: { fill: '#ede9fe', stroke: '#7c3aed', label: '#3b0764' },
  service:      { fill: '#f9fafb', stroke: '#9ca3af', label: '#374151' },
}

function getSignalColor(signal: Signal, threads: Thread[], selectedThreadId: string | null): string {
  const thread = threads.find(t => t.signalIds.includes(signal.id))
  if (!thread) return '#94a3b8'
  if (thread.id === selectedThreadId) return '#0284c7'
  const sev = thread.overriddenSeverity ?? thread.severity
  switch (sev) {
    case 'escalate': return '#ef4444'
    case 'watch':    return '#f59e0b'
    case 'noise':    return '#64748b'
    default:         return '#94a3b8'
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
    <svg viewBox="0 0 1000 700" className="w-full h-full" style={{ background: '#f1f5f9' }}>
      {/* Grid */}
      {Array.from({ length: 10 }, (_, i) => (
        <line key={`vg-${i}`} x1={i * 100} y1={0} x2={i * 100} y2={700} stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`hg-${i}`} x1={0} y1={i * 100} x2={1000} y2={i * 100} stroke="#e2e8f0" strokeWidth={1} />
      ))}

      {/* Site boundary */}
      <rect x={30} y={30} width={940} height={640} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="8,4" rx={4} />

      {/* Zone rectangles */}
      {zones.map(zone => {
        const size = ZONE_SIZES[zone.kind] ?? { w: 80, h: 50 }
        const colors = ZONE_COLORS[zone.kind] ?? ZONE_COLORS.building
        const isActive = selectedThread?.signalIds.some(sid =>
          signals.find(s => s.id === sid)?.zone === zone.id
        )
        return (
          <g key={zone.id}>
            <rect
              x={zone.x - size.w / 2}
              y={zone.y - size.h / 2}
              width={size.w}
              height={size.h}
              fill={colors.fill}
              stroke={isActive ? '#0284c7' : colors.stroke}
              strokeWidth={isActive ? 2.5 : 1.5}
              rx={4}
              opacity={0.95}
            />
            <text
              x={zone.x}
              y={zone.y - size.h / 2 - 5}
              textAnchor="middle"
              fill={colors.label}
              fontSize={9.5}
              fontFamily="monospace"
              fontWeight="600"
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
        opacity={0.4}
      />

      {/* Dispatched drone route */}
      {newDroneRoute && newDroneRoute.length > 1 && (
        <polyline
          points={newDroneRoute.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#0284c7"
          strokeWidth={2.5}
          strokeDasharray="4,3"
          opacity={0.9}
        />
      )}

      {/* Signal pins */}
      {signals.map(signal => {
        const color = getSignalColor(signal, threads, selectedThreadId)
        const isSelected = selectedSignalIds.has(signal.id)
        const r = isSelected ? 13 : 9
        return (
          <g key={signal.id} onClick={() => onSelectSignal(signal.id)} style={{ cursor: 'pointer' }}>
            {/* Shadow ring */}
            <circle cx={signal.x} cy={signal.y} r={r + 5} fill={color} opacity={isSelected ? 0.2 : 0.1} />
            {/* Pin body */}
            <circle
              cx={signal.x}
              cy={signal.y}
              r={r}
              fill={color}
              stroke="white"
              strokeWidth={isSelected ? 2.5 : 1.5}
              opacity={0.95}
            />
            {signal.type === 'badge_failure' && (
              <>
                <line x1={signal.x - 4.5} y1={signal.y - 4.5} x2={signal.x + 4.5} y2={signal.y + 4.5} stroke="white" strokeWidth={2} />
                <line x1={signal.x + 4.5} y1={signal.y - 4.5} x2={signal.x - 4.5} y2={signal.y + 4.5} stroke="white" strokeWidth={2} />
              </>
            )}
          </g>
        )
      })}

      {/* Labels for selected thread signals */}
      {signals.filter(s => selectedSignalIds.has(s.id)).map(signal => (
        <g key={`lbl-${signal.id}`} style={{ pointerEvents: 'none' }}>
          <rect
            x={signal.x + 15}
            y={signal.y - 8}
            width={signal.id.length * 6.5 + 6}
            height={16}
            fill="white"
            stroke="#cbd5e1"
            strokeWidth={1}
            rx={3}
            opacity={0.92}
          />
          <text
            x={signal.x + 18}
            y={signal.y + 4}
            fill="#0f172a"
            fontSize={9}
            fontFamily="monospace"
            fontWeight="600"
          >
            {signal.id}
          </text>
        </g>
      ))}

      {/* Legend */}
      <g transform="translate(38, 620)">
        <rect x={0} y={0} width={248} height={36} fill="white" stroke="#cbd5e1" strokeWidth={1} rx={4} opacity={0.95} />
        {[
          { color: '#ef4444', label: 'escalate',   dashed: false },
          { color: '#f59e0b', label: 'follow-up',  dashed: false },
          { color: '#64748b', label: 'noise',       dashed: false },
          { color: '#3b82f6', label: 'drone route', dashed: true  },
        ].map((item, i) => (
          <g key={item.label} transform={`translate(${10 + i * 60}, 18)`}>
            {item.dashed
              ? <line x1={0} y1={0} x2={12} y2={0} stroke={item.color} strokeWidth={2} strokeDasharray="3,2" />
              : <circle cx={5} cy={0} r={5} fill={item.color} stroke="white" strokeWidth={1} />
            }
            <text x={item.dashed ? 15 : 13} y={4} fill="#475569" fontSize={8.5} fontFamily="monospace">{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}
