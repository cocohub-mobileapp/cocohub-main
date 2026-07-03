import type { Meta, StoryObj } from '@storybook/react';
import { Text, View } from 'react-native';

import OfflineIndicator from './OfflineIndicator';
import { ThemeStoryFrame } from './storybookThemeDecorator';

/**
 * `OfflineIndicator` — An animated banner that slides in from the top of the
 * screen to communicate network / sync state to the user.
 *
 * States:
 * - **Offline** — Red banner: "📴 Offline Mode"
 * - **Syncing** — Green banner: "🔄 Syncing changes..."
 * - **Pending** — Amber banner: "⏳ N changes pending sync"
 * - **Online / idle** — Hidden (renders `null`)
 *
 * The component subscribes to `offlineQueue` internally; no props are required.
 *
 * ### Usage
 * ```tsx
 * // Place near the root of your screen tree
 * <OfflineIndicator />
 * ```
 *
 * > **Note:** In Storybook the live `offlineQueue` service is not active, so
 * > the banner will not appear unless the queue emits a status change.
 * > The stories below wrap static mock banners to illustrate each visual state.
 */
const meta: Meta<typeof OfflineIndicator> = {
  title: 'Components/OfflineIndicator',
  component: OfflineIndicator,
  decorators: [
    (Story) => (
      <ThemeStoryFrame mode="light">
        <Story />
      </ThemeStoryFrame>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof OfflineIndicator>;

/** Live component — hidden when the device is online and queue is empty. */
export const Default: Story = {};

// ─── Static visual previews ──────────────────────────────────────────────────

const Banner = ({ bg, text }: { bg: string; text: string }) => (
  <View style={{ backgroundColor: bg, paddingVertical: 12, alignItems: 'center' }}>
    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{text}</Text>
  </View>
);

/** Visual preview of the offline (red) state. */
export const OfflineState: Story = {
  render: () => <Banner bg="#d32f2f" text="📴 Offline Mode" />,
};

/** Visual preview of the syncing (green) state. */
export const SyncingState: Story = {
  render: () => <Banner bg="#4CAF50" text="🔄 Syncing changes..." />,
};

/** Visual preview of the pending-sync (amber) state. */
export const PendingState: Story = {
  render: () => <Banner bg="#FFA000" text="⏳ 3 changes pending sync" />,
};
