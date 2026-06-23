import Anthropic from '@anthropic-ai/sdk'
import { getWeather, getAccessRecords, getShiftRoster, getZoneHistory, checkDroneCoverage, simulateDroneMission } from './seed/toolData'

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'get_weather',
    description: 'Get wind and weather conditions for a zone at a given timestamp',
    input_schema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        timestamp: { type: 'string', description: 'ISO timestamp' }
      },
      required: ['zone', 'timestamp']
    }
  },
  {
    name: 'get_access_records',
    description: 'Get badge access records for an access point within a time window',
    input_schema: {
      type: 'object',
      properties: {
        accessPoint: { type: 'string' },
        windowStart: { type: 'string' },
        windowEnd: { type: 'string' }
      },
      required: ['accessPoint', 'windowStart', 'windowEnd']
    }
  },
  {
    name: 'get_shift_roster',
    description: 'Get scheduled staff, contractors, and authorized vehicle movements for a date',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD' }
      },
      required: ['date']
    }
  },
  {
    name: 'get_zone_history',
    description: 'Get baseline activity frequency for a zone over the past N days',
    input_schema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        lookbackDays: { type: 'number' }
      },
      required: ['zone', 'lookbackDays']
    }
  },
  {
    name: 'check_drone_coverage',
    description: 'Check whether a drone patrol already covered a zone in a given window',
    input_schema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        windowStart: { type: 'string' },
        windowEnd: { type: 'string' }
      },
      required: ['zone', 'windowStart', 'windowEnd']
    }
  },
  {
    name: 'dispatch_drone_mission',
    description: 'Simulate a follow-up drone patrol to a zone and return observations and route',
    input_schema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        reason: { type: 'string' }
      },
      required: ['zone', 'reason']
    }
  }
]

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_weather':
      return getWeather(args.zone as string, args.timestamp as string)
    case 'get_access_records':
      return getAccessRecords(args.accessPoint as string, args.windowStart as string, args.windowEnd as string)
    case 'get_shift_roster':
      return getShiftRoster(args.date as string)
    case 'get_zone_history':
      return getZoneHistory(args.zone as string, args.lookbackDays as number)
    case 'check_drone_coverage':
      return checkDroneCoverage(args.zone as string, args.windowStart as string, args.windowEnd as string)
    case 'dispatch_drone_mission':
      return simulateDroneMission(args.zone as string, args.reason as string)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
