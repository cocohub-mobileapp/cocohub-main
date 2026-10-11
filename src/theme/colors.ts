import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';

export const lightTheme = {
  background: '#F5F0EB', // warm coco cream
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  text: '#1A1A1A',
  secondaryText: '#3D3028',
  placeholder: '#725B4C',
  border: '#E8DDD4',
  primary: '#C8854A', // coco caramel accent
  primaryMuted: '#FAF0E6',
  accent: '#8B5E3C', // deeper coco brown
  info: '#1565C0',
  infoMuted: '#E3F2FD',
  warning: '#92400E',
  error: '#C62828',
  success: '#2E7D32',
  notification: '#2E7D32',
  muted: '#EDE5DC',
  subtle: '#FAF7F4',
  input: '#FAF7F4',
  overlay: 'rgba(26,26,26,0.5)',
  shadow: '#1A1A1A',
  chartGrid: '#E8DDD4',
  chartAxis: '#8A7060',
  chartLine: '#C8854A',
  chartAnnotation: '#D32F2F',
  chartRangeFill: 'rgba(200,133,74,0.18)',
  white: '#FFFFFF',
};

export const darkTheme = {
  background: '#1A1A1A', // deep coco charcoal
  surface: '#242424',
  card: '#2A2420',
  cardElevated: '#2F2B28',
  text: '#F5F0EB',
  secondaryText: '#D4C4B4',
  placeholder: '#B49E8E',
  border: '#333333',
  primary: '#C8854A', // coco caramel accent
  primaryMuted: 'rgba(200,133,74,0.15)',
  accent: '#D4956A',
  info: '#90CAF9',
  infoMuted: '#102A43',
  warning: '#FBBF24',
  error: '#F87171',
  success: '#4CAF50',
  notification: '#4CAF50',
  muted: '#2A2420',
  subtle: '#1F1C1A',
  input: '#242424',
  overlay: 'rgba(0,0,0,0.72)',
  shadow: '#000000',
  chartGrid: '#333333',
  chartAxis: '#D4C4B4',
  chartLine: '#C8854A',
  chartAnnotation: '#FCA5A5',
  chartRangeFill: 'rgba(200,133,74,0.2)',
  white: '#FFFFFF',
};

export const navigationLightTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    background: lightTheme.background,
    card: lightTheme.surface,
    text: lightTheme.text,
    border: lightTheme.border,
    primary: lightTheme.primary,
    notification: lightTheme.notification,
  },
};

export const navigationDarkTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: darkTheme.background,
    card: darkTheme.card,
    text: darkTheme.text,
    border: darkTheme.border,
    primary: darkTheme.primary,
    notification: darkTheme.notification,
  },
};
