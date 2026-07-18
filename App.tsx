import React from'react';
import { StatusBar } from'react-native';
import { ThemeProvider } from './src/context/ThemeContext';
import ExampleComponent from './src/ExampleComponent';

const App: React.FC = () => {
  const { theme } = useTheme();

  return (
    <ThemeProvider>
      <StatusBar 
        barStyle={theme === 'light'? 'dark-content' : 'light-content'} 
        backgroundColor={theme === 'light'? colors.light.background : colors.dark.background} 
      />
      <ExampleComponent />
    </ThemeProvider>
  );
};

export default App;
