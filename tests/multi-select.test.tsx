import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { MultiSelect } from '../packages/ui/src/components/multi-select.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test('multi-select adds and clears selected values', () => {
  const change = vi.fn<(value: string[]) => void>()
  let renderer!: ReturnType<typeof create>
  act(() => {
    renderer = create(<MultiSelect
      onChange={change}
      options={[
        { label: 'Carbon dioxide', value: 'Carbon dioxide' },
        { label: 'Thin Argon', value: 'Thin Argon' }
      ]}
      value={[]}
    />)
  })

  const thinArgon = renderer.root.findAllByType('input').find(input => input.props.type === 'checkbox' && input.parent?.findByType('span').children.includes('Thin Argon'))
  expect(thinArgon).toBeDefined()
  act(() => thinArgon?.props.onChange())
  expect(change).toHaveBeenLastCalledWith(['Thin Argon'])

  act(() => renderer.update(<MultiSelect
    onChange={change}
    options={[
      { label: 'Carbon dioxide', value: 'Carbon dioxide' },
      { label: 'Thin Argon', value: 'Thin Argon' }
    ]}
    value={['Thin Argon']}
  />))
  act(() => renderer.root.findByProps({ children: 'Clear' }).props.onClick())
  expect(change).toHaveBeenLastCalledWith([])
})
