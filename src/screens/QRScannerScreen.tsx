import type { BarCodeScannerResult } from 'expo-barcode-scanner';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import PermissionRationaleModal from '../components/PermissionRationaleModal';
import { generateQR, scanQRCode } from '../services/qrCodeService';
import { useSecureScreen } from '../utils/secureScreen';

interface QRScannerScreenProps {
  onScanSuccess: (data: string, petId?: string) => void;
  onClose: () => void;
  onManualEntry: () => void;
}

const QRScannerScreen: React.FC<QRScannerScreenProps> = ({
  onScanSuccess,
  onClose,
  onManualEntry,
}) => {
  useSecureScreen();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScanRef = useRef<number>(0);

  const [_permission, requestPermission] = useCameraPermissions();

  const requestCameraPermission = useCallback(async () => {
    try {
      const result = await requestPermission();
      const isGranted = result?.status === 'granted';
      setHasPermission(isGranted);

      if (!isGranted && Platform.OS === 'android') {
        setShowRationale(true);
      }
    } catch (err) {
      console.warn('Camera permission error:', err);
      setHasPermission(false);
    }
  }, [requestPermission]);

  useEffect(() => {
    void requestCameraPermission();

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timeout = scanTimeoutRef.current;
      if (timeout) clearTimeout(timeout);
    };
  }, [requestCameraPermission]);

  const handleBarCodeScanned = ({ data }: BarCodeScannerResult) => {
    // Debounce: prevent multiple scans within 500ms
    const now = Date.now();
    if (now - lastScanRef.current < 500) {
      return;
    }
    lastScanRef.current = now;

    if (scanned || !data) return;

    setScanned(true);

    void (async () => {
      const result = await scanQRCode(data);

      if (result.valid && result.petId) {
        onScanSuccess(data, result.petId);
      } else {
        const isExpiredOrUsed =
          result.error === 'This code has expired' ||
          result.error === 'This code has already been used' ||
          result.error === 'This code has been revoked';

        Alert.alert(
          isExpiredOrUsed ? 'Code No Longer Valid' : 'Invalid QR Code',
          result.error || 'This QR code is not a valid Cocohub record.',
          [
            { text: 'Try Again', onPress: () => setScanned(false) },
            { text: 'Manual Entry', onPress: onManualEntry },
            { text: 'Cancel', style: 'cancel', onPress: onClose },
          ],
        );
      }
    })();
  };

  const toggleTorch = () => setTorchEnabled(!torchEnabled);

  const handleMockScan = async () => {
    const payload = await generateQR({
      id: 'detox-qr-pet',
      name: 'Detox QR Pet',
      species: 'dog',
      breed: 'Labrador',
    });
    handleBarCodeScanned({ data: payload } as BarCodeScannerResult);
  };

  const handlePermissionDenied = () => {
    Alert.alert(
      'Camera Permission Required',
      'Please enable camera access in your device settings.',
      [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
        { text: 'Manual Entry', onPress: onManualEntry },
        { text: 'Cancel', style: 'cancel', onPress: onClose },
      ],
    );
  };

  const renderCameraView = () => {
    if (hasPermission === null) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      );
    }

    if (hasPermission === false) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Camera permission denied</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={handlePermissionDenied}>
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          enableTorch={torchEnabled}
          onBarcodeScanned={
            scanned
              ? undefined
              : (result) => handleBarCodeScanned({ data: result.data } as BarCodeScannerResult)
          }
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'datamatrix', 'pdf417'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.scanCorner, styles.topLeft]} />
              <View style={[styles.scanCorner, styles.topRight]} />
              <View style={[styles.scanCorner, styles.bottomLeft]} />
              <View style={[styles.scanCorner, styles.bottomRight]} />
              {scanned && (
                <View style={styles.scanningIndicator}>
                  <Text style={styles.scanningText}>Processing...</Text>
                </View>
              )}
            </View>
            <Text style={styles.scanText}>Align QR code within frame</Text>
          </View>
        </CameraView>

        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[styles.controlButton, torchEnabled && styles.controlButtonActive]}
            onPress={toggleTorch}
            accessibilityLabel="Toggle flashlight"
            accessibilityRole="button"
            testID="qr-scanner-torch-button"
          >
            <Text style={styles.controlButtonText}>💡</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={onManualEntry}
            accessibilityLabel="Manual entry"
            accessibilityRole="button"
            testID="qr-scanner-manual-entry-button"
          >
            <Text style={styles.controlButtonText}>📝</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <PermissionRationaleModal
        visible={showRationale}
        permissionType="camera"
        showSettings={hasPermission === false}
        onAllow={() => {
          setShowRationale(false);
          void requestCameraPermission();
        }}
        onDeny={() => {
          setShowRationale(false);
          setHasPermission(false);
        }}
      />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityLabel="Close scanner"
          accessibilityRole="button"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <View style={styles.placeholder} />
      </View>
      <View style={styles.scannerContainer} testID="qr-scanner-screen">
        {renderCameraView()}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Scan a Cocohub QR code to access pet records</Text>
        {__DEV__ && (
          <TouchableOpacity
            style={styles.mockScanButton}
            onPress={() => void handleMockScan()}
            accessibilityLabel="Mock QR scan"
            accessibilityRole="button"
            testID="qr-scanner-mock-scan-button"
          >
            <Text style={styles.manualEntryButtonText}>Mock Scan</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.manualEntryButton}
          onPress={onManualEntry}
          accessibilityLabel="Enter code manually"
          accessibilityRole="button"
          testID="qr-scanner-footer-manual-entry-button"
        >
          <Text style={styles.manualEntryButtonText}>Manual Entry</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  placeholder: { width: 40 },
  scannerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10B981',
  },
  topLeft: { top: -2, left: -2, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 16 },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 16,
  },
  scanningIndicator: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  scanningText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 120,
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '60%',
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderColor: '#10B981',
  },
  controlButtonText: { fontSize: 28 },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  footer: { backgroundColor: '#1F2937', padding: 20, alignItems: 'center' },
  footerText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  manualEntryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  mockScanButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  manualEntryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});

export default QRScannerScreen;
