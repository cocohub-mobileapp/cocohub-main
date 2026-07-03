import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';

import { RetryError } from './RetryError';
import { ThemeStoryFrame } from './storybookThemeDecorator';

/**
 * `RetryError` — An inline error state component with a retry button and
 * attempt counter. Disables the retry button once `maxRetries` is reached.
 *
 * ### Props
 * | Prop | Type | Default | Description |
 * |------|------|---------|-------------|
 * | `error` | `Error` | — | The error to display |
 * | `onRetry` | `() => void` | — | Called when the user taps Retry |
 * | `retryCount` | `number` | `0` | Current attempt number |
 * | `maxRetries` | `number` | `3` | Maximum allowed retries |
 *
 * ### Usage
 * ```tsx
 * <RetryError
 *   error={new Error('Network request failed')}
 *   onRetry={refetch}
 *   retryCount={attempt}
 *   maxRetries={3}
 * />
 * ```
 */
const meta: Meta<typeof RetryError> = {
  title: 'Components/RetryError',
  component: RetryError,
  decorators: [
    (Story) => (
      <ThemeStoryFrame mode="light" style={{ padding: 24 }}>
        <Story />
      </ThemeStoryFrame>
    ),
  ],
  argTypes: {
    retryCount: { control: { type: 'range', min: 0, max: 5, step: 1 } },
    maxRetries: { control: { type: 'range', min: 1, max: 5, step: 1 } },
  },
};

export default meta;

type Story = StoryObj<typeof RetryError>;

/** First failure — retry button visible, no attempt counter shown. */
export const FirstFailure: Story = {
  args: {
    error: new Error('Network request failed'),
    onRetry: action('onRetry'),
    retryCount: 0,
    maxRetries: 3,
  },
};

/** Second attempt — shows "Attempt 2 of 3". */
export const SecondAttempt: Story = {
  args: {
    error: new Error('Connection timed out'),
    onRetry: action('onRetry'),
    retryCount: 2,
    maxRetries: 3,
  },
};

/** Max retries reached — retry button is hidden, exhaustion message shown. */
export const MaxRetriesReached: Story = {
  args: {
    error: new Error('Service unavailable'),
    onRetry: action('onRetry'),
    retryCount: 3,
    maxRetries: 3,
  },
};

/** Dark mode preview for inline retry errors. */
export const Dark: Story = {
  args: {
    error: new Error('Network request failed'),
    onRetry: action('dark-onRetry'),
    retryCount: 1,
    maxRetries: 3,
  },
  render: (args) => (
    <ThemeStoryFrame mode="dark" style={{ padding: 24 }}>
      <RetryError {...args} />
    </ThemeStoryFrame>
  ),
};
