import React, { useState } from 'react';

import EmailVerificationScreen from './EmailVerificationScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import ErrorBoundary from '../components/ErrorBoundary';
import type { AuthSession } from '../services/authService';

type Screen = 'login' | 'register' | 'forgot' | 'verify';

interface Props {
  /** Called when the user is fully authenticated (and verified). */
  onAuthenticated: (session: AuthSession) => void;
}

/**
 * Lightweight auth flow navigator using callback-prop pattern.
 * No external navigation library required.
 */
const AuthNavigator: React.FC<Props> = ({ onAuthenticated }) => {
  const [screen, setScreen] = useState<Screen>('login');
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);

  const handleAuthSuccess = (session: AuthSession) => {
    // After registration, require email verification before granting access.
    // Login skips verification (already verified or legacy account).
    if (screen === 'register') {
      setPendingSession(session);
      setScreen('verify');
    } else {
      onAuthenticated(session);
    }
  };

  const handleVerified = () => {
    if (pendingSession) onAuthenticated(pendingSession);
  };

  const handleSkipVerify = () => {
    if (pendingSession) onAuthenticated(pendingSession);
  };

  switch (screen) {
    case 'login':
      return (
        <ErrorBoundary>
          <LoginScreen
            onSuccess={handleAuthSuccess}
            onRegister={() => setScreen('register')}
            onForgotPassword={() => setScreen('forgot')}
          />
        </ErrorBoundary>
      );
    case 'register':
      return (
        <ErrorBoundary>
          <RegisterScreen onSuccess={handleAuthSuccess} onLogin={() => setScreen('login')} />
        </ErrorBoundary>
      );
    case 'forgot':
      return (
        <ErrorBoundary>
          <ForgotPasswordScreen onBack={() => setScreen('login')} />
        </ErrorBoundary>
      );
    case 'verify':
      return (
        <ErrorBoundary>
          <EmailVerificationScreen onVerified={handleVerified} onSkip={handleSkipVerify} />
        </ErrorBoundary>
      );
  }
};

export default AuthNavigator;
