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

export const RuntimeStateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime().nullable(),
  commander: z.object({
    name: z.string().min(1).nullable()
  }),
  location: z.object({
    state: RuntimeLocationStateSchema,
    systemName: z.string().min(1).nullable(),
    placeName: z.string().min(1).nullable()
  }),
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
    type: z.literal('location.changed'),
    payload: z.object({
      state: RuntimeLocationStateSchema,
      systemName: z.string().min(1).nullable(),
      placeName: z.string().min(1).nullable()
    })
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
export type RuntimeLocationState = z.infer<typeof RuntimeLocationStateSchema>
export type RuntimeState = z.infer<typeof RuntimeStateSchema>

export function createEmptyRuntimeState (): RuntimeState {
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: null,
    commander: { name: null },
    location: {
      state: 'unknown',
      systemName: null,
      placeName: null
    },
    ship: {
      name: null,
      type: null
    },
    gameStatus: null
  }
}
