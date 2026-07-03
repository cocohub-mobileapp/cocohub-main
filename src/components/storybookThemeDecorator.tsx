import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';

import { ThemeProvider, type ThemeMode, useTheme } from '../context/ThemeContext';

interface ThemeStoryFrameProps {
  children: React.ReactNode;
  mode?: ThemeMode;
  style?: ViewStyle;
}

const ThemedStoryContent: React.FC<ThemeStoryFrameProps> = ({
  children,
  mode = 'light',
  style,
}) => {
  const { colors, setMode } = useTheme();

  useEffect(() => {
    void setMode(mode);
  }, [mode, setMode]);

  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
};

export const ThemeStoryFrame: React.FC<ThemeStoryFrameProps> = (props) => (
  <ThemeProvider>
    <ThemedStoryContent {...props} />
  </ThemeProvider>
);
