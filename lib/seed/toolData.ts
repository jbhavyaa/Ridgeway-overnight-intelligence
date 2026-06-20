// Weather data indexed by hour string
const weatherData: Record<string, unknown> = {
  "2026-06-19T23:00": { wind_kph: 48, gust_kph: 54, dir: "E", note: "strong easterly gusts" },
  "2026-06-20T00:00": { wind_kph: 44, gust_kph: 50, dir: "E" },
  "2026-06-20T01:00": { wind_kph: 26, gust_kph: 30, dir: "ENE" },
  "2026-06-20T02:00": { wind_kph: 12, gust_kph: 15, dir: "calm" },
  "2026-06-20T04:00": { wind_kph: 8,  gust_kph: 10, dir: "calm" },
}

export function getWeather(zone: string, ts: string) {
  // Find the closest hourly bucket
  const hour = ts.substring(0, 13) + ":00"
  return weatherData[hour] || weatherData[Object.keys(weatherData).reduce((a, b) =>
    Math.abs(new Date(a).getTime() - new Date(ts).getTime()) < Math.abs(new Date(b).getTime() - new Date(ts).getTime()) ? a : b
  )]
}

export function getAccessRecords(point: string, windowStart: string, windowEnd: string) {
  const allRecords = [
    { ts: "2026-06-20T01:55:30", point: "gate-2", event: "vehicle_gate_open", badge: null, note: "Unmarked van, no auth_ref — possible tailgate behind scheduled delivery that never arrived. No vehicle logged in advance." },
    { ts: "2026-06-20T02:01:14", point: "gate-2", event: "personnel_exit", badge: "C-4471", note: "M. Halder badge exit — shift end recorded 02:01, consistent with 22:00–02:00 shift" },
    { ts: "2026-06-20T02:18:04", point: "ap-2",   event: "badge_denied", badge: "C-4471", note: "C-4471 denied — badge already exited gate-2 at 02:01" },
    { ts: "2026-06-20T02:18:31", point: "ap-2",   event: "badge_denied", badge: "C-4471", note: "C-4471 denied — second attempt" },
    { ts: "2026-06-20T02:19:02", point: "ap-2",   event: "badge_denied", badge: "C-4471", note: "C-4471 denied — third attempt" },
    { ts: "2026-06-20T04:51:17", point: "gate-1", event: "badge_denied", badge: "D-2290", note: "D-2290 denied — arrival before 05:00 grace window" },
    { ts: "2026-06-20T05:03:44", point: "gate-1", event: "badge_granted", badge: "D-2290", note: "D-2290 granted on grace — day shift early arrival confirmed" },
  ]
  return allRecords.filter(r => {
    const matchPoint = !point || r.point === point
    const afterStart = !windowStart || r.ts >= windowStart
    const beforeEnd = !windowEnd || r.ts <= windowEnd
    return matchPoint && afterStart && beforeEnd
  })
}

export function getShiftRoster(date: string) {
  return {
    date: "2026-06-19",
    entries: [
      { name: "Raghav Menon", role: "Night Supervisor", shift: "22:00-06:00", signed_off: "05:45" },
      { name: "M. Halder", role: "Contractor (ContractCo)", badge: "C-4471", authorized_zones: ["block-b"], shift: "22:00-02:00", purpose: "workshop equipment install" },
      { name: "SiteClean crew (x3)", role: "Cleaning", badge_group: "SC-*", authorized_zones: ["yard-a","block-b"], shift: "02:00-04:00" },
      { name: "D. Okafor", role: "Day shift (early)", badge: "D-2290", authorized_zones: ["gate-1","block-a","yard-a"], shift: "05:00-13:00" }
    ],
    scheduled_vehicle_movements: [],
    authorized_overnight_entries_yard_b: []
  }
}

export function getZoneHistory(zone: string, lookbackDays: number) {
  const histories: Record<string, unknown> = {
    "gate-3": {
      zone,
      lookbackDays,
      summary: "14 of 16 fence alert events in the past 14 days occurred during east wind conditions above 40 kph. All were determined to be wind-induced fence flex. No confirmed intrusion events in past 90 days.",
      baseline: "fence_alerts_during_east_wind: HIGH (benign pattern)"
    },
    "yard-a": {
      zone,
      lookbackDays,
      summary: "Motion events in yard-a between 02:00–04:00 occur approximately 4x per week. Correlates with SiteClean crew shift. No unexplained motion events in the past 30 days.",
      baseline: "motion_02_to_04: EXPECTED (cleaning crew pattern)"
    },
    "yard-b": {
      zone,
      lookbackDays,
      summary: "Zero legitimate overnight activity in Restricted Yard B in past 90 days. Any vehicle or personnel presence 22:00–06:00 is anomalous. Access Point 2 denials are extremely rare — 1 prior incident in 6 months, determined false badge.",
      baseline: "overnight_activity: NONE EXPECTED"
    },
    "ap-2": {
      zone,
      lookbackDays,
      summary: "Badge denials at AP-2 are extremely rare — 1 incident in 6 months. Triple denial in under 2 minutes has no prior precedent.",
      baseline: "badge_denials: VERY RARE"
    },
    "gate-1": {
      zone,
      lookbackDays,
      summary: "Early badge attempts before grace window (05:00) occur roughly once per month. All prior incidents resolved on grace re-scan within 15 minutes.",
      baseline: "early_arrival_denials: OCCASIONAL (benign pattern)"
    }
  }
  return histories[zone] || { zone, lookbackDays, summary: "No history available for this zone.", baseline: "unknown" }
}

export function checkDroneCoverage(zone: string, windowStart: string, windowEnd: string) {
  const coverage: Record<string, unknown> = {
    "block-c": {
      zone,
      window: { start: windowStart, end: windowEnd },
      patrol: "NP-118",
      pass_time: "02:45",
      findings: "Exterior nominal. No forced entry detected. No personnel visible on exterior perimeter.",
      coverage_gaps: ["Interior of Block C was NOT entered or imaged — exterior pass only", "26-minute unobserved window: 02:19–02:45 before drone arrived"],
    },
    "yard-b": {
      zone,
      window: { start: windowStart, end: windowEnd },
      patrol: "NP-118",
      pass_time: "02:48",
      findings: "Perimeter gate closed at time of pass. No personnel detected in yard at 02:48.",
      coverage_gaps: ["Vehicle seen at 02:10 — exit route NOT observed by drone", "26-minute unobserved window: 02:10–02:48 for vehicle activity"],
    },
    "ap-2": {
      zone,
      window: { start: windowStart, end: windowEnd },
      patrol: "NP-118",
      pass_time: null,
      findings: "AP-2 was NOT included in NP-118 patrol route. No drone coverage for AP-2 during this window.",
      coverage_gaps: ["AP-2 interior and access panel entirely unobserved during overnight"],
    }
  }
  return coverage[zone] || {
    zone,
    window: { start: windowStart, end: windowEnd },
    findings: "No drone coverage data available for this zone in the specified window.",
    coverage_gaps: ["Zone not covered in overnight patrol"]
  }
}

export function simulateDroneMission(zone: string, reason: string): {
  missionId: string
  zone: string
  route: Array<{ x: number; y: number; t: string; zone: string }>
  observations: string[]
  timestamp: string
} {
  return {
    missionId: `DM-${Date.now()}`,
    zone,
    route: [
      { x: 500, y: 650, t: "06:15", zone: "drone-pad" },
      { x: 650, y: 520, t: "06:19", zone: "block-c" },
      { x: 710, y: 480, t: "06:22", zone: "ap-2" },
      { x: 500, y: 650, t: "06:28", zone: "drone-pad" },
    ],
    observations: [
      "Block C exterior door sealed, no signs of forced entry",
      "AP-2 access panel intact, no damage detected",
      "Area clear of personnel at time of sweep",
      `Follow-up triggered by: ${reason}`
    ],
    timestamp: new Date().toISOString()
  }
}
