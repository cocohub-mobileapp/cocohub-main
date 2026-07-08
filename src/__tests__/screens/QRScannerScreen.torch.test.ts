import { getQRScannerCameraKey } from '../../utils/qrScannerCamera';

describe('QRScannerScreen torch handling', () => {
  it('remounts the camera when torch changes on iOS', () => {
    expect(getQRScannerCameraKey(false, 'ios')).toBe('qr-scanner-camera-torch-off');
    expect(getQRScannerCameraKey(true, 'ios')).toBe('qr-scanner-camera-torch-on');
  });

  it('keeps a stable camera instance on Android', () => {
    expect(getQRScannerCameraKey(false, 'android')).toBe('qr-scanner-camera');
    expect(getQRScannerCameraKey(true, 'android')).toBe('qr-scanner-camera');
  });
});
