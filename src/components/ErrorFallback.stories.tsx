import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';

import ErrorFallback from './ErrorFallback';
import { ThemeStoryFrame } from './storybookThemeDecorator';

/**
 * `ErrorFallback` — A full-screen error recovery UI displayed when the app
 * encounters an unhandled exception.
 *
 * Provides multiple recovery options:
 * - **Retry**: Attempt to recover from the error
 * - **Contact Support**: Opens email client with pre-filled error report
 * - **Clear Cache**: Removes all cached data to resolve corruption issues
 * - **Restart App**: Applies OTA update or forces app restart
 *
 * ### Props
 * | Prop | Type | Default | Description |
 * |------|------|---------|-------------|
 * | `onRetry` | `() => void` | — | Callback to retry the failed operation |
 * | `onContactSupport` | `() => void` | — | Optional custom support handler |
 * | `onRestart` | `() => void` | — | Optional custom restart handler |
 * | `onClearCache` | `() => void` | — | Optional custom cache clear handler |
 *
 * ### Usage
 * ```tsx
 * <ErrorBoundary FallbackComponent={ErrorFallback}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
const meta: Meta<typeof ErrorFallback> = {
  title: 'Components/ErrorFallback',
  component: ErrorFallback,
  decorators: [
    (Story) => (
      <ThemeStoryFrame mode="light">
        <Story />
      </ThemeStoryFrame>
    ),
  ],
  argTypes: {
    onRetry: { action: 'retry' },
    onContactSupport: { action: 'contactSupport' },
    onRestart: { action: 'restart' },
    onClearCache: { action: 'clearCache' },
  },
};

export default meta;

type Story = StoryObj<typeof ErrorFallback>;

/** Default error fallback with all recovery options. */
export const Default: Story = {
  args: {
    onRetry: action('onRetry'),
    onContactSupport: action('onContactSupport'),
    onRestart: action('onRestart'),
    onClearCache: action('onClearCache'),
  },
};

/** With custom handlers for all actions. */
export const CustomHandlers: Story = {
  args: {
    onRetry: action('custom-retry'),
    onContactSupport: action('custom-support'),
    onRestart: action('custom-restart'),
    onClearCache: action('custom-clear-cache'),
  },
};

/** Minimal configuration with only retry handler. */
export const MinimalConfig: Story = {
  args: {
    onRetry: action('onRetry'),
  },
};

/** Dark mode preview using the same theme provider as the app. */
export const Dark: Story = {
  args: {
    onRetry: action('dark-onRetry'),
    onContactSupport: action('dark-onContactSupport'),
    onRestart: action('dark-onRestart'),
    onClearCache: action('dark-onClearCache'),
  },
  render: (args) => (
    <ThemeStoryFrame mode="dark">
      <ErrorFallback {...args} />
    </ThemeStoryFrame>
  ),
};
