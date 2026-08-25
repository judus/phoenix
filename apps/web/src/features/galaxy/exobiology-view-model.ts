import type {
  ExplorationBodyRecord,
  ExplorationLedgerResponse,
  ExplorationOrganicSample
} from '@phoenix/contracts'

export interface ExobiologySampleViewModel {
  completed: boolean
  genus: string
  id: string
  progress: number
  species: string
  variant: string
}

export interface ExobiologyBodyViewModel {
  completed: number
  id: string
  name: string
  observedAt: string
  samples: ExobiologySampleViewModel[]
  total: number
}

export interface ExobiologySystemViewModel {
  bodies: ExobiologyBodyViewModel[]
  completed: number
  id: string
  name: string
  total: number
  updatedAt: string
}

export interface ExobiologyViewModel {
  completed: number
  systems: ExobiologySystemViewModel[]
  total: number
}

export function createExobiologyViewModel(ledger: ExplorationLedgerResponse): ExobiologyViewModel {
  const systems = ledger.systems
    .map(system => {
      const bodies = system.bodies
        .filter(hasBiologicalEvidence)
        .map(createBodyViewModel)
      return {
        bodies,
        completed: bodies.reduce((sum, body) => sum + body.completed, 0),
        id: system.address === null ? system.name.toLocaleLowerCase() : String(system.address),
        name: system.name,
        total: bodies.reduce((sum, body) => sum + body.total, 0),
        updatedAt: system.updatedAt
      }
    })
    .filter(system => system.bodies.length > 0)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))

  return {
    completed: systems.reduce((sum, system) => sum + system.completed, 0),
    systems,
    total: systems.reduce((sum, system) => sum + system.total, 0)
  }
}

function createBodyViewModel(body: ExplorationBodyRecord): ExobiologyBodyViewModel {
  const samples = biologicalSamples(body)
  return {
    completed: samples.filter(sample => sample.completed).length,
    id: body.key,
    name: body.name,
    observedAt: body.observedAt,
    samples,
    total: samples.length
  }
}

function biologicalSamples(body: ExplorationBodyRecord): ExobiologySampleViewModel[] {
  const manual = new Set(body.manualBiologicalCompletions.map(completion => completion.signalKey))

  if (body.biologicalSignals.length > 0) {
    return body.biologicalSignals.map(signal => {
      const sample = body.organicSamples.find(candidate => sameName(candidate.genus, signal.name))
      return sampleViewModel(signal.key, signal.name, sample, manual.has(signal.key))
    })
  }

  const recorded = body.organicSamples.map(sample => sampleViewModel(
    organismId(sample),
    sample.genus,
    sample,
    manual.has(sample.genus)
  ))
  const missing = Math.max(body.signals.biological - recorded.length, 0)
  return [
    ...recorded,
    ...Array.from({ length: missing }, (_, index) => {
      const id = `biological-signal-${index}`
      const completed = manual.has(id)
      return {
        completed,
        genus: missing === 1 ? 'Biological signal' : `Biological signal ${index + 1}`,
        id,
        progress: completed ? 3 : 0,
        species: 'Unknown',
        variant: 'Unknown'
      }
    })
  ]
}

function sampleViewModel(
  id: string,
  genus: string,
  sample: ExplorationOrganicSample | undefined,
  manuallyCompleted: boolean
): ExobiologySampleViewModel {
  return {
    completed: manuallyCompleted || sample?.completed === true,
    genus: sample?.genus ?? genus,
    id,
    progress: manuallyCompleted ? 3 : sample?.progress ?? 0,
    species: sample?.species ?? 'Unknown',
    variant: sample?.variant ?? 'Unknown'
  }
}

function hasBiologicalEvidence(body: ExplorationBodyRecord): boolean {
  return body.signals.biological > 0 || body.biologicalSignals.length > 0 || body.organicSamples.length > 0
}

function organismId(sample: ExplorationOrganicSample): string {
  return [sample.genus, sample.species, sample.variant].join('|').toLocaleLowerCase()
}

function sameName(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'base' }) === 0
}
