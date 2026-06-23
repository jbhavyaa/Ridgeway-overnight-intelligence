import { NextRequest } from 'next/server'
import { executeTool } from '@/lib/tools'
import { DispatchResult } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { zone, reason } = await req.json()
  const mission = await executeTool('dispatch_drone_mission', { zone, reason }) as DispatchResult
  return Response.json({ mission })
}
