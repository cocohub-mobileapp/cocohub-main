import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import EmergencyCallButton from '../components/EmergencyCallButton';
import PetSelectorBar from '../components/PetSelectorBar';
import SOSButton from '../components/SOSButton';
import emergencyService, {
  type EmergencyContact,
  type VetClinic,
} from '../services/emergencyService';
import { ensureSOSLockScreenNotification } from '../services/sosLockScreenNotificationService';
import { useSecureScreen } from '../utils/secureScreen';

type Tab = 'contacts' | 'nearby';
const CONTACT_TYPES: EmergencyContact['type'][] = ['vet', 'clinic', 'emergency', 'poison-control'];
const EMPTY_FORM: Omit<EmergencyContact, 'id'> = {
  name: '',
  phoneNumber: '',
  address: '',
  type: 'vet',
  available24h: false,
  notes: '',
};

const EmergencyContactsScreen: React.FC = () => {
  useSecureScreen();

  const [tab, setTab] = useState<Tab>('contacts');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [clinics, setClinics] = useState<VetClinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [form, setForm] = useState<Omit<EmergencyContact, 'id'>>(EMPTY_FORM);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const nextContacts = await emergencyService.getEmergencyContacts();
      setContacts(nextContacts);
      void ensureSOSLockScreenNotification();
    } catch {
      Alert.alert('Error', 'Failed to load emergency contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const findNearbyClinics = async () => {
    setLocationLoading(true);
    try {
      const location = await emergencyService.getCurrentLocation();
      setClinics(await emergencyService.getNearbyVetClinics(location.latitude, location.longitude));
      setTab('nearby');
    } catch (e: unknown) {
      Alert.alert(
        'Location Error',
        e instanceof Error ? e.message : 'Failed to find nearby clinics.',
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSOSSent = () => {
    // SOS dispatched — no-op in production
  };

  const openAddModal = () => {
    setEditingContact(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };
  const openEditModal = useCallback((contact: EmergencyContact) => {
    setEditingContact(contact);
    const { id: _id, ...rest } = contact;
    setForm(rest);
    setModalVisible(true);
  }, []);

  const closeModal = () => {
    setModalVisible(false);
    setEditingContact(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phoneNumber.trim()) {
      Alert.alert('Validation', 'Name and phone number are required.');
      return;
    }
    try {
      if (editingContact) {
        await emergencyService.updateContact(editingContact.id, form);
      } else {
        await emergencyService.addContact(form);
      }
      closeModal();
      loadContacts();
    } catch {
      Alert.alert('Error', 'Failed to save contact.');
    }
  };

  const handleDelete = useCallback(
    (contact: EmergencyContact) => {
      Alert.alert('Delete Contact', `Remove ${contact.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await emergencyService.deleteContact(contact.id);
            loadContacts();
          },
        },
      ]);
    },
    [loadContacts],
  );

  const renderContact = useCallback(
    ({ item }: { item: EmergencyContact }) => (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardSub}>
              {item.type}
              {item.available24h ? ' · 24h' : ''}
            </Text>
            {item.address ? <Text style={styles.cardSub}>{item.address}</Text> : null}
            {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
          </View>
          <View style={styles.cardActions}>
            {/* Direct call button — Issue #144/#75 */}
            <EmergencyCallButton
              phoneNumber={item.phoneNumber}
              label={item.name}
              compact
              skipConfirm={item.available24h} // skip confirm for 24h emergency contacts
            />
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn]}
              onPress={() => openEditModal(item)}
              accessibilityLabel={`Edit ${item.name}`}
            >
              <Text style={styles.actionBtnText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => handleDelete(item)}
              accessibilityLabel={`Delete ${item.name}`}
            >
              <Text style={styles.actionBtnText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ),
    [openEditModal, handleDelete],
  );

  const renderClinic = useCallback(
    ({ item }: { item: VetClinic }) => (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardSub}>
              {item.distance !== undefined ? `${item.distance.toFixed(1)} km` : ''}
              {item.available24h ? ' · 24h' : ''}
              {item.rating ? ` · ⭐ ${item.rating}` : ''}
            </Text>
            <Text style={styles.cardSub}>{item.address}</Text>
          </View>
          <View style={styles.cardActions}>
            {/* Direct call button — Issue #144/#75 */}
            <EmergencyCallButton
              phoneNumber={item.phoneNumber}
              label={item.name}
              compact
              skipConfirm={item.available24h}
            />
            <TouchableOpacity
              style={[styles.actionBtn, styles.navBtn]}
              onPress={() => emergencyService.navigateToClinic(item.address)}
              accessibilityLabel={`Navigate to ${item.name}`}
            >
              <Text style={styles.actionBtnText}>🗺️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      <SOSButton onSOSSent={handleSOSSent} />

      {/* Pet selector — Issue #151/#82: switch between pets */}
      <PetSelectorBar />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'contacts' && styles.tabActive]}
          onPress={() => setTab('contacts')}
        >
          <Text style={[styles.tabText, tab === 'contacts' && styles.tabTextActive]}>Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'nearby' && styles.tabActive]}
          onPress={() => void findNearbyClinics()}
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color="#e53e3e" />
          ) : (
            <Text style={[styles.tabText, tab === 'nearby' && styles.tabTextActive]}>
              Nearby Clinics
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {tab === 'contacts' ? (
        loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#e53e3e" />
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            renderItem={renderContact}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No emergency contacts yet.</Text>}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={10}
          />
        )
      ) : (
        <FlatList
          data={clinics}
          keyExtractor={(item) => item.id}
          renderItem={renderClinic}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Tap "Nearby Clinics" to find vets near you.</Text>
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      )}

      {tab === 'contacts' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={openAddModal}
          accessibilityLabel="Add contact"
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingContact ? 'Edit Contact' : 'Add Contact'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Name *"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number *"
              value={form.phoneNumber}
              onChangeText={(v) => setForm((f) => ({ ...f, phoneNumber: v }))}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Address"
              value={form.address}
              onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Notes"
              value={form.notes}
              onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
            />
            <View style={styles.typeRow}>
              {CONTACT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, form.type === t && styles.typeChipActive]}
                  onPress={() => setForm((f) => ({ ...f, type: t }))}
                >
                  <Text style={[styles.typeChipText, form.type === t && styles.typeChipTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setForm((f) => ({ ...f, available24h: !f.available24h }))}
            >
              <Text style={styles.toggleLabel}>Available 24h</Text>
              <Text style={styles.toggleValue}>{form.available24h ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => void handleSave()}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  sosButton: {
    backgroundColor: '#e53e3e',
    margin: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
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
  sosText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#e53e3e' },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { color: '#e53e3e', fontWeight: '600' },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  cardSub: { fontSize: 13, color: '#666', marginTop: 2 },
  cardNotes: { fontSize: 12, color: '#999', marginTop: 2, fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtn: { backgroundColor: '#ebf8ee' },
  editBtn: { backgroundColor: '#ebf4ff' },
  deleteBtn: { backgroundColor: '#fff5f5' },
  navBtn: { backgroundColor: '#fffbeb' },
  actionBtnText: { fontSize: 16 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e53e3e',
    alignItems: 'center',
    justifyContent: 'center',
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
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 15,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeChipActive: { backgroundColor: '#e53e3e', borderColor: '#e53e3e' },
  typeChipText: { fontSize: 12, color: '#666' },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleLabel: { fontSize: 15, color: '#1a1a1a' },
  toggleValue: { fontSize: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: '#666' },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#e53e3e',
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});

export default EmergencyContactsScreen;
