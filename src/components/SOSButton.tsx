import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { registerSOSNotification, cancelSOSNotification, triggerSOS } from '../services/emergencyService';

interface SOSButtonProps {
  emergencyContacts: string[];
  onSOSTriggered?: () => void;
}

export const SOSButton: React.FC<SOSButtonProps> = ({ emergencyContacts, onSOSTriggered }) => {
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Registra a notificação persistente quando contatos são configurados
    if (emergencyContacts && emergencyContacts.length > 0) {
      registerSOSNotification();
      setIsConfigured(true);
    } else {
      cancelSOSNotification();
      setIsConfigured(false);
    }
  }, [emergencyContacts]);

  const handlePress = async () => {
    if (!isConfigured) {
      Alert.alert('Aviso', 'Configure contatos de emergência primeiro.');
      return;
    }

    try {
      await triggerSOS(emergencyContacts);
      onSOSTriggered?.();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao acionar SOS.');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, !isConfigured && styles.disabled]}
      onPress={handlePress}
      disabled={!isConfigured}
    >
      <Text style={styles.text}>SOS</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FF0000',
    padding: 20,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    minHeight: 100,
  },
  disabled: {
    backgroundColor: '#CCCCCC',
  },
  text: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
