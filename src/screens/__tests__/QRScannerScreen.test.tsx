import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import QRScannerScreen from '../QRScannerScreen';

jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return {
    CameraView: (props: any) => <View testID="mock-camera-view" {...props}>{props.children}</View>,
    useCameraPermissions: () => [{ status: 'granted' }, jest.fn().mockResolvedValue({ status: 'granted' })],
  };
});

describe('QRScannerScreen Torch Toggle (#51)', () => {
  it('toggles torchEnabled and updates flash prop on iOS and Android', () => {
    const onScanSuccess = jest.fn();
    const onClose = jest.fn();
    const onManualEntry = jest.fn();

    const { getByTestId } = render(
      <QRScannerScreen
        onScanSuccess={onScanSuccess}
        onClose={onClose}
        onManualEntry={onManualEntry}
      />
    );

    const torchBtn = getByTestId('torch-toggle-button');
    const camera = getByTestId('mock-camera-view');

    // Initially off
    expect(camera.props.enableTorch).toBe(false);
    expect(camera.props.flash).toBe('off');

    // Tap to toggle on
    fireEvent.press(torchBtn);
    expect(camera.props.enableTorch).toBe(true);
    expect(camera.props.flash).toBe('on');

    // Tap to toggle off
    fireEvent.press(torchBtn);
    expect(camera.props.enableTorch).toBe(false);
    expect(camera.props.flash).toBe('off');
  });
});
