export type SignalType =
  | 'fence_alert' | 'gate_event' | 'vehicle_detection'
  | 'badge_failure' | 'drone_patrol' | 'motion'

export interface Signal {
  id: string
  type: SignalType
  ts: string
  zone: string
  x: number
  y: number
  source: 'perimeter_fence' | 'camera' | 'badge_reader' | 'gate_controller' | 'drone'
  payload: Record<string, unknown>
}

export type Severity = 'noise' | 'watch' | 'escalate'
export type Confidence = 'low' | 'medium' | 'high'
export type ThreadStatus = 'ai_draft' | 'approved' | 'overridden' | 'dismissed'

export interface EvidenceItem {
  tool: string
  input: Record<string, unknown>
  result: unknown
}

export interface Thread {
  id: string
  signalIds: string[]
  hypothesis: string
  confidence: Confidence
  severity: Severity
  evidence: EvidenceItem[]
  unknowns: string[]
  recommendation: string
  status: ThreadStatus
  overriddenSeverity?: Severity
  dispatchedMissions?: DispatchResult[]
}

export interface DispatchResult {
  missionId: string
  zone: string
  route: Array<{ x: number; y: number; t: string; zone: string }>
  observations: string[]
  timestamp: string
}
