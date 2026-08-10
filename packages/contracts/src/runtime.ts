import { z } from 'zod'
import { EliteGameStatusSchema } from './elite-status.js'

export const RuntimeLocationStateSchema = z.enum([
  'unknown',
  'docked',
  'landed',
  'in_space',
  'supercruise',
  'hyperspace',
  'on_foot',
  'in_suit',
  'in_srv'
])

export const CommanderRanksSchema = z.object({
  combat: z.number().int().nonnegative().nullable(),
  trade: z.number().int().nonnegative().nullable(),
  exploration: z.number().int().nonnegative().nullable(),
  federation: z.number().int().nonnegative().nullable(),
  empire: z.number().int().nonnegative().nullable(),
  cqc: z.number().int().nonnegative().nullable(),
  mercenary: z.number().int().nonnegative().nullable(),
  exobiologist: z.number().int().nonnegative().nullable()
})

export const CommanderRankProgressSchema = z.object({
  combat: z.number().int().min(0).max(100).nullable(),
  trade: z.number().int().min(0).max(100).nullable(),
  exploration: z.number().int().min(0).max(100).nullable(),
  federation: z.number().int().min(0).max(100).nullable(),
  empire: z.number().int().min(0).max(100).nullable(),
  cqc: z.number().int().min(0).max(100).nullable(),
  mercenary: z.number().int().min(0).max(100).nullable(),
  exobiologist: z.number().int().min(0).max(100).nullable()
})

export const NamedGameValueSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).nullable()
})

export const FactionSummarySchema = z.object({
  name: z.string().min(1),
  state: z.string().min(1).nullable(),
  government: z.string().min(1).nullable(),
  allegiance: z.string().min(1).nullable(),
  influence: z.number().min(0).max(1).nullable(),
  happiness: NamedGameValueSchema.nullable(),
  reputation: z.number().finite().nullable()
})

export const CurrentSystemSchema = z.object({
  name: z.string().min(1).nullable(),
  address: z.number().int().nonnegative().nullable(),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).nullable(),
  allegiance: z.string().min(1).nullable(),
  government: NamedGameValueSchema.nullable(),
  primaryEconomy: NamedGameValueSchema.nullable(),
  secondaryEconomy: NamedGameValueSchema.nullable(),
  security: NamedGameValueSchema.nullable(),
  population: z.number().int().nonnegative().nullable(),
  controllingFaction: FactionSummarySchema.nullable(),
  factions: z.array(FactionSummarySchema),
  powerplay: z.object({
    controllingPower: z.string().min(1).nullable(),
    powers: z.array(z.string().min(1)),
    state: z.string().min(1).nullable(),
    controlProgress: z.number().finite().nullable(),
    reinforcement: z.number().finite().nullable(),
    undermining: z.number().finite().nullable()
  }).nullable()
})

export const StationLocationSchema = z.object({
  kind: z.literal('station'),
  name: z.string().min(1),
  type: z.string().min(1).nullable(),
  marketId: z.number().int().nonnegative().nullable(),
  faction: FactionSummarySchema.nullable(),
  government: NamedGameValueSchema.nullable(),
  primaryEconomy: NamedGameValueSchema.nullable(),
  economies: z.array(z.object({
    economy: NamedGameValueSchema,
    proportion: z.number().finite().nonnegative().nullable()
  })),
  services: z.array(z.string().min(1))
})

export const BodyLocationSchema = z.object({
  kind: z.literal('body'),
  name: z.string().min(1),
  id: z.number().int().nonnegative().nullable(),
  type: z.string().min(1).nullable()
})

export const CurrentPlaceSchema = z.discriminatedUnion('kind', [
  StationLocationSchema,
  BodyLocationSchema
])

export const CurrentLocationSchema = z.object({
  state: RuntimeLocationStateSchema,
  place: CurrentPlaceSchema.nullable()
})

export const RuntimeStateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime().nullable(),
  commander: z.object({
    name: z.string().min(1).nullable(),
    ranks: CommanderRanksSchema,
    rankProgress: CommanderRankProgressSchema
  }),
  system: CurrentSystemSchema,
  location: CurrentLocationSchema,
  ship: z.object({
    name: z.string().min(1).nullable(),
    type: z.string().min(1).nullable()
  }),
  gameStatus: EliteGameStatusSchema.nullable()
})

const GameEventEnvelopeBaseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  gameTimestamp: z.iso.datetime().nullable(),
  ingestedAt: z.iso.datetime(),
  source: z.enum(['synthetic', 'journal', 'status'])
})

export const GameEventEnvelopeSchema = z.discriminatedUnion('type', [
  GameEventEnvelopeBaseSchema.extend({
    type: z.literal('commander.identity_changed'),
    payload: z.object({
      name: z.string().min(1)
    })
  }),
  GameEventEnvelopeBaseSchema.extend({
    type: z.literal('commander.ranks_changed'),
    payload: CommanderRanksSchema
  }),
  GameEventEnvelopeBaseSchema.extend({
    type: z.literal('commander.rank_progress_changed'),
    payload: CommanderRankProgressSchema
  }),
  GameEventEnvelopeBaseSchema.extend({
    type: z.literal('system.changed'),
    payload: CurrentSystemSchema
  }),
  GameEventEnvelopeBaseSchema.extend({
    type: z.literal('location.changed'),
    payload: CurrentLocationSchema
  }),
  GameEventEnvelopeBaseSchema.extend({
    type: z.literal('ship.identity_changed'),
    payload: z.object({
      name: z.string().min(1).nullable(),
      type: z.string().min(1)
    })
  }),
  GameEventEnvelopeBaseSchema.extend({
    type: z.literal('game.status_changed'),
    payload: EliteGameStatusSchema
  })
])

export type GameEventEnvelope = z.infer<typeof GameEventEnvelopeSchema>
export type CurrentLocation = z.infer<typeof CurrentLocationSchema>
export type CurrentSystem = z.infer<typeof CurrentSystemSchema>
export type FactionSummary = z.infer<typeof FactionSummarySchema>
export type NamedGameValue = z.infer<typeof NamedGameValueSchema>
export type RuntimeLocationState = z.infer<typeof RuntimeLocationStateSchema>
export type RuntimeState = z.infer<typeof RuntimeStateSchema>

export function createEmptyRuntimeState (): RuntimeState {
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: null,
    commander: {
      name: null,
      ranks: emptyCommanderRanks(),
      rankProgress: emptyCommanderRanks()
    },
    system: emptyCurrentSystem(),
    location: {
      state: 'unknown',
      place: null
    },
    ship: {
      name: null,
      type: null
    },
    gameStatus: null
  }
}

function emptyCurrentSystem () {
  return {
    name: null,
    address: null,
    position: null,
    allegiance: null,
    government: null,
    primaryEconomy: null,
    secondaryEconomy: null,
    security: null,
    population: null,
    controllingFaction: null,
    factions: [],
    powerplay: null
  }
}

function emptyCommanderRanks () {
  return {
    combat: null,
    trade: null,
    exploration: null,
    federation: null,
    empire: null,
    cqc: null,
    mercenary: null,
    exobiologist: null
  }
}
