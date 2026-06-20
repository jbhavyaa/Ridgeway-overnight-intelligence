import { NextRequest } from 'next/server'
import { store } from '@/lib/store'
import { Severity } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { threadId, action, severity } = body

  const thread = store.getThread(threadId)
  if (!thread) return Response.json({ error: 'Thread not found' }, { status: 404 })

  switch (action) {
    case 'approve':
      store.updateThread(threadId, { status: 'approved' })
      break
    case 'change_severity':
      store.updateThread(threadId, {
        status: 'overridden',
        overriddenSeverity: severity as Severity
      })
      break
    case 'dismiss':
      store.updateThread(threadId, { status: 'dismissed' })
      break
  }

  return Response.json({ thread: store.getThread(threadId) })
}
