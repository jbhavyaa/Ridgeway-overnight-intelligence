import { Signal } from './types'

const SPATIAL_THRESHOLD = 300  // SVG units — bridges gate→block→yard leg of vehicle path
const TEMPORAL_THRESHOLD = 20  // minutes — tight enough to exclude yard-a (28 min gap from intrusion cluster)

function svgDistance(a: Signal, b: Signal): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

function minutesDiff(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000
}

function isReachable(from: Signal, to: Signal): boolean {
  return (
    svgDistance(from, to) <= SPATIAL_THRESHOLD &&
    minutesDiff(from.ts, to.ts) <= TEMPORAL_THRESHOLD
  )
}

function expandCluster(seed: Signal, signals: Signal[], visited: Set<string>): Signal[] {
  const cluster: Signal[] = [seed]
  const queue: Signal[] = [seed]
  visited.add(seed.id)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const other of signals) {
      if (visited.has(other.id) || other.type === 'drone_patrol') continue
      if (isReachable(current, other)) {
        cluster.push(other)
        visited.add(other.id)
        queue.push(other)
      }
    }
  }

  return cluster
}

export function clusterSignals(signals: Signal[]): Signal[][] {
  const visited = new Set<string>()
  const clusters: Signal[][] = []

  for (const seed of signals) {
    if (visited.has(seed.id)) continue
    if (seed.type === 'drone_patrol') {
      visited.add(seed.id)
      clusters.push([seed])
      continue
    }
    clusters.push(expandCluster(seed, signals, visited))
  }

  return clusters
}
