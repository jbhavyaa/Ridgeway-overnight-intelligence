import Groq from 'groq-sdk'
import { getWeather, getAccessRecords, getShiftRoster, getZoneHistory, checkDroneCoverage, simulateDroneMission } from './seed/toolData'

export const toolDefinitions: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get wind and weather conditions for a zone at a given timestamp',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string' },
          timestamp: { type: 'string', description: 'ISO timestamp' }
        },
        required: ['zone', 'timestamp']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_access_records',
      description: 'Get badge access records for an access point within a time window',
      parameters: {
        type: 'object',
        properties: {
          accessPoint: { type: 'string' },
          windowStart: { type: 'string' },
          windowEnd: { type: 'string' }
        },
        required: ['accessPoint', 'windowStart', 'windowEnd']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_shift_roster',
      description: 'Get scheduled staff, contractors, and authorized vehicle movements for a date',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' }
        },
        required: ['date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_zone_history',
      description: 'Get baseline activity frequency for a zone over the past N days',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string' },
          lookbackDays: { type: 'number' }
        },
        required: ['zone', 'lookbackDays']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_drone_coverage',
      description: 'Check whether a drone patrol already covered a zone in a given window',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string' },
          windowStart: { type: 'string' },
          windowEnd: { type: 'string' }
        },
        required: ['zone', 'windowStart', 'windowEnd']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'dispatch_drone_mission',
      description: 'Simulate a follow-up drone patrol to a zone and return observations and route',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['zone', 'reason']
      }
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
