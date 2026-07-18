import React, { useRef, useState, useEffect } from'react';
import { View, Text, TouchableOpacity, StyleSheet } from'react-native';
import { Camera } from 'expo-camera';

const QRScannerScreen = () => {
  const cameraRef = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [torch, setTorch] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const toggleTorch = async () => {
    if (cameraRef.current && hasPermission) {
      setTorch((prevTorch) =>!prevTorch);
      await cameraRef.current.setFlashMode(torch? Camera.Constants.FlashMode.off : Camera.Constants.FlashMode.torch);
    }
  };

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <Camera style={styles.camera} ref={cameraRef}>
        <View style={styles.torchButtonContainer}>
          <TouchableOpacity style={styles.torchButton} onPress={toggleTorch}>
            <Text style={styles.torchButtonText}>{torch? 'Torch On' : 'Torch Off'}</Text>
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  torchButtonContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  torchButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 5,
  },
  torchButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default QRScannerScreen;