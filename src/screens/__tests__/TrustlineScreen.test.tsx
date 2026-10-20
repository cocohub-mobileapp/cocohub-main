import React from 'react';
import { render } from '@testing-library/react-native';
import TrustlineScreen from '../TrustlineScreen';

// Mock react-native Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('TrustlineScreen (#43)', () => {
  it('renders correctly with Testnet badge and connect screen', () => {
    const onBack = jest.fn();
    const { getByText } = render(<TrustlineScreen onBack={onBack} />);

    expect(getByText('Stellar Trustlines')).toBeTruthy();
    expect(getByText('TESTNET')).toBeTruthy();
    expect(getByText('Connect Your Stellar Account')).toBeTruthy();
  });
});
