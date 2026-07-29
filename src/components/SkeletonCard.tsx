import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

import { useAppTheme } from '../theme';

interface SkeletonCardProps {
  /**
   * Height of the skeleton card (default: 90, matching card dimensions)
   */
  height?: number;

  /**
   * Whether to show as a full width card with padding
   */
  isFullWidth?: boolean;

  /**
   * Custom style overrides
   */
  style?: ViewStyle;

  /**
   * Number of text lines to show in the skeleton (default: 3)
   */
  lines?: number;

  /**
   * Gap between lines in pixels (default: 8)
   */
  lineGap?: number;
}

/**
 * SkeletonCard Component
 *
 * Displays an animated skeleton (shimmer) placeholder while content loads.
 * Uses react-native-reanimated for smooth animations.
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  height = 90,
  isFullWidth = true,
  style,
  lines = 3,
  lineGap = 8,
}) => {
  const colors = useAppTheme();
  const shimmerAnim = useSharedValue(0);

  useEffect(() => {
    shimmerAnim.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, [shimmerAnim]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmerAnim.value, [0, 1], [0.3, 0.7], Extrapolate.CLAMP);
    return {
      opacity,
    };
  });

  // Calculate line heights for skeleton text lines
  const skeletonLines = Array.from({ length: lines }).map((_, i) => ({
    id: i,
    width: i === lines - 1 ? '60%' : '100%', // last line is shorter
  }));

  const contentHeight = lines * 14 + (lines - 1) * lineGap; // 14px font, gaps between
  const spacing = Math.max(12, (height - contentHeight) / 2);

  return (
    <View style={[styles.container, isFullWidth && styles.fullWidth, { height, backgroundColor: colors.surface, shadowColor: colors.shadow }, style]}>
      {/* Avatar/Image placeholder */}
      <Animated.View style={[styles.avatar, animatedStyle, { backgroundColor: colors.muted }]} />

      {/* Content area with skeleton lines */}
      <View style={[styles.content, { paddingVertical: spacing }]}>
        {skeletonLines.map((line) => (
          <Animated.View
            key={line.id}
            style={[
              styles.skeletonLine,
              {
                width: line.width as any,
                backgroundColor: colors.muted,
                marginBottom: line.id < lines - 1 ? lineGap : 0,
              },
              animatedStyle,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  fullWidth: {
    width: '100%',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
  },
});
