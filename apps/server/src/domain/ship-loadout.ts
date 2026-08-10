import type { CurrentShip } from '@phoenix/contracts'

export interface ShipLoadoutEnricher {
  enrich(ship: CurrentShip): CurrentShip
}

export const passThroughShipLoadoutEnricher: ShipLoadoutEnricher = {
  enrich: ship => ship
}
