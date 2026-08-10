import { z } from 'zod'
import {
  CargoInventorySchema,
  EliteInventoryFileSnapshotSchema,
  MicroResourceInventorySchema,
  type CargoInventory,
  type EliteInventoryFileSnapshot,
  type MicroResourceInventory
} from '@phoenix/contracts'

const CargoFileSchema = z.object({
  timestamp: z.iso.datetime(),
  event: z.literal('Cargo'),
  Vessel: z.string().optional(),
  Inventory: z.array(z.object({
    Name: z.string().min(1),
    Name_Localised: z.string().min(1).optional(),
    Count: z.number().int().nonnegative(),
    Stolen: z.number().int().nonnegative().optional().default(0),
    MissionID: z.number().int().nonnegative().optional()
  }).passthrough()).optional().default([])
}).passthrough()

const MicroResourceSchema = z.object({
  Name: z.string().min(1),
  Name_Localised: z.string().min(1).optional(),
  Count: z.number().int().nonnegative(),
  OwnerID: z.number().int().nonnegative().optional(),
  MissionID: z.number().int().nonnegative().optional()
}).passthrough()

const MicroResourceFileSchema = z.object({
  timestamp: z.iso.datetime(),
  event: z.enum(['Backpack', 'BackpackMaterials', 'ShipLocker']),
  Items: z.array(MicroResourceSchema).optional().default([]),
  Components: z.array(MicroResourceSchema).optional().default([]),
  Consumables: z.array(MicroResourceSchema).optional().default([]),
  Data: z.array(MicroResourceSchema).optional().default([])
}).passthrough()

export function parseCargoInventory (candidate: unknown): CargoInventory {
  const cargo = CargoFileSchema.parse(candidate)
  return CargoInventorySchema.parse({
    updatedAt: cargo.timestamp,
    vessel: normalizeVessel(cargo.Vessel),
    items: cargo.Inventory.map(item => ({
      id: item.Name,
      label: item.Name_Localised ?? null,
      count: item.Count,
      stolen: item.Stolen,
      missionId: item.MissionID ?? null
    }))
  })
}

export function parseMicroResourceInventory (candidate: unknown): MicroResourceInventory {
  const inventory = MicroResourceFileSchema.parse(candidate)
  const mapItems = (items: z.infer<typeof MicroResourceSchema>[]) => items.map(item => ({
    id: item.Name,
    label: item.Name_Localised ?? null,
    count: item.Count,
    ownerId: item.OwnerID ?? null,
    missionId: item.MissionID ?? null
  }))
  return MicroResourceInventorySchema.parse({
    updatedAt: inventory.timestamp,
    items: mapItems(inventory.Items),
    components: mapItems(inventory.Components),
    consumables: mapItems(inventory.Consumables),
    data: mapItems(inventory.Data)
  })
}

export function parseEliteInventoryFile (candidate: unknown): EliteInventoryFileSnapshot {
  const event = z.object({ event: z.string().min(1) }).parse(candidate).event
  if (event === 'Cargo') {
    return EliteInventoryFileSnapshotSchema.parse({ kind: 'cargo', payload: parseCargoInventory(candidate) })
  }
  if (event === 'ShipLocker') {
    return EliteInventoryFileSnapshotSchema.parse({
      kind: 'ship_locker',
      payload: parseMicroResourceInventory(candidate)
    })
  }
  if (event === 'Backpack' || event === 'BackpackMaterials') {
    return EliteInventoryFileSnapshotSchema.parse({ kind: 'backpack', payload: parseMicroResourceInventory(candidate) })
  }
  throw new Error(`Unsupported Elite inventory file event: ${event}.`)
}

function normalizeVessel (vessel: string | undefined): CargoInventory['vessel'] {
  const normalized = vessel?.trim().toLowerCase()
  if (normalized === 'ship' || normalized === 'srv') return normalized
  return 'unknown'
}
