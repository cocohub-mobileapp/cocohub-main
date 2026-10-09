import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Example picker
import { findConflicts, APPOINTMENT_CONFIG } from '../services/appointmentService';
import { Appointment } from '../types';
import { fetchAppointments, saveAppointment } from '../api/appointmentApi'; // Assuming API helpers

interface AppointmentScreenProps {
  navigation: any;
  route: any;
}

const AppointmentScreen: React.FC<AppointmentScreenProps> = ({ navigation, route }) => {
  const initialAppointment = route.params?.appointment || null;
  
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [bufferMinutes, setBufferMinutes] = useState<number>(APPOINTMENT_CONFIG.DEFAULT_BUFFER_MINUTES);
  
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [conflicts, setConflicts] = useState<Appointment[]>([]);

  useEffect(() => {
    // Load existing appointments for conflict checking
    const loadAppointments = async () => {
      try {
        const appointments = await fetchAppointments();
        setExistingAppointments(appointments);
      } catch (error) {
        console.error("Failed to load appointments", error);
      }
    };
    loadAppointments();

    if (initialAppointment) {
      setStartTime(initialAppointment.startTime.toTimeString().slice(0, 5));
      setEndTime(initialAppointment.endTime.toTimeString().slice(0, 5));
      setClientName(initialAppointment.clientName);
      setIsRecurring(initialAppointment.isRecurring);
    }
  }, [initialAppointment]);

  const validateAndSave = async () => {
    if (!startTime || !endTime || !clientName) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    const startDateTime = new Date();
    const [startH, startM] = startTime.split(':').map(Number);
    startDateTime.setHours(startH, startM);

    const endDateTime = new Date();
    const [endH, endM] = endTime.split(':').map(Number);
    endDateTime.setHours(endH, endM);

    if (endDateTime <= startDateTime) {
      Alert.alert("Error", "End time must be after start time.");
      return;
    }

    const newAppointment: Appointment = {
      id: initialAppointment?.id || `temp-${Date.now()}`,
      clientName,
      startTime: startDateTime,
      endTime: endDateTime,
      isRecurring,
      recurrenceDays: [], // Simplified
      ...(initialAppointment ? {} : { createdAt: new Date() }),
    };

    // Check for conflicts
    const foundConflicts = findConflicts(newAppointment, existingAppointments, bufferMinutes);

    if (foundConflicts.length > 0) {
      setConflicts(foundConflicts);
      setShowConflictModal(true);
    } else {
      await performSave(newAppointment);
    }
  };

  const performSave = async (appointment: Appointment) => {
    try {
      await saveAppointment(appointment);
      Alert.alert("Success", "Appointment saved successfully.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to save appointment.");
    }
  };

  const handleConfirmConflict = async () => {
    setShowConflictModal(false);
    // Create a temporary appointment object to pass to save
    const startDateTime = new Date();
    const [startH, startM] = startTime.split(':').map(Number);
    startDateTime.setHours(startH, startM);

    const endDateTime = new Date();
    const [endH, endM] = endTime.split(':').map(Number);
    endDateTime.setHours(endH, endM);

    const newAppointment: Appointment = {
      id: initialAppointment?.id || `temp-${Date.now()}`,
      clientName,
      startTime: startDateTime,
      endTime: endDateTime,
      isRecurring,
      recurrenceDays: [],
    };
    
    await performSave(newAppointment);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule Appointment</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Client Name"
        value={clientName}
        onChangeText={setClientName}
      />

      <TextInput
        style={styles.input}
        placeholder="Start Time (HH:MM)"
        value={startTime}
        onChangeText={setStartTime}
      />

      <TextInput
        style={styles.input}
        placeholder="End Time (HH:MM)"
        value={endTime}
        onChangeText={setEndTime}
      />

      <View style={styles.row}>
        <Text>Buffer Time (mins): </Text>
        <TextInput
          style={[styles.input, styles.smallInput]}
          value={bufferMinutes.toString()}
          onChangeText={(val) => setBufferMinutes(parseInt(val) || 0)}
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity onPress={() => setIsRecurring(!isRecurring)}>
        <Text style={styles.toggle}>{isRecurring ? 'Recurring: ON' : 'Recurring: OFF'}</Text>
      </TouchableOpacity>

      <Button title="Save Appointment" onPress={validateAndSave} />

      {/* Conflict Warning Modal */}
      <Modal
        visible={showConflictModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Appointment Conflict Detected</Text>
            <Text style={styles.modalText}>
              Your appointment overlaps with the following existing appointments:
            </Text>
            <View style={styles.conflictList}>
              {conflicts.map((conflict) => (
                <Text key={conflict.id} style={styles.conflictItem}>
                  - {conflict.clientName}: {conflict.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {conflict.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Text>
              ))}
            </View>
            <Text style={styles.modalWarning}>
              Do you want to proceed anyway?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setShowConflictModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.confirmButton]} 
                onPress={handleConfirmConflict}
              >
                <Text style={styles.buttonText}>Proceed Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  smallInput: {
    width: 80,
    marginLeft: 10,
  },
  toggle: {
    color: '#007bff',
    marginBottom: 15,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'red',
    marginBottom: 10,
  },
  modalText: {
    marginBottom: 10,
  },
  conflictList: {
    marginBottom: 10,
    maxHeight: 150,
    overflowY: 'auto',
  },
  conflictItem: {
    marginBottom: 5,
    color: '#555',
  },
  modalWarning: {
    fontStyle: 'italic',
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  confirmButton: {
    backgroundColor: '#ff9800',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default AppointmentScreen;
