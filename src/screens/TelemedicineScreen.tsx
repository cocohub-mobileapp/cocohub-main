import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import VideoConsultationScreen from './VideoConsultationScreen';
import type { Appointment } from '../models/Appointment';
import { pickDocument, uploadDocument } from '../services/documentService';
import petService, { type Pet } from '../services/petService';
import {
  getTelemedicineAvailability,
  joinTelemedicineConsultation,
  reportTelemedicineNoShow,
  scheduleTelemedicineAppointment,
  submitTelemedicineQuestionnaire,
  type TelemedicineJoinSession,
  type TelemedicineAvailabilitySlot,
} from '../services/telemedicineService';
import { searchVets, type VetProfile } from '../services/vetService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  type: 'text' | 'image' | 'pdf';
  text?: string;
  localUri?: string;
  documentId?: string;
  documentName?: string;
  sentAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

async function compressImageUnder2MB(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  const size = info.exists && !info.isDirectory ? (info.size ?? 0) : 0;
  if (size <= MAX_IMAGE_BYTES) return uri;

  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const info2 = await FileSystem.getInfoAsync(result.uri);
  const size2 = info2.exists && !info2.isDirectory ? (info2.size ?? 0) : 0;
  if (size2 <= MAX_IMAGE_BYTES) return result.uri;

  const result2 = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 900 } }], {
    compress: 0.5,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result2.uri;
}

// ─── Component ────────────────────────────────────────────────────────────────

const TelemedicineScreen: React.FC = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [vets, setVets] = useState<VetProfile[]>([]);
  const [selectedVet, setSelectedVet] = useState<VetProfile | null>(null);
  const [slots, setSlots] = useState<TelemedicineAvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TelemedicineAvailabilitySlot | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [activeVideoSession, setActiveVideoSession] = useState<TelemedicineJoinSession | null>(
    null,
  );
  const [questionnaire, setQuestionnaire] = useState({ symptoms: '', duration: '', concerns: '' });
  const [loading, setLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [joiningConsultation, setJoiningConsultation] = useState(false);
  const [localTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [attachPickerVisible, setAttachPickerVisible] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    void loadPets();
    void loadVets();
  }, []);

  useEffect(() => {
    if (selectedVet) {
      void loadAvailability(selectedVet.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVet]);

  const isReadyToBook = useMemo(
    () => !!selectedPet && !!selectedVet && !!selectedSlot,
    [selectedPet, selectedVet, selectedSlot],
  );

  const loadPets = async () => {
    try {
      setLoading(true);
      const data = await petService.getAllPets();
      setPets(data);
      if (data.length > 0) setSelectedPet(data[0]);
    } catch (err) {
      Alert.alert('Unable to load pets', String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadVets = async () => {
    try {
      setLoading(true);
      const results = await searchVets({ available: true });
      setVets(results);
      if (results.length > 0) setSelectedVet(results[0]);
    } catch (err) {
      Alert.alert('Unable to load veterinarians', String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (vetId: string) => {
    try {
      setAvailabilityLoading(true);
      const items = await getTelemedicineAvailability(vetId, localTimeZone);
      setSlots(items.slice(0, 12));
      setSelectedSlot(items[0] ?? null);
    } catch (err) {
      Alert.alert('Unable to load availability', String(err));
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedPet || !selectedVet || !selectedSlot) return;

    try {
      setLoading(true);
      const result = await scheduleTelemedicineAppointment({
        petId: selectedPet.id,
        vetId: selectedVet.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        timeZone: selectedSlot.timeZone,
        durationMinutes: 30,
        notes: 'Telemedicine consultation requested through app.',
      });
      setAppointment(result);
      Alert.alert('Appointment confirmed', 'Your telemedicine consultation has been scheduled.');
    } catch (err) {
      Alert.alert('Schedule failed', String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuestionnaire = async () => {
    if (!appointment) return;
    try {
      setLoading(true);
      const payload = {
        symptoms: questionnaire.symptoms.trim(),
        duration: questionnaire.duration.trim(),
        concerns: questionnaire.concerns.trim(),
      };
      const updated = await submitTelemedicineQuestionnaire(appointment.id, payload);
      setAppointment(updated);
      Alert.alert(
        'Questionnaire submitted',
        'Your responses have been attached to the appointment.',
      );
    } catch (err) {
      Alert.alert('Unable to submit questionnaire', String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReportNoShow = async () => {
    if (!appointment) return;
    try {
      setLoading(true);
      const updated = await reportTelemedicineNoShow(
        appointment.id,
        'Patient did not join in time',
      );
      setAppointment(updated);
      Alert.alert('No-show reported', 'The appointment has been updated.');
    } catch (err) {
      Alert.alert('Unable to update appointment', String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinConsultation = async () => {
    if (!appointment?.consultationId) {
      Alert.alert(
        'Video room unavailable',
        'This appointment does not have a linked WebRTC consultation room.',
      );
      return;
    }

    try {
      setJoiningConsultation(true);
      const session = await joinTelemedicineConsultation(appointment.consultationId);
      setActiveVideoSession(session);
    } catch (err) {
      Alert.alert('Unable to join consultation', String(err));
    } finally {
      setJoiningConsultation(false);
    }
  };

  // ── Chat ──────────────────────────────────────────────────────────────────────

  const addMessage = (msg: Omit<ChatMessage, 'id' | 'sentAt'>) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: String(Date.now()),
      sentAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSendText = () => {
    const text = chatInput.trim();
    if (!text) return;
    addMessage({ type: 'text', text });
    setChatInput('');
  };

  const handleAttachOption = async (option: 'camera' | 'library' | 'document') => {
    setAttachPickerVisible(false);
    if (!selectedPet) {
      Alert.alert('No pet selected', 'Please select a pet before attaching files.');
      return;
    }

    setUploadingAttachment(true);
    try {
      if (option === 'document') {
        const picked = await pickDocument();
        if (!picked) return;

        const isPdf = picked.mimeType === 'application/pdf';
        const doc = await uploadDocument({
          petId: selectedPet.id,
          name: picked.name,
          category: 'vet_report',
          uri: picked.uri,
          mimeType: picked.mimeType,
        });

        if (isPdf) {
          addMessage({ type: 'pdf', documentId: doc.id, documentName: doc.name });
        } else {
          addMessage({
            type: 'image',
            localUri: picked.uri,
            documentId: doc.id,
            documentName: doc.name,
          });
        }
        return;
      }

      let asset: ImagePicker.ImagePickerAsset | null = null;

      if (option === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission denied', 'Camera access is required to take photos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
        });
        if (!result.canceled && result.assets.length > 0) asset = result.assets[0];
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission denied', 'Photo library access is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
        });
        if (!result.canceled && result.assets.length > 0) asset = result.assets[0];
      }

      if (!asset) return;

      const compressedUri = await compressImageUnder2MB(asset.uri);

      const doc = await uploadDocument({
        petId: selectedPet.id,
        name: `symptom_photo_${Date.now()}.jpg`,
        category: 'vet_report',
        uri: compressedUri,
        mimeType: 'image/jpeg',
      });

      addMessage({ type: 'image', localUri: compressedUri, documentId: doc.id });
    } catch (err) {
      Alert.alert('Upload failed', String(err));
    } finally {
      setUploadingAttachment(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderVetItem = ({ item }: { item: VetProfile }) => (
    <Pressable
      style={[styles.card, selectedVet?.id === item.id && styles.cardSelected]}
      onPress={() => setSelectedVet(item)}
    >
      <Text style={styles.cardTitle}>{item.name}</Text>
      <Text style={styles.cardSubtitle}>{item.specialty}</Text>
      <Text style={styles.cardMeta}>{item.address}</Text>
    </Pressable>
  );

  const renderChatMessage = (msg: ChatMessage) => {
    if (msg.type === 'text') {
      return (
        <View key={msg.id} style={styles.chatBubble}>
          <Text style={styles.chatBubbleText}>{msg.text}</Text>
          <Text style={styles.chatBubbleTime}>
            {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    }

    if (msg.type === 'image') {
      return (
        <View key={msg.id} style={styles.chatBubble}>
          <TouchableOpacity onPress={() => setViewingImageUri(msg.localUri ?? null)}>
            <Image
              source={{ uri: msg.localUri }}
              style={styles.chatImage}
              resizeMode="cover"
              accessibilityLabel="Attached symptom photo"
            />
          </TouchableOpacity>
          <Text style={styles.chatBubbleTime}>
            {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    }

    return (
      <View key={msg.id} style={styles.chatBubble}>
        <View style={styles.pdfAttachment}>
          <Text style={styles.pdfIcon}>📄</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pdfName} numberOfLines={1}>
              {msg.documentName ?? 'Document'}
            </Text>
            <Text style={styles.pdfMeta}>PDF · Shared with vet</Text>
          </View>
        </View>
        <Text style={styles.chatBubbleTime}>
          {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (activeVideoSession && appointment) {
    return (
      <VideoConsultationScreen
        consultationId={activeVideoSession.consultationId}
        roomToken={activeVideoSession.roomToken}
        userId={activeVideoSession.userId}
        userRole={activeVideoSession.userRole}
        petName={selectedPet?.name ?? appointment.petName ?? appointment.pet?.name ?? 'your pet'}
        onEnd={() => setActiveVideoSession(null)}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.outerContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Telemedicine</Text>
        <Text style={styles.subtitle}>Book a video consultation with a licensed veterinarian.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose a pet</Text>
          {pets.length === 0 ? (
            <Text style={styles.empty}>No pets found.</Text>
          ) : (
            <FlatList
              data={pets}
              horizontal
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.chip, selectedPet?.id === item.id && styles.chipActive]}
                  onPress={() => setSelectedPet(item)}
                >
                  <Text style={styles.chipText}>{item.name}</Text>
                </Pressable>
              )}
              contentContainerStyle={styles.chipList}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available veterinarians</Text>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              data={vets}
              keyExtractor={(item) => item.id}
              renderItem={renderVetItem}
              horizontal
              scrollEnabled={false}
              contentContainerStyle={styles.cardList}
              ListEmptyComponent={<Text style={styles.empty}>No vets available right now.</Text>}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability ({localTimeZone})</Text>
          {availabilityLoading ? (
            <ActivityIndicator />
          ) : slots.length === 0 ? (
            <Text style={styles.empty}>Select a vet to view available appointments.</Text>
          ) : (
            slots.map((item) => (
              <Pressable
                key={`${item.date}-${item.time}`}
                style={[
                  styles.slotCard,
                  selectedSlot?.date === item.date &&
                    selectedSlot.time === item.time &&
                    styles.slotSelected,
                ]}
                onPress={() => setSelectedSlot(item)}
              >
                <Text style={styles.slotText}>{item.display}</Text>
              </Pressable>
            ))
          )}
        </View>

        <Pressable
          style={[styles.primaryBtn, !isReadyToBook && styles.primaryBtnDisabled]}
          onPress={handleBookAppointment}
          disabled={!isReadyToBook || loading}
        >
          <Text style={styles.primaryBtnText}>Book Telemedicine Appointment</Text>
        </Pressable>

        {appointment ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirmed Appointment</Text>
            <Text style={styles.detailText}>
              Vet: {selectedVet?.name ?? appointment.vetName ?? appointment.vet?.name}
            </Text>
            <Text style={styles.detailText}>
              Pet: {selectedPet?.name ?? appointment.petName ?? appointment.pet?.name}
            </Text>
            <Text style={styles.detailText}>
              {appointment.date} @ {appointment.time} ({appointment.timeZone ?? localTimeZone})
            </Text>
            <Text style={styles.detailText}>Video link:</Text>
            <Text style={styles.linkText}>{appointment.videoCallUrl}</Text>
            <Pressable
              style={[
                styles.primaryBtn,
                (!appointment.consultationId || joiningConsultation) && styles.primaryBtnDisabled,
              ]}
              onPress={handleJoinConsultation}
              disabled={!appointment.consultationId || joiningConsultation}
            >
              <Text style={styles.primaryBtnText}>
                {joiningConsultation ? 'Joining Consultation...' : 'Join Video Consultation'}
              </Text>
            </Pressable>

            {!appointment.questionnaireRespondedAt ? (
              <>
                <Text style={styles.sectionTitle}>Pre-consultation questionnaire</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Describe symptoms"
                  value={questionnaire.symptoms}
                  onChangeText={(text) => setQuestionnaire((prev) => ({ ...prev, symptoms: text }))}
                  multiline
                />
                <TextInput
                  style={styles.input}
                  placeholder="How long has it been happening?"
                  value={questionnaire.duration}
                  onChangeText={(text) => setQuestionnaire((prev) => ({ ...prev, duration: text }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Any urgent concerns?"
                  value={questionnaire.concerns}
                  onChangeText={(text) => setQuestionnaire((prev) => ({ ...prev, concerns: text }))}
                  multiline
                />
                <Pressable
                  style={styles.primaryBtn}
                  onPress={handleSubmitQuestionnaire}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>Submit Questionnaire</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.infoText}>
                Questionnaire submitted on{' '}
                {new Date(appointment.questionnaireRespondedAt).toLocaleString()}
              </Text>
            )}

            {/* ── Chat section ── */}
            <Text style={styles.sectionTitle}>Chat with Vet</Text>
            <Text style={styles.chatHint}>Share photos of symptoms or prescription PDFs.</Text>

            <View style={styles.chatMessages}>
              {chatMessages.length === 0 ? (
                <Text style={styles.chatEmpty}>No messages yet.</Text>
              ) : (
                chatMessages.map(renderChatMessage)
              )}
            </View>

            <Pressable style={styles.secondaryBtn} onPress={handleReportNoShow} disabled={loading}>
              <Text style={styles.secondaryBtnText}>Report No-Show</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Sticky chat input bar (visible after appointment booked) ── */}
      {appointment && (
        <View style={styles.chatInputBar}>
          {uploadingAttachment ? (
            <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: 8 }} />
          ) : (
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() => setAttachPickerVisible(true)}
              accessibilityLabel="Attach file"
            >
              <Text style={styles.attachBtnIcon}>📎</Text>
            </TouchableOpacity>
          )}
          <TextInput
            style={styles.chatTextInput}
            placeholder="Type a message…"
            placeholderTextColor="#9CA3AF"
            value={chatInput}
            onChangeText={setChatInput}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !chatInput.trim() && styles.sendBtnDisabled]}
            onPress={handleSendText}
            disabled={!chatInput.trim()}
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Attachment picker modal ── */}
      <Modal
        visible={attachPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAttachPickerVisible(false)}>
          <View style={styles.attachSheet}>
            <Text style={styles.attachSheetTitle}>Attach File</Text>

            <TouchableOpacity
              style={styles.attachOption}
              onPress={() => void handleAttachOption('camera')}
            >
              <Text style={styles.attachOptionIcon}>📷</Text>
              <Text style={styles.attachOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachOption}
              onPress={() => void handleAttachOption('library')}
            >
              <Text style={styles.attachOptionIcon}>🖼️</Text>
              <Text style={styles.attachOptionText}>Photo Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachOption}
              onPress={() => void handleAttachOption('document')}
            >
              <Text style={styles.attachOptionIcon}>📄</Text>
              <Text style={styles.attachOptionText}>PDF Document</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachCancelBtn}
              onPress={() => setAttachPickerVisible(false)}
            >
              <Text style={styles.attachCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Fullscreen image viewer ── */}
      <Modal
        visible={!!viewingImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImageUri(null)}
      >
        <Pressable
          style={styles.imageViewerOverlay}
          onPress={() => setViewingImageUri(null)}
          accessibilityLabel="Close image viewer"
        >
          {viewingImageUri && (
            <Image
              source={{ uri: viewingImageUri }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F7F8FA' },
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#5A5F6F', marginBottom: 18 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardList: { paddingBottom: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
    minWidth: 180,
    elevation: 1,
  },
  cardSelected: { borderColor: '#007AFF', borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#657786', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#7A7A7A' },
  chipList: { paddingVertical: 8 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    elevation: 1,
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { color: '#1F2937', fontWeight: '600' },
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  slotSelected: { borderColor: '#007AFF', borderWidth: 1 },
  slotText: { fontSize: 15, color: '#1F2937' },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { color: '#111827', fontWeight: '700' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  empty: { color: '#6B7280' },
  detailText: { color: '#1F2937', marginBottom: 4 },
  linkText: { color: '#007AFF', marginBottom: 8 },
  infoText: { color: '#374151', marginTop: 12 },

  // Chat
  chatHint: { fontSize: 12, color: '#9CA3AF', marginBottom: 10, marginTop: -4 },
  chatMessages: { marginBottom: 8 },
  chatEmpty: { color: '#9CA3AF', fontSize: 13, marginBottom: 8 },
  chatBubble: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    maxWidth: '85%',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatBubbleText: { fontSize: 14, color: '#1F2937', lineHeight: 20 },
  chatBubbleTime: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },
  chatImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  pdfAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pdfIcon: { fontSize: 24 },
  pdfName: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  pdfMeta: { fontSize: 11, color: '#9CA3AF' },

  // Chat input bar
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    gap: 8,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachBtnIcon: { fontSize: 18 },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
  sendBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Attachment picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  attachSheetTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  attachOptionIcon: { fontSize: 22 },
  attachOptionText: { fontSize: 16, color: '#1F2937' },
  attachCancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  attachCancelText: { fontSize: 16, fontWeight: '600', color: '#374151' },

  // Image viewer
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: '95%',
    height: '80%',
  },
});

export default TelemedicineScreen;
