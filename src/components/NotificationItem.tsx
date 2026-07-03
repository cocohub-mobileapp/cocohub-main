/**
 * NotificationItem — reusable row for the notification center.
 *
 * Renders read/unread distinction, category icon, timestamp, and handles
 * deep-link navigation via validated navPayload.
 */
import React, { memo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { AppNotification, NotificationCategory } from '../services/notificationStore';
import { useAppTheme } from '../theme';

// Re-export so existing imports from this file continue to work.
export { resolveNavPayload } from '../utils/notificationNavigation';

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_META: Record<NotificationCategory, { icon: string; label: string }> = {
  medication: { icon: '💊', label: 'Medication' },
  appointment: { icon: '📅', label: 'Appointment' },
  sos: { icon: '🆘', label: 'Emergency' },
  system: { icon: '🔔', label: 'System' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NotificationItemProps {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
  onLongPress?: (notification: AppNotification) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onPress,
  onLongPress,
  style,
  testID,
}: NotificationItemProps) {
  const colors = useAppTheme();
  const meta = CATEGORY_META[notification.category] ?? CATEGORY_META.system;

  const handlePress = useCallback(() => onPress(notification), [onPress, notification]);
  const handleLongPress = useCallback(
    () => onLongPress?.(notification),
    [onLongPress, notification],
  );

  return (
    <TouchableOpacity
      testID={testID ?? `notification-item-${notification.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${notification.title}. ${notification.isRead ? 'Read' : 'Unread'}`}
      accessibilityHint="Tap to open, long press for options"
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
        !notification.isRead && { backgroundColor: colors.primaryMuted },
        style,
      ]}
      activeOpacity={0.7}
    >
      {/* Unread indicator */}
      {!notification.isRead && (
        <View
          style={[styles.unreadDot, { backgroundColor: colors.primary }]}
          accessibilityElementsHidden
        />
      )}

      {/* Icon */}
      <Text style={styles.icon} accessibilityElementsHidden>
        {meta.icon}
      </Text>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { color: colors.text },
              !notification.isRead && styles.titleUnread,
            ]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text style={[styles.time, { color: colors.placeholder }]}>
            {formatRelativeTime(notification.createdAt)}
          </Text>
        </View>
        <Text style={[styles.body, { color: colors.secondaryText }]} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={[styles.category, { color: colors.placeholder }]}>{meta.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default memo(NotificationItem);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginEnd: 4,
    flexShrink: 0,
  },
  icon: {
    fontSize: 24,
    marginEnd: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontSize: 15,
    marginEnd: 8,
  },
  titleUnread: {
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    flexShrink: 0,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  category: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
