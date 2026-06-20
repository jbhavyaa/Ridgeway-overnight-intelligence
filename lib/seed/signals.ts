import { Signal } from '../types'

export const signals: Signal[] = [
  { id: "SIG-01", type: "fence_alert",       ts: "2026-06-19T23:42:10", zone: "gate-3",  x: 895, y: 305, source: "perimeter_fence",  payload: { segment: "E-7", magnitude: "medium", duration_s: 3 } },
  { id: "SIG-02", type: "fence_alert",       ts: "2026-06-19T23:51:48", zone: "gate-3",  x: 905, y: 280, source: "perimeter_fence",  payload: { segment: "E-8", magnitude: "low", duration_s: 2 } },
  { id: "SIG-03", type: "gate_event",        ts: "2026-06-20T01:55:30", zone: "gate-2",  x: 500, y: 70,  source: "gate_controller",  payload: { event: "vehicle_gate_open", vehicle: "unmarked van", direction: "inbound", auth_ref: null } },
  { id: "SIG-04", type: "vehicle_detection", ts: "2026-06-20T02:05:12", zone: "block-b", x: 560, y: 330, source: "camera",           payload: { confidence: 0.82, heading: "SE", speed_kph: 18 } },
  { id: "SIG-05", type: "vehicle_detection", ts: "2026-06-20T02:10:44", zone: "yard-b",  x: 745, y: 445, source: "camera",           payload: { confidence: 0.88, heading: "E", note: "near restricted yard boundary" } },
  { id: "SIG-06", type: "badge_failure",     ts: "2026-06-20T02:18:04", zone: "ap-2",    x: 710, y: 480, source: "badge_reader",     payload: { badge_id: "C-4471", result: "denied" } },
  { id: "SIG-07", type: "badge_failure",     ts: "2026-06-20T02:18:31", zone: "ap-2",    x: 710, y: 480, source: "badge_reader",     payload: { badge_id: "C-4471", result: "denied" } },
  { id: "SIG-08", type: "badge_failure",     ts: "2026-06-20T02:19:02", zone: "ap-2",    x: 710, y: 480, source: "badge_reader",     payload: { badge_id: "C-4471", result: "denied" } },
  { id: "SIG-09", type: "drone_patrol",      ts: "2026-06-20T02:30:00", zone: "multi",   x: 500, y: 650, source: "drone",            payload: { patrol_id: "NP-118", start: "02:30:00", end: "03:05:00", waypoints: [{ zone:"drone-pad",x:500,y:640,t:"02:31" },{ zone:"block-b",x:460,y:310,t:"02:38" },{ zone:"block-c",x:655,y:515,t:"02:45" },{ zone:"yard-b",x:765,y:435,t:"02:48" },{ zone:"drone-pad",x:500,y:650,t:"03:04" }] } },
  { id: "SIG-10", type: "motion",            ts: "2026-06-20T02:33:09", zone: "yard-a",  x: 310, y: 400, source: "camera",           payload: { confidence: 0.71 } },
  { id: "SIG-11", type: "motion",            ts: "2026-06-20T02:41:22", zone: "yard-a",  x: 290, y: 425, source: "camera",           payload: { confidence: 0.64 } },
  { id: "SIG-12", type: "badge_failure",     ts: "2026-06-20T04:51:17", zone: "gate-1",  x: 120, y: 600, source: "badge_reader",     payload: { badge_id: "D-2290", result: "denied", note: "retry" } },
]
