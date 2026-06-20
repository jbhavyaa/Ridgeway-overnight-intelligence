import { store } from '@/lib/store'

export async function GET() {
  return Response.json({ threads: store.getThreads(), status: store.getStatus() })
}
