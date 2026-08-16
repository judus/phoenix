import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  staticDirs: ['../../web/public'],
  addons: [],
  framework: '@storybook/react-vite'
}

export default config
