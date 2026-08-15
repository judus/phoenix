import type { CSSProperties } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import '../src/styles/foundations.css'

const colors = [
  ['Canvas', '--color-canvas'],
  ['Surface', '--color-surface'],
  ['Strong surface', '--color-surface-strong'],
  ['Subtle surface', '--color-surface-subtle'],
  ['Action', '--color-action'],
  ['Information', '--color-information'],
  ['Text', '--color-text'],
  ['Muted text', '--color-text-muted'],
  ['Danger', '--color-danger'],
  ['Border', '--color-border'],
  ['Subtle border', '--color-border-subtle'],
  ['Focus', '--color-focus']
] as const

const sizes = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const

function tokenStyle(token: string): CSSProperties {
  return { '--token-value': `var(${token})` } as CSSProperties
}

function Foundations() {
  return (
    <main className="foundations">
      <header>
        <h1>PHOENIX foundations</h1>
        <p className="text-muted">
          Extracted from the current interface, normalized into reusable semantic scales.
        </p>
      </header>

      <section>
        <h2>Semantic colors</h2>
        <div className="token-grid">
          {colors.map(([label, token]) => (
            <article className="color-token" key={token}>
              <i style={tokenStyle(token)} />
              <div className="token-label">
                <strong>{label}</strong>
                <code>{token}</code>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Type scale</h2>
        <div className="type-scale">
          {sizes.map((size) => {
            const token = `--font-size-${size}`
            return (
              <article className="scale-token" key={token}>
                <div className="token-label">
                  <strong>{size.toUpperCase()}</strong>
                  <code>{token}</code>
                </div>
                <span className="sample" style={tokenStyle(token)}>Flight systems nominal</span>
              </article>
            )
          })}
        </div>
      </section>

      <section>
        <h2>Spacing scale</h2>
        <div className="spacing-scale">
          {sizes.map((size) => {
            const token = `--spacing-${size}`
            return (
              <article className="scale-token" key={token}>
                <div className="token-label">
                  <strong>{size.toUpperCase()}</strong>
                  <code>{token}</code>
                </div>
                <i className="sample" style={tokenStyle(token)} />
              </article>
            )
          })}
        </div>
      </section>

      <section>
        <h2>Responsive scale</h2>
        <p className="text-muted">
          Viewport and container scales share names and values. Components prefer container queries;
          viewport queries are reserved for shell-level behavior.
        </p>
        <div className="token-grid">
          {sizes.map((size) => (
            <article className="responsive-token" key={size}>
              <strong>{size.toUpperCase()}</strong>
              <code>{`--breakpoint-${size}`}</code>
              <code>{`--container-${size}`}</code>
            </article>
          ))}
        </div>
        <div className="orientation-demo">
          <div className="layout">
            <div>Landscape arrangement</div>
            <div>Portrait collapse</div>
          </div>
        </div>
      </section>
    </main>
  )
}

const meta = {
  title: 'Foundations/Tokens',
  component: Foundations,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof Foundations>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {}
