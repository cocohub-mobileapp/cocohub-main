import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  type StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  buttonText: string;
  onPress: () => void;
  accessibilityHint?: string;
  buttonAccessibilityLabel?: string;
  /** Optional secondary action (e.g., "Learn more", "Import records") */
  secondaryText?: string;
  onSecondaryPress?: () => void;
  secondaryAccessibilityLabel?: string;
  secondaryAccessibilityHint?: string;
  /** Optional emoji to show above the icon for more character */
  emoji?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  buttonText,
  onPress,
  accessibilityHint,
  buttonAccessibilityLabel,
  secondaryText,
  onSecondaryPress,
  secondaryAccessibilityLabel,
  secondaryAccessibilityHint,
  emoji,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const buttonTextColor = getContrastingTextColor(colors.primary);

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      <View
        style={[
          styles.illustration,
          {
            backgroundColor: colors.primaryMuted,
            borderColor: colors.border,
          },
        ]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : (
          <Ionicons name={icon} size={44} color={colors.primary} />
        )}
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.secondaryText ?? colors.placeholder }]}>
        {description}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={buttonAccessibilityLabel ?? buttonText}
      >
        <Text style={[styles.buttonText, { color: buttonTextColor }]}>{buttonText}</Text>
      </TouchableOpacity>
      {secondaryText && onSecondaryPress && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSecondaryPress}
          accessibilityRole="button"
          accessibilityLabel={secondaryAccessibilityLabel ?? secondaryText}
          accessibilityHint={secondaryAccessibilityHint}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
            {secondaryText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const parseHexColor = (color: string): [number, number, number] | null => {
  const match = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;

  const value =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : match[1];

  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const channelLuminance = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = ([red, green, blue]: [number, number, number]): number =>
  0.2126 * channelLuminance(red) +
  0.7152 * channelLuminance(green) +
  0.0722 * channelLuminance(blue);

const contrastRatio = (
  foreground: [number, number, number],
  background: [number, number, number],
): number => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const getContrastingTextColor = (backgroundColor: string): string => {
  const background = parseHexColor(backgroundColor);
  const lightText = parseHexColor('#FFFFFF');
  const darkText = parseHexColor('#1A1A1A');

  if (!background || !lightText || !darkText) return '#FFFFFF';

  return contrastRatio(darkText, background) >= contrastRatio(lightText, background)
    ? '#1A1A1A'
    : '#FFFFFF';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
    width: '100%',
  },
  illustration: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emoji: {
    fontSize: 46,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  description: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
