import type { Mission, MissionsResponse } from '@phoenix/contracts'

export interface MissionRepository {
  getMission(id: number): Mission | null
  listMissions(): Mission[]
  putMission(mission: Mission): void
}

export interface MissionDataReader {
  getMissions(): MissionsResponse
}
