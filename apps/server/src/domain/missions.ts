import type { Mission, MissionRecord, MissionsResponse } from '@phoenix/contracts'

export interface MissionRepository {
  getMission(id: number): MissionRecord | null
  getMissionProjectionTimestamp(key: string): string | null
  listMissions(): MissionRecord[]
  putMission(mission: MissionRecord): void
  putMissionProjectionTimestamp(key: string, timestamp: string): void
}

export interface MissionDataReader {
  getMissions(): MissionsResponse
}

export interface MissionLookup {
  getMission(id: number): Mission | null
}
