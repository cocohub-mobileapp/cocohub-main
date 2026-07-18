import React from'react';
import { View, Text, StyleSheet } from'react-native';
import { useTheme } from '../context/ThemeContext';

const ExampleComponent: React.FC = () => {
  const { theme } = useTheme();
  const { background, text } = theme === 'light'? colors.light : colors.dark;

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <Text style={[styles.text, { color: text }]}>Hello, World!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
  }
});

export default ExampleComponent;
