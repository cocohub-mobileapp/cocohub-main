import type { PlatformOSType } from 'react-native';

export const getQRScannerCameraKey = (torchEnabled: boolean, os: PlatformOSType): string =>
  os === 'ios'
    ? `qr-scanner-camera-${torchEnabled ? 'torch-on' : 'torch-off'}`
    : 'qr-scanner-camera';
