import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test } from 'vitest'
import { SortableDataTable, type SortableDataTableColumn } from '@phoenix/ui'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

interface RecordRow { id: string, name: string, score: number | null }

const columns: readonly SortableDataTableColumn<RecordRow>[] = [
  { cell: row => row.name, heading: 'Name', id: 'name', rowHeader: true, sortValue: row => row.name },
  { cell: row => row.score ?? '—', className: 'numeric', heading: 'Score', id: 'score', sortValue: row => row.score },
  { cell: () => 'Open', heading: 'Actions', id: 'actions' }
]

test('sortable data tables cycle through ascending, descending, and source order', async () => {
  const rows = [
    { id: 'charlie', name: 'Charlie', score: 10 },
    { id: 'alpha', name: 'Alpha', score: null },
    { id: 'bravo', name: 'Bravo', score: 2 }
  ]
  let renderer!: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<SortableDataTable columns={columns} label="Test records" rowKey={row => row.id} rows={rows} />)
  })
  const scoreHeader = renderer.root.findAllByType('th').find(header => header.findAllByProps({ className: 'sort-heading' })[0]?.children.includes('Score'))!
  const scoreButton = scoreHeader.findByType('button')

  expect(renderedNames(renderer)).toEqual(['Charlie', 'Alpha', 'Bravo'])
  expect(scoreHeader.props['aria-sort']).toBeUndefined()
  expect(scoreHeader.findByProps({ className: 'sort-indicator' }).props['aria-hidden']).toBe('true')
  expect(renderer.root.findAllByType('th').find(header => header.children.includes('Actions'))!.findAllByType('button')).toHaveLength(0)

  await act(async () => scoreButton.props.onClick())
  expect(renderedNames(renderer)).toEqual(['Bravo', 'Charlie', 'Alpha'])
  expect(scoreHeader.props['aria-sort']).toBe('ascending')

  await act(async () => scoreButton.props.onClick())
  expect(renderedNames(renderer)).toEqual(['Charlie', 'Bravo', 'Alpha'])
  expect(scoreHeader.props['aria-sort']).toBe('descending')

  await act(async () => scoreButton.props.onClick())
  expect(renderedNames(renderer)).toEqual(['Charlie', 'Alpha', 'Bravo'])
  expect(scoreHeader.props['aria-sort']).toBeUndefined()

  await act(async () => renderer.unmount())
})

function renderedNames(renderer: ReturnType<typeof create>): string[] {
  return renderer.root.findByType('tbody').findAllByType('tr').map(row => String(row.findAllByType('th')[0]?.props.children))
}
