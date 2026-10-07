import type { CommunityGoal, CommunityGoalsResponse } from '@phoenix/contracts'

export interface CommunityGoalsSource {
  getCurrent(): Promise<CommunityGoal[]>
}

export interface CommunityGoalsReader {
  getCurrent(): Promise<CommunityGoalsResponse>
}
