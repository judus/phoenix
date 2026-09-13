import type {
  CommunicationMessage,
  CommunicationsResponse,
  LocalTrafficResponse
} from '@phoenix/contracts'

export type CommunicationQueryView = 'all' | 'inbox' | 'traffic'

export interface CommunicationRepository {
  listCommunicationMessages(view: CommunicationQueryView, limit: number): CommunicationMessage[]
  putCommunicationMessage(message: CommunicationMessage): void
  summarizeCommunications(view: CommunicationQueryView): CommunicationsResponse['summary']
}

export interface CommunicationDataReader {
  getCommunications(view?: CommunicationQueryView, limit?: number): CommunicationsResponse
}

export interface LocalTrafficReader {
  getLocalTraffic(limit?: number): LocalTrafficResponse
}
