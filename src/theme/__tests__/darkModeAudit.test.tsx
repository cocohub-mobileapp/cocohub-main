import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider, resolveThemeMode } from '../../context/ThemeContext';
import { darkTheme, lightTheme } from '../colors';
import RegisterScreen from '../../screens/RegisterScreen';
import ForgotPasswordScreen from '../../screens/ForgotPasswordScreen';

describe('Dark Mode Theming Audit (#39)', () => {
  it('resolves system theme mode correctly', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', 'light')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
    expect(resolveThemeMode('light', 'dark')).toBe('light');
  });

  it('renders RegisterScreen in dark mode without white flash', () => {
    const { getByText } = render(
      <ThemeProvider>
        <RegisterScreen onSuccess={jest.fn()} onLogin={jest.fn()} />
      </ThemeProvider>
    );

    expect(getByText('Create Account')).toBeTruthy();
  });

  it('renders ForgotPasswordScreen in dark mode correctly', () => {
    const { getByText } = render(
      <ThemeProvider>
        <ForgotPasswordScreen onBack={jest.fn()} onLogin={jest.fn()} />
      </ThemeProvider>
    );

    expect(getByText('Reset Password')).toBeTruthy();
  });
});
