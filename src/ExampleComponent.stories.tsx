import React from'react';
import { ThemeProvider } from '../src/context/ThemeContext';
import ExampleComponent from '../src/ExampleComponent';

export default {
  title: 'ExampleComponent',
  component: ExampleComponent,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export const Light = () => <ExampleComponent />;
export const Dark = () => {
  const { toggleTheme } = useTheme();
  toggleTheme(); // Switch to dark mode
  return <ExampleComponent />;
};
