import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Vibration,
  Platform,
} from 'react-native';

import emergencyService from '../services/emergencyService';
import haptics from '../utils/haptics';

interface SOSButtonProps {
  onSOSSent?: () => void;
  style?: object;
}

const SOSButton: React.FC<SOSButtonProps> = ({ onSOSSent, style }) => {
  const [isPressing, setIsPressing] = useState(false);
  const [isCountdown, setIsCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const pressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    void emergencyService.syncAndroidSOSLockScreenNotification();
  }, []);

  const triggerSOS = useCallback(async () => {
    setIsCountdown(false);
    setCountdown(3);
    Vibration.vibrate([0, 500, 200, 500]);
    void haptics.heavy(); // strong haptic on SOS fire
    try {
      await emergencyService.triggerSOS('Pet emergency - need immediate help');
      void haptics.success();
      if (onSOSSent) onSOSSent();
    } catch (error) {
      void haptics.error();
      console.error('SOS failed', error);
    }
  }, [onSOSSent]);

  useEffect(() => {
    if (isCountdown) {
      // Pulsing animation during countdown
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      const id = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(id);
            triggerSOS();
            return 0;
          }
          Vibration.vibrate(100);
          return prev - 1;
        });
      }, 1000);

      timerRef.current = id;
    } else {
      pulseAnim.setValue(1);
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isCountdown, pulseAnim, triggerSOS]);

  const handlePressIn = () => {
    setIsPressing(true);
    Vibration.vibrate(50);
    void haptics.heavy();
    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 1500, // Long press requirement: 1.5 seconds
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setIsPressing(false);
        setIsCountdown(true);
        Vibration.vibrate(200);
      }
    });
  };

  const handlePressOut = () => {
    if (!isCountdown) {
      setIsPressing(false);
      pressAnim.stopAnimation();
      pressAnim.setValue(0);
    }
  };

  const cancelSOS = () => {
    setIsCountdown(false);
    setCountdown(3);
    Vibration.vibrate(100);
  };

  const progressWidth = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (isCountdown) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.countdownButton, style]}
        onPress={cancelSOS}
        activeOpacity={0.9}
        testID="sos-confirm-dialog"
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Text style={styles.countdownText}>{countdown}</Text>
          <Text style={styles.cancelText} testID="sos-cancel-button">
            TAP TO CANCEL
          </Text>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.button}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID="sos-button"
      >
        <View style={styles.content}>
          <Text style={styles.buttonText}>🚨 SOS EMERGENCY</Text>
          <Text style={styles.hintText}>HOLD TO ACTIVATE</Text>
        </View>

        {isPressing && <Animated.View style={[styles.progressBar, { width: progressWidth }]} />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#e53e3e',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  button: {
    backgroundColor: '#e53e3e',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  countdownButton: {
    backgroundColor: '#1a202c', // Darker color during countdown
    borderRadius: 12,
  },
  content: {
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  hintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  countdownText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
  },
  cancelText: {
    color: '#e53e3e',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    height: 6,
    backgroundColor: '#feb2b2', // Light red for progress
  },
});

export default SOSButton;
