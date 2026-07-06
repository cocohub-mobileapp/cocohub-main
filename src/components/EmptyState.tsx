import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  buttonText: string;
  onPress: () => void;
  /** Optional secondary action (e.g., "Learn more", "Import records") */
  secondaryText?: string;
  onSecondaryPress?: () => void;
  /** Optional emoji to show above the icon for more character */
  emoji?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  buttonText,
  onPress,
  secondaryText,
  onSecondaryPress,
  emoji,
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${description}`}
    >
      {emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : (
        <Ionicons name={icon} size={64} color={colors.placeholder} style={styles.icon} />
      )}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.secondaryText ?? colors.placeholder }]}>
        {description}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={buttonText}
      >
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
      {secondaryText && onSecondaryPress && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSecondaryPress}
          accessibilityRole="button"
          accessibilityLabel={secondaryText}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
            {secondaryText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  icon: { marginBottom: 16, opacity: 0.7 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 12,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
