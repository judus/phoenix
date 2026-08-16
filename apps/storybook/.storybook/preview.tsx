import type { Preview } from '@storybook/react-vite'

import '@phoenix/ui/styles.css'

const preview: Preview = {
  globalTypes: {
    presentation: {
      description: 'Visual presentation mode',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'phoenix', title: 'PHOENIX' },
          { value: 'elite', title: 'ELITE' }
        ],
        dynamicTitle: true
      }
    }
  },
  initialGlobals: {
    presentation: 'phoenix'
  },
  decorators: [
    (Story, context) => (
      <div className={`storybook-root presentation-${context.globals.presentation}`}>
        <Story />
      </div>
    )
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
}

export default preview
