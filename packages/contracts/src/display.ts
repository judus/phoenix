import { z } from 'zod'

export const DISPLAY_PAGE_IDS = [
  'commander.dashboard',
  'commander.career',
  'commander.statistics',
  'commander.inventory',
  'commander.loadouts',
  'equipment.gear',
  'equipment.planner',
  'equipment.upgrades',
  'equipment.specialists',
  'equipment.materials',
  'fleet.current',
  'fleet.loadout',
  'fleet.cargo',
  'fleet.engineering',
  'fleet.overview',
  'fleet.carriers',
  'fleet.stored-modules',
  'fleet.catalogue',
  'galaxy.system',
  'galaxy.atlas',
  'galaxy.route',
  'galaxy.exobiology',
  'galaxy.database',
  'activities.missions',
  'activities.objectives',
  'activities.community-goals',
  'activities.powerplay',
  'activities.colonisation',
  'engineering.blueprints',
  'engineering.projects',
  'engineering.engineers',
  'engineering.materials-raw',
  'engineering.materials-manufactured',
  'engineering.materials-encoded',
  'engineering.materials-xeno',
  'comms.inbox',
  'comms.traffic',
  'comms.contacts',
  'comms.galnet',
  'comms.radio',
  'controls.ship',
  'controls.combat',
  'controls.navigation',
  'controls.vessel',
  'controls.srv',
  'controls.on-foot',
  'controls.radio',
  'controls.emote',
  'copilot.chat',
  'copilot.profiles',
  'numpad',
  'macros',
  'journal',
  'credits',
  'settings',
  'help',
  'developer.overview',
  'developer.runtime',
  'developer.elite',
  'developer.health',
  'developer.tests',
  'developer.controls'
] as const

export const DisplayPageIdSchema = z.enum(DISPLAY_PAGE_IDS)

const DisplayCommandBaseSchema = z.object({
  id: z.string().min(1),
  createdAt: z.iso.datetime()
})

export const AtlasDisplayLocationSchema = z.object({
  systemName: z.string().trim().min(1),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
})

export type AtlasDisplayLocation = z.infer<typeof AtlasDisplayLocationSchema>

export const DisplayCommandSchema = z.discriminatedUnion('type', [
  DisplayCommandBaseSchema.extend({
    type: z.literal('show_atlas'),
    location: AtlasDisplayLocationSchema
  }),
  DisplayCommandBaseSchema.extend({
    type: z.literal('open_page'),
    pageId: DisplayPageIdSchema
  }),
  DisplayCommandBaseSchema.extend({
    type: z.literal('show_system'),
    systemName: z.string().min(1),
    selectedName: z.string().min(1).nullable()
  }),
  DisplayCommandBaseSchema.extend({
    type: z.literal('show_body'),
    systemName: z.string().min(1),
    selectedName: z.string().min(1).nullable()
  })
])

export type DisplayCommand = z.infer<typeof DisplayCommandSchema>
export type DisplayPageId = z.infer<typeof DisplayPageIdSchema>
