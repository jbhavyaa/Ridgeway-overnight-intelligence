import { Thread } from './types'

let threads: Thread[] = []
let investigationStatus: 'idle' | 'running' | 'complete' = 'idle'
let streamLog: string[] = []

export const store = {
  getThreads: () => threads,
  setThreads: (t: Thread[]) => { threads = t },
  getThread: (id: string) => threads.find(t => t.id === id),
  updateThread: (id: string, update: Partial<Thread>) => {
    threads = threads.map(t => t.id === id ? { ...t, ...update } : t)
  },
  getStatus: () => investigationStatus,
  setStatus: (s: 'idle' | 'running' | 'complete') => { investigationStatus = s },
  appendLog: (entry: string) => { streamLog.push(entry) },
  getLog: () => streamLog,
  clearLog: () => { streamLog = [] },
}
