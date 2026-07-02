import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';

import QRScannerScreen, { getCameraViewKey } from '../QRScannerScreen';

jest.mock('expo-camera', () => {
  const React = require('react');

  return {
    CameraView: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement('CameraView', props, children),
    useCameraPermissions: () => [
      { status: 'granted' },
      jest.fn().mockResolvedValue({ status: 'granted' }),
    ],
  };
});

jest.mock('../../services/qrCodeService', () => ({
  scanQRCode: jest.fn(),
}));

jest.mock('../../utils/secureScreen', () => ({
  useSecureScreen: jest.fn(),
}));

jest.mock('../../components/PermissionRationaleModal', () => {
  const React = require('react');

  return function PermissionRationaleModalMock() {
    return React.createElement('PermissionRationaleModal');
  };
});

describe('QRScannerScreen torch toggle', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('react-test-renderer is deprecated')
      ) {
        return;
      }
      console.warn(...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('uses iOS-specific camera keys so torch changes remount the native camera view', () => {
    Platform.OS = 'ios';

    expect(getCameraViewKey(false)).toBe('ios-camera-torch-off');
    expect(getCameraViewKey(true)).toBe('ios-camera-torch-on');
  });

  it('keeps a stable camera key on Android to avoid unnecessary remounts', () => {
    Platform.OS = 'android';

    expect(getCameraViewKey(false)).toBe('camera');
    expect(getCameraViewKey(true)).toBe('camera');
  });

  it('passes the toggled torch state to CameraView', async () => {
    Platform.OS = 'ios';

    let screen: renderer.ReactTestRenderer;

    await act(async () => {
      screen = renderer.create(
        <QRScannerScreen
          onScanSuccess={jest.fn()}
          onClose={jest.fn()}
          onManualEntry={jest.fn()}
        />,
      );
    });

    const getCamera = () => screen.root.findByType('CameraView');
    expect(getCamera().props.enableTorch).toBe(false);

    await act(async () => {
      screen.root.findByProps({ accessibilityLabel: 'Toggle flashlight' }).props.onPress();
    });

    expect(getCamera().props.enableTorch).toBe(true);
  });
});
