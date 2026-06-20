import { NextRequest } from 'next/server'
import { store } from '@/lib/store'
import { executeTool } from '@/lib/tools'
import { DispatchResult } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { threadId, zone, reason } = await req.json()

  const thread = store.getThread(threadId)
  if (!thread) return Response.json({ error: 'Thread not found' }, { status: 404 })

  const result = await executeTool('dispatch_drone_mission', { zone, reason }) as DispatchResult

  const missions = thread.dispatchedMissions || []
  store.updateThread(threadId, {
    dispatchedMissions: [...missions, result]
  })

  return Response.json({ mission: result, thread: store.getThread(threadId) })
}
