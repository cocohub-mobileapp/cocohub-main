import React from 'react';

import ErrorFallback from './ErrorFallback';
import crashReporting from '../services/crashReporting';
import errorLogger from '../services/errorLogger';
import updateService from '../services/updateService';
import { encryptedAsyncStorage } from '../utils/encryptedAsyncStorage';

interface Props {
  children: React.ReactNode;
  context?: { screenName?: string; petId?: string; userId?: string };
}

interface State {
  hasError: boolean;
  error?: Error | null;
  info?: React.ErrorInfo | null;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error } as Partial<State>;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
    void errorLogger.logError(error, info.componentStack ?? '');
    // Report to Sentry with component stack as extra context
    crashReporting.captureException(error, {
      componentStack: info.componentStack ?? '',
    });
  }

  handleRetry = () => {
    // bump resetKey to force children remount
    this.setState((s) => ({ hasError: false, error: null, info: null, resetKey: s.resetKey + 1 }));
  };

  handleReport = async () => {
    if (this.state.error) {
      await errorLogger.logError(this.state.error, this.state.info?.componentStack ?? '');
      // feedback to user could be added
    }
  };

  handleClearCache = async () => {
    try {
      await encryptedAsyncStorage.clear();
    } catch {
      // ignore
    }
    // After clearing, offer retry by remounting
    this.handleRetry();
  };

  handleRestart = async () => {
    try {
      await updateService.applyOtaUpdate();
    } catch {
      // ignore
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          onRetry={this.handleRetry}
          onContactSupport={this.handleReport}
          onRestart={this.handleRestart}
          onClearCache={this.handleClearCache}
        />
      );
    }

    // key ensures children remount when resetKey changes
    return <React.Fragment key={String(this.state.resetKey)}>{this.props.children}</React.Fragment>;
  }
}

export default ErrorBoundary;
