import type { CommunicationMessage, CommunicationsResponse } from '@phoenix/contracts'

export type CommunicationQueryView = 'all' | 'inbox' | 'traffic'

export interface CommunicationRepository {
  listCommunicationMessages(view: CommunicationQueryView, limit: number): CommunicationMessage[]
  putCommunicationMessage(message: CommunicationMessage): void
  summarizeCommunications(): CommunicationsResponse['summary']
}

export interface CommunicationDataReader {
  getCommunications(view?: CommunicationQueryView, limit?: number): CommunicationsResponse
}
