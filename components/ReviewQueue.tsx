'use client'

import { Thread, Severity } from '@/lib/types'
import ThreadCard from './ThreadCard'

interface Props {
  readonly threads: Thread[]
  readonly selectedThreadId: string | null
  readonly onSelectThread: (id: string) => void
  readonly onApprove: (id: string) => void
  readonly onChangeSeverity: (id: string, severity: Severity) => void
  readonly onDismiss: (id: string) => void
  readonly onDispatch: (id: string, zone: string, reason: string) => void
}

const severityOrder = { escalate: 0, watch: 1, noise: 2 }

export default function ReviewQueue({ threads, selectedThreadId, onSelectThread, onApprove, onChangeSeverity, onDismiss, onDispatch }: Props) {
  const sorted = [...threads].sort((a, b) => {
    const sa = severityOrder[a.overriddenSeverity ?? a.severity]
    const sb = severityOrder[b.overriddenSeverity ?? b.severity]
    return sa - sb
  })

  return (
    <div className="h-full overflow-y-auto">
      {sorted.map(thread => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          selected={thread.id === selectedThreadId}
          onSelect={() => onSelectThread(thread.id)}
          onApprove={() => onApprove(thread.id)}
          onChangeSeverity={(s) => onChangeSeverity(thread.id, s)}
          onDismiss={() => onDismiss(thread.id)}
          onDispatch={(zone, reason) => onDispatch(thread.id, zone, reason)}
        />
      ))}
    </div>
  )
}
