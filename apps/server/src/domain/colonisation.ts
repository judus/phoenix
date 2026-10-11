import type { ColonisationClaim, ColonisationContribution, ColonisationDepot, ColonisationResponse } from '@phoenix/contracts'

export interface ColonisationRepository {
  putDepot(depot: ColonisationDepot): void
  putClaim(claim: ColonisationClaim): void
  putContribution(contribution: ColonisationContribution): void
  read(): ColonisationResponse
}

export interface ColonisationReader { getColonisation(): ColonisationResponse }
