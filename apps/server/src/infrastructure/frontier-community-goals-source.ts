import { z } from 'zod'
import { CommunityGoalSchema, type CommunityGoal } from '@phoenix/contracts'
import type { CommunityGoalsSource } from '../domain/community-goals.js'

const ENDPOINT = 'https://www.elitedangerous.com/elite-proxy/2.0/website/initiatives/list?lang=en'
const quantity = z.string().regex(/^\d+$/u).transform(Number)
const documentSchema = z.object({
  activeInitiatives: z.array(z.object({
    id: z.string(),
    title: z.string(),
    starsystem_name: z.string(),
    market_name: z.string(),
    activityType: z.string(),
    objective: z.string(),
    target_commodity_list: z.string(),
    qty: quantity,
    target_qty: quantity,
    expiry: z.string(),
    bulletin: z.string()
  }))
})

/** Public website endpoint, not Frontier's authenticated Companion API. */
export class FrontierCommunityGoalsSource implements CommunityGoalsSource {
  public constructor(private readonly request: typeof fetch = fetch) {}

  public async getCurrent(): Promise<CommunityGoal[]> {
    const response = await this.request(ENDPOINT, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(20_000)
    })
    if (!response.ok) throw new Error(`Frontier Community Goals request failed (${response.status}).`)
    const document = documentSchema.parse(await response.json())
    return document.activeInitiatives.map(goal => CommunityGoalSchema.parse({
      id: goal.id,
      title: goal.title,
      systemName: goal.starsystem_name,
      stationName: goal.market_name,
      activityType: goal.activityType,
      objective: goal.objective,
      targetCommodities: goal.target_commodity_list,
      contributed: goal.qty,
      target: goal.target_qty,
      expiry: goal.expiry,
      briefing: goal.bulletin
    }))
  }
}
