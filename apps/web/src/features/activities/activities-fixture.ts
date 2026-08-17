import { MissionsResponseSchema, type Mission, type MissionsResponse } from '@phoenix/contracts'

export type ReviewActivityView = 'objectives' | 'community-goals' | 'powerplay' | 'colonisation'

export interface ActivityReviewRecord {
  description: string
  facts: Array<{ label: string, value: string }>
  id: string
  locationName?: string
  status: string
  statusTone: 'neutral' | 'information' | 'positive' | 'warning' | 'danger' | 'muted'
  systemName?: string
  title: string
}

export function activityReviewFixture(view: ReviewActivityView): ActivityReviewRecord[] {
  return reviewFixtures[view]
}

const reviewFixtures: Record<ReviewActivityView, ActivityReviewRecord[]> = {
  objectives: [
    {
      id: 'exploration-loadout',
      title: 'Prepare long-range exploration vessel',
      description: 'Configure the Type-11 Prospector for sustained survey work.',
      status: 'Tracking',
      statusTone: 'information',
      systemName: 'Shinrarta Dezhra',
      locationName: 'Jameson Memorial',
      facts: [
        { label: 'Priority', value: 'High' },
        { label: 'Target', value: 'Type-11 Prospector' },
        { label: 'Progress', value: '6 of 8 modules ready' },
        { label: 'Evidence', value: 'Fixture data' }
      ]
    },
    {
      id: 'survey-route',
      title: 'Survey plotted route',
      description: 'Record valuable bodies and biological signals along the active route.',
      status: 'Planned',
      statusTone: 'muted',
      systemName: 'HIP 115894',
      facts: [
        { label: 'Priority', value: 'Normal' },
        { label: 'Progress', value: '0 of 19 systems surveyed' },
        { label: 'Evidence', value: 'Fixture data' }
      ]
    }
  ],
  'community-goals': [
    {
      id: 'relief-supplies',
      title: 'Supply emergency relief commodities',
      description: 'Deliver relief supplies before the current contribution period closes.',
      status: 'Active',
      statusTone: 'positive',
      systemName: 'HIP 115894',
      locationName: 'Cavalieri',
      facts: [
        { label: 'Contribution', value: '1,240 t' },
        { label: 'Tier', value: 'Top 50%' },
        { label: 'Reward', value: '12,500,000 CR' },
        { label: 'Expiry', value: 'Aug 20, 2026, 07:00 AM' },
        { label: 'Evidence', value: 'Fixture data' }
      ]
    }
  ],
  powerplay: [
    {
      id: 'reinforce-system',
      title: 'Reinforce strategic system',
      description: 'Earn merits supporting the current reinforcement objective.',
      status: 'Active',
      statusTone: 'warning',
      systemName: 'LHS 20',
      locationName: 'Ohm City',
      facts: [
        { label: 'Power', value: 'A. Lavigny-Duval' },
        { label: 'Mode', value: 'Reinforcement' },
        { label: 'Merits', value: '420' },
        { label: 'Cycle', value: 'Closes in 3 days' },
        { label: 'Evidence', value: 'Fixture data' }
      ]
    }
  ],
  colonisation: [
    {
      id: 'primary-starport',
      title: 'Complete primary starport',
      description: 'Deliver construction commodities to the developing primary port.',
      status: 'Construction',
      statusTone: 'information',
      systemName: 'Col 285 Sector OK-C b14-5',
      locationName: 'Colonisation Ship',
      facts: [
        { label: 'Architect', value: 'Phoenix Initiative' },
        { label: 'Progress', value: '64%' },
        { label: 'Remaining resources', value: '8 commodities' },
        { label: 'Contributions', value: '3,840 t' },
        { label: 'Evidence', value: 'Fixture data' }
      ]
    }
  ]
}

const observed = {
  acceptanceObserved: true,
  details: 'complete' as const,
  snapshotObserved: true,
  sources: ['historical-journal'] as const,
  terminalObserved: false
}

export function activitiesFixture(): MissionsResponse {
  const missions: Mission[] = [
    mission(6101, 'active', 'Deliver emergency power cells', {
      commodity: 'Emergency Power Cells', commodityCount: 24,
      destinationSystem: 'HIP 115894', destinationStation: 'Cavalieri',
      expiry: '2026-08-16T23:30:00Z', faction: 'HIP 115894 Industries', reward: 842000,
      progress: { collected: 24, delivered: 8, required: 24 }
    }),
    mission(6102, 'active', 'Eliminate pirate vessels', {
      destinationSystem: 'Col 285 Sector FD-G b12-0', faction: 'Union of Col 285',
      killCount: 12, reward: 1260000, targetFaction: 'Black Flag Crew'
    }),
    mission(6103, 'completed', 'Courier encrypted data', {
      completedAt: '2026-08-16T18:42:00Z', destinationSystem: 'Atata', destinationStation: 'Sagan Port',
      faction: 'Atata Exchange', reward: 315000
    }),
    mission(6104, 'failed', 'Recover a lost black box', {
      destinationSystem: 'Shute', faction: 'Shute Defence Party', failedAt: '2026-08-15T22:04:00Z', reward: 680000
    }),
    mission(6105, 'abandoned', 'Source insulating membrane', {
      abandonedAt: '2026-08-15T19:20:00Z', commodity: 'Insulating Membrane', commodityCount: 18,
      destinationSystem: 'Capricorni Sector DG-X b1-1', faction: 'Capricorni Logistics', reward: 490000
    }),
    {
      ...mission(6106, 'unknown', 'Mission details not observed', {
        destinationSystem: '—', faction: null, reward: null
      }),
      acceptedAt: null,
      provenance: {
        acceptanceObserved: false,
        details: 'partial',
        snapshotObserved: true,
        sources: ['startup-snapshot'],
        terminalObserved: false
      }
    }
  ]

  return MissionsResponseSchema.parse({
    missions,
    summary: {
      abandoned: 1,
      active: 2,
      completed: 1,
      failed: 1,
      partial: 1,
      total: missions.length,
      unknown: 1
    }
  })
}

function mission(
  id: number,
  status: Mission['status'],
  title: string,
  changes: Partial<Mission>
): Mission {
  const timestamp = '2026-08-16T20:00:00.000Z'
  const terminal = status !== 'active' && status !== 'unknown'
  return {
    acceptedAt: '2026-08-16T17:00:00.000Z',
    abandonedAt: null,
    commodity: null,
    commodityCount: null,
    completedAt: null,
    destinationSettlement: null,
    destinationStation: null,
    destinationSystem: null,
    donated: null,
    donation: null,
    expiry: null,
    faction: null,
    failedAt: null,
    id,
    influence: null,
    killCount: null,
    localizedName: title,
    name: null,
    passengerCount: null,
    progress: { collected: null, delivered: null, required: null },
    provenance: { ...observed, terminalObserved: terminal, sources: ['historical-journal'] },
    redirectedAt: null,
    reputation: null,
    reward: null,
    status,
    statusUpdatedAt: timestamp,
    target: null,
    targetFaction: null,
    targetType: null,
    updatedAt: timestamp,
    wing: false,
    ...changes
  }
}
