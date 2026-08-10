export const stationReferenceSchema = {
  additionalProperties: false,
  properties: {
    marketId: { description: 'Optional numeric market ID.', minimum: 0, type: 'integer' },
    stationName: { description: 'Optional station name. Defaults to the currently docked station.', type: 'string' },
    systemName: { description: 'Optional system name. Defaults to the current system.', type: 'string' }
  },
  type: 'object'
} as const
