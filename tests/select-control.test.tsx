import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Field, Select } from '@phoenix/ui'

test('single selects retain native field semantics with an inset decorative chevron', () => {
  const html = renderToStaticMarkup(<Field htmlFor="choice" label="Choice" error="Choose one"><Select className="form-mini" required value="a" onChange={() => undefined}><option value="a">A</option></Select></Field>)
  expect(html).toContain('class="select-control"')
  expect(html).toContain('id="choice"')
  expect(html).toContain('aria-invalid="true"')
  expect(html).toContain('aria-describedby="choice-message"')
  expect(html).toContain('class="form-select form-mini"')
  expect(html).toContain('svg aria-hidden="true"')
})

test('multiple and expanded native listboxes have no dropdown chevron', () => {
  for (const props of [{ multiple: true }, { size: 3 }]) {
    const html = renderToStaticMarkup(<Select {...props}><option>A</option></Select>)
    expect(html).not.toContain('select-control')
    expect(html).not.toContain('<svg')
  }
})
