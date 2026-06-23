import { NextRequest } from 'next/server'
import { NIGHTS, signalsJun19 } from '@/lib/seed/signals'
import { clusterSignals } from '@/lib/cluster'
import { investigateCluster } from '@/lib/agent'
import { store } from '@/lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function sseOnce(data: object): Response {
  return new Response(`data: ${JSON.stringify(data)}\n\n`, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

export async function GET(req: NextRequest) {
  const day = req.nextUrl.searchParams.get('day') ?? '2026-06-19'
  const night = NIGHTS[day] ?? NIGHTS['2026-06-19']
  const signals = night?.signals ?? signalsJun19

  if (store.getStatus() === 'complete') {
    return sseOnce({ type: 'done', threads: store.getThreads() })
  }

  if (store.getStatus() === 'running') {
    return sseOnce({ type: 'running', threads: store.getThreads() })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        store.setStatus('running')
        store.setThreads([])
        store.clearLog()

        const clusters = clusterSignals(signals)
        send({ type: 'log', message: `Grouped ${signals.length} signals into ${clusters.length} clusters` })

        for (let i = 0; i < clusters.length; i++) {
          const cluster = clusters[i]
          const sigIds = cluster.map(s => s.id).join(', ')
          send({ type: 'log', message: `Cluster ${i + 1} (${sigIds}) — starting investigation...` })

          try {
            const thread = await investigateCluster(cluster, (msg) => {
              send({ type: 'log', message: msg })
              store.appendLog(msg)
            })
            store.setThreads([...store.getThreads(), thread])
            send({ type: 'thread', thread })
            send({ type: 'log', message: `Cluster ${i + 1} → ${thread.severity} (${thread.confidence} confidence)` })
          } catch (clusterErr) {
            send({ type: 'log', message: `Cluster ${i + 1} failed: ${String(clusterErr)} — skipping` })
          }
        }

        store.setStatus('complete')
        send({ type: 'done', threads: store.getThreads() })
      } catch (error) {
        send({ type: 'error', message: String(error) })
        store.setStatus('idle')
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

export async function DELETE() {
  store.setStatus('idle')
  store.setThreads([])
  store.clearLog()
  return Response.json({ ok: true })
}
