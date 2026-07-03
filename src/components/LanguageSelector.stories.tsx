import type { Meta, StoryObj } from '@storybook/react';
import { I18nextProvider } from 'react-i18next';

import LanguageSelector from './LanguageSelector';
import { ThemeStoryFrame } from './storybookThemeDecorator';
import i18n from '../i18n';

const meta: Meta<typeof LanguageSelector> = {
  title: 'Components/LanguageSelector',
  component: LanguageSelector,
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <ThemeStoryFrame mode="light" style={{ padding: 24 }}>
          <Story />
        </ThemeStoryFrame>
      </I18nextProvider>
    ),
  ],
  parameters: {
    notes:
      'Accessible language selection control with button hints and localized labels for screen readers.',
  },
};

export default meta;

type Story = StoryObj<typeof LanguageSelector>;

export const Default: Story = {};

export const Dark: Story = {
  render: () => (
    <ThemeStoryFrame mode="dark" style={{ padding: 24 }}>
      <LanguageSelector />
    </ThemeStoryFrame>
  ),
};
