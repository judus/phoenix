import type { Mission, MissionsResponse } from '@phoenix/contracts'

export interface MissionRepository {
  getMission(id: number): Mission | null
  getMissionProjectionTimestamp(key: string): string | null
  listMissions(): Mission[]
  putMission(mission: Mission): void
  putMissionProjectionTimestamp(key: string, timestamp: string): void
}

export interface MissionDataReader {
  getMissions(): MissionsResponse
}
