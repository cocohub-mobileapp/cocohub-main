import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { EmptyState } from '../components/EmptyState';
import DatePickerInput from '../components/DatePickerInput';
import MultiStepFormHeader from '../components/MultiStepFormHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useMinimumLoadingTime } from '../hooks/useMinimumLoadingTime';
import { useMultiStepFormFocus } from '../hooks/useMultiStepFormFocus';
import {
  checkDrugInteractions,
  getSeverityLabel,
  recordVetOverride,
  type DrugInteraction,
  type InteractionCheckResult,
  type InteractionSeverity,
} from '../services/drugInteractionService';
import {
  type DoseLog,
  type Medication,
  type RefillStatus,
  deleteMedication,
  getDaySchedule,
  getDoseLogs,
  getMedications,
  getRefillStatus,
  logDose,
  markRefillComplete,
  saveMedication,
  scheduleRefillReminder,
  syncRefillReminders,
} from '../services/medicationService';
import { scheduleMedicationReminder } from '../services/notificationService';
import { formatLocalDate, formatLocalTime } from '../utils/dateLocale';
import haptics from '../utils/haptics';
import { useSecureScreen } from '../utils/secureScreen';

type Tab = 'list' | 'daily' | 'weekly';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MEDICATION_FORM_STEPS = [
  { title: 'Basic information' },
  { title: 'Medication details' },
  { title: 'Provider information' },
  { title: 'Supply & notes' },
];

function testIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const EMPTY_FORM: Omit<Medication, 'id'> = {
  petId: '',
  name: '',
  dosage: '',
  frequency: 8,
  startDate: new Date().toISOString(),
  endDate: '',
  refillDate: '',
  instructions: '',
  prescriberInfo: { name: '', contact: '', clinic: '' },
  pharmacyInfo: { name: '', phone: '', address: '' },
  totalPills: undefined,
  remainingPills: undefined,
  notes: '',
};

function todayDates(): Date[] {
  return [new Date()];
}
function weekDates(): Date[] {
  const today = new Date();
  const day = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - day + i);
    return d;
  });
}

const MedicationScreen: React.FC = () => {
  useSecureScreen();

  const { colors } = useTheme();
  const { show: showToast } = useToast();

  const [tab, setTab] = useState<Tab>('list');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [form, setForm] = useState<Omit<Medication, 'id'>>(EMPTY_FORM);
  const [interactionResult, setInteractionResult] = useState<InteractionCheckResult | null>(null);
  const [vetOverrideMode, setVetOverrideMode] = useState(false);
  const [vetId, setVetId] = useState('');
  const [overrideJustification, setOverrideJustification] = useState('');
  const [contraindicatedAcknowledged, setContraindicatedAcknowledged] = useState(false);
  // Refill modal state
  const [refillModalVisible, setRefillModalVisible] = useState(false);
  const [refillTargetMed, setRefillTargetMed] = useState<Medication | null>(null);
  const [newSupplyInput, setNewSupplyInput] = useState('');

  const {
    currentStep: formStep,
    totalSteps: formTotalSteps,
    stepHeadingRef: formHeadingRef,
    stepAnnouncement: formStepAnnouncement,
    registerFirstInteractive: registerFormFirstInteractive,
    registerFieldRef: registerFormFieldRef,
    goNext: goFormNext,
    goBack: goFormBack,
    resetSteps: resetFormSteps,
    focusFirstError: focusFormError,
    isFirstStep: isFormFirstStep,
    isLastStep: isFormLastStep,
  } = useMultiStepFormFocus(MEDICATION_FORM_STEPS);

  // Enforce minimum 300ms display for skeleton
  const displayLoading = useMinimumLoadingTime(isLoading, { minLoadingTime: 300 });

  const hasData = medications.length > 0 || doseLogs.length > 0;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [meds, logs] = await Promise.all([getMedications(), getDoseLogs()]);
      setMedications(meds);
      setDoseLogs(logs);
    } catch (err) {
      // Only surface a toast if we already have cached data on screen — an
      // initial-load failure with no data falls through to the empty state.
      if (hasData) {
        showToast("Couldn't refresh — showing cached data", { variant: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasData, showToast]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  const openAdd = () => {
    setEditingMed(null);
    setForm(EMPTY_FORM);
    resetFormSteps();
    setModalVisible(true);
  };
  const openEdit = useCallback(
    (med: Medication) => {
      setEditingMed(med);
      setForm({ ...med });
      resetFormSteps();
      setModalVisible(true);
    },
    [resetFormSteps],
  );
  const closeModal = () => {
    setModalVisible(false);
    resetFormSteps();
  };

  const validateMedicationStep = (): boolean => {
    if (formStep === 0) {
      if (!form.name.trim()) {
        focusFormError('name', 'Medication name is required.');
        return false;
      }
      if (!form.dosage.trim()) {
        focusFormError('dosage', 'Dosage is required.');
        return false;
      }
      if (!form.petId.trim()) {
        focusFormError('petId', 'Pet ID is required.');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!form.petId.trim()) {
      focusFormError('petId', 'Pet ID is required.', 0);
      return;
    }
    if (!form.name.trim()) {
      focusFormError('name', 'Medication name is required.', 0);
      return;
    }
    if (!form.dosage.trim()) {
      focusFormError('dosage', 'Dosage is required.', 0);
      return;
    }

    // Check drug interactions when adding a new medication
    if (!editingMed) {
      const existingNames = medications
        .filter((m) => m.petId === form.petId.trim())
        .map((m) => m.name);
      const result = await checkDrugInteractions(form.name.trim(), existingNames);

      if (result.hasInteractions) {
        const hasContraindicated = result.interactions.some(
          (i) => i.severity === 'contraindicated',
        );

        if (!vetOverrideMode) {
          setInteractionResult(result);
          return; // block save — user must acknowledge warnings first
        }

        // Contraindicated requires explicit acknowledgement before override is accepted
        if (hasContraindicated && !contraindicatedAcknowledged) {
          setInteractionResult(result);
          Alert.alert(
            '⛔ Contraindicated Combination',
            'This combination is contraindicated. You must acknowledge the risk before proceeding with a vet override.',
          );
          return;
        }

        if (!vetId.trim() || !overrideJustification.trim()) {
          Alert.alert('Override Required', 'Vet ID and justification are required to override.');
          return;
        }

        for (const interaction of result.interactions) {
          await recordVetOverride({
            drugA: interaction.drugA,
            drugB: interaction.drugB,
            vetId: vetId.trim(),
            justification: overrideJustification.trim(),
          });
        }
      }
    }
    const remainingPills = form.remainingPills ? Number(form.remainingPills) : undefined;
    const currentSupply =
      form.currentSupply !== undefined ? Number(form.currentSupply) : remainingPills;
    const med: Medication = {
      ...form,
      id: editingMed?.id ?? Date.now().toString(),
      frequency: Number(form.frequency) || 8,
      totalPills: form.totalPills ? Number(form.totalPills) : undefined,
      remainingPills,
      currentSupply,
    };
    await saveMedication(med);
    await scheduleRefillReminder(med);
    await scheduleMedicationReminder(med);
    // Sync refill reminder notifications whenever supply/frequency changes
    await syncRefillReminders(med);
    setInteractionResult(null);
    setVetOverrideMode(false);
    setVetId('');
    setOverrideJustification('');
    setContraindicatedAcknowledged(false);
    closeModal();
    void loadData();
  };

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete', 'Remove this medication?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMedication(id);
            void loadData();
          },
        },
      ]);
    },
    [loadData],
  );

  const handleLogDose = useCallback(
    async (medicationId: string, skipped = false) => {
      const log: DoseLog = {
        id: Date.now().toString(),
        medicationId,
        takenAt: new Date().toISOString(),
        skipped,
      };
      await logDose(log);
      // Haptic feedback: success for dose taken, warning for skipped
      void (skipped ? haptics.warning() : haptics.success());
      const med = medications.find((m) => m.id === medicationId);
      if (med && !skipped) {
        // Decrement both supply fields, then resync run-out & notifications
        const newSupply = Math.max(0, (med.currentSupply ?? med.remainingPills ?? 0) - 1);
        const updatedMed: Medication = {
          ...med,
          currentSupply: newSupply,
          remainingPills: newSupply,
        };
        await syncRefillReminders(updatedMed);
      }
      void loadData();
    },
    [medications, loadData],
  );

  const isDoseTaken = (medicationId: string, scheduledTime: Date): boolean => {
    const windowMs = 30 * 60 * 1000;
    return doseLogs.some(
      (l) =>
        l.medicationId === medicationId &&
        !l.skipped &&
        Math.abs(new Date(l.takenAt).getTime() - scheduledTime.getTime()) <= windowMs,
    );
  };

  const openRefillModal = useCallback((med: Medication) => {
    setRefillTargetMed(med);
    setNewSupplyInput('');
    setRefillModalVisible(true);
  }, []);

  const handleRefillComplete = async () => {
    if (!refillTargetMed) return;
    const qty = parseInt(newSupplyInput, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid quantity', 'Please enter a positive number of doses/pills.');
      return;
    }
    await markRefillComplete(refillTargetMed, qty);
    setRefillModalVisible(false);
    setRefillTargetMed(null);
    setNewSupplyInput('');
    void loadData();
  };

  const renderMedItem = useCallback(
    ({ item }: { item: Medication }) => {
      const supply = item.currentSupply ?? item.remainingPills;
      const lowStock =
        item.remainingPills !== undefined &&
        item.totalPills !== undefined &&
        item.remainingPills <= item.totalPills * 0.2;
      const refillStatus: RefillStatus = getRefillStatus(item);

      const refillBadgeStyle = [
        styles.refillBadge,
        refillStatus === 'urgent' || refillStatus === 'out'
          ? styles.refillBadgeUrgent
          : refillStatus === 'warning'
            ? styles.refillBadgeWarning
            : styles.refillBadgeOk,
      ];
      const refillBadgeLabel: Record<RefillStatus, string> = {
        ok: '✅ Supply OK',
        warning: '⚠️ Refill Soon',
        urgent: '🚨 Refill Now',
        out: '❌ Out of Stock',
        unknown: '',
      };

      return (
        <View style={styles.card} testID={`medication-card-${testIdPart(item.name)}`}>
          <View style={styles.cardHeader}>
            <Text style={styles.medName}>{item.name}</Text>
            <View style={styles.cardActions}>
              {item.pendingApproval && (
                <View style={styles.pendingVetReviewBadge}>
                  <Text style={styles.pendingVetReviewText}>⏳ Pending vet review</Text>
                </View>
              )}
              {refillStatus !== 'unknown' && (
                <View style={refillBadgeStyle}>
                  <Text style={styles.refillBadgeText}>{refillBadgeLabel[refillStatus]}</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => openEdit(item)}
                style={styles.actionBtn}
                testID={`medication-edit-${testIdPart(item.name)}`}
              >
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                style={[styles.actionBtn, styles.deleteBtn]}
                testID={`medication-delete-${testIdPart(item.name)}`}
              >
                <Text style={[styles.actionBtnText, styles.deleteBtnText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.medDetail}>
            {item.dosage} · every {item.frequency}h
          </Text>
          <Text style={styles.medDetail}>Started: {formatLocalDate(item.startDate)}</Text>
          <Text style={styles.medDetail}>Pet ID: {item.petId}</Text>
          {item.instructions ? (
            <Text style={styles.medDetail}>Instructions: {item.instructions}</Text>
          ) : null}
          {item.prescriberInfo?.name ? (
            <Text style={styles.medDetail}>
              Prescriber: {item.prescriberInfo.name}
              {item.prescriberInfo.contact ? ` • ${item.prescriberInfo.contact}` : ''}
            </Text>
          ) : null}
          {item.pharmacyInfo?.name ? (
            <Text style={styles.medDetail}>
              Pharmacy: {item.pharmacyInfo.name}
              {item.pharmacyInfo.phone ? ` • ${item.pharmacyInfo.phone}` : ''}
            </Text>
          ) : null}
          {item.endDate ? (
            <Text style={styles.medDetail}>Ends: {formatLocalDate(item.endDate)}</Text>
          ) : null}
          {supply !== undefined && (
            <Text style={[styles.medDetail, lowStock && styles.lowStock]}>
              Supply remaining: {supply} dose{supply !== 1 ? 's' : ''}
              {lowStock ? ' ⚠ Low stock' : ''}
            </Text>
          )}
          {item.estimatedRunOutDate ? (
            <Text style={styles.medDetail}>
              Est. run-out: {formatLocalDate(item.estimatedRunOutDate)}
            </Text>
          ) : null}
          {item.lastRefillDate ? (
            <Text style={styles.medDetail}>
              Last refilled: {formatLocalDate(item.lastRefillDate)}
            </Text>
          ) : null}
          {item.refillDate ? (
            <Text style={styles.medDetail}>Refill by: {formatLocalDate(item.refillDate)}</Text>
          ) : null}
          <View style={styles.doseActions}>
            <TouchableOpacity
              style={styles.logBtn}
              onPress={() => void handleLogDose(item.id, false)}
              testID={`medication-log-dose-${testIdPart(item.name)}`}
            >
              <Text style={styles.logBtnText}>✓ Log Dose</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logBtn, styles.skipBtn]}
              onPress={() => void handleLogDose(item.id, true)}
              testID={`medication-skip-dose-${testIdPart(item.name)}`}
            >
              <Text style={styles.logBtnText}>✗ Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logBtn, styles.refillBtn]}
              onPress={() => openRefillModal(item)}
              testID={`medication-refill-${testIdPart(item.name)}`}
            >
              <Text style={styles.logBtnText}>+ Refill</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [openEdit, handleDelete, handleLogDose, openRefillModal],
  );
  const renderSchedule = (dates: Date[]) => (
    <ScrollView style={styles.scheduleContainer}>
      {dates.map((date) => {
        const label =
          dates.length === 1
            ? 'Today'
            : `${DAYS[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
        const slots = medications.flatMap((med) =>
          getDaySchedule(med, date).map((time) => ({ med, time })),
        );
        slots.sort((a, b) => a.time.getTime() - b.time.getTime());
        return (
          <View key={date.toDateString()} style={styles.dayBlock}>
            <Text style={styles.dayLabel}>{label}</Text>
            {slots.length === 0 ? (
              <Text style={styles.emptyText}>No doses scheduled</Text>
            ) : (
              slots.map(({ med, time }) => {
                const taken = isDoseTaken(med.id, time);
                return (
                  <View
                    key={`${med.id}-${time.toISOString()}`}
                    style={[styles.slotRow, taken && styles.slotTaken]}
                    testID={`medication-schedule-row-${testIdPart(med.name)}`}
                  >
                    <Text style={styles.slotTime}>{formatLocalTime(time)}</Text>
                    <Text style={styles.slotName}>
                      {med.name} · {med.dosage}
                    </Text>
                    {taken && <Text style={styles.takenBadge}>✓</Text>}
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </ScrollView>
  );

  const renderFormInput = (
    key: string,
    placeholder: string,
    options?: {
      value?: string;
      onChangeText?: (v: string) => void;
      keyboardType?: 'default' | 'numeric';
      multiline?: boolean;
      isFirstInteractive?: boolean;
    },
  ) => (
    <TextInput
      key={key}
      ref={(ref) => {
        registerFormFieldRef(key, ref);
        if (options?.isFirstInteractive) {
          registerFormFirstInteractive(formStep, ref);
        }
      }}
      style={[styles.input, options?.multiline && styles.textArea]}
      placeholder={placeholder}
      value={options?.value}
      onChangeText={options?.onChangeText}
      keyboardType={options?.keyboardType}
      multiline={options?.multiline}
      accessibilityLabel={placeholder.replace(' *', '')}
      testID={`medication-${key}-input`}
    />
  );

  const renderModal = () => (
    <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalContent} testID="medication-form-modal">
          <Text style={styles.modalTitle}>{editingMed ? 'Edit Medication' : 'Add Medication'}</Text>
          <MultiStepFormHeader
            stepHeadingRef={formHeadingRef}
            announcement={formStepAnnouncement}
            currentStep={formStep}
            totalSteps={formTotalSteps}
          />
          {formStep === 0 && (
            <>
              {renderFormInput('name', 'Medication name *', {
                value: form.name,
                onChangeText: (v) => setForm((f) => ({ ...f, name: v })),
                isFirstInteractive: true,
              })}
              {renderFormInput('dosage', 'Dosage (e.g. 5mg) *', {
                value: form.dosage,
                onChangeText: (v) => setForm((f) => ({ ...f, dosage: v })),
              })}
              {renderFormInput('petId', 'Pet ID *', {
                value: form.petId,
                onChangeText: (v) => setForm((f) => ({ ...f, petId: v })),
              })}
              {renderFormInput('frequency', 'Frequency (hours between doses)', {
                value: String(form.frequency),
                onChangeText: (v) => setForm((f) => ({ ...f, frequency: Number(v) || 8 })),
                keyboardType: 'numeric',
              })}
            </>
          )}
          {formStep === 1 && (
            <>
              <DatePickerInput
                label="Start date *"
                value={form.startDate.slice(0, 10)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, startDate: v ? new Date(v).toISOString() : f.startDate }))
                }
                maxDate={new Date()}
              />
              <View style={{ height: 12 }} />
              <DatePickerInput
                label="End date"
                value={form.endDate?.slice(0, 10) ?? ''}
                onChange={(v) =>
                  setForm((f) => ({ ...f, endDate: v ? new Date(v).toISOString() : '' }))
                }
                minDate={form.startDate ? new Date(form.startDate) : undefined}
              />
              <View style={{ height: 12 }} />
              <DatePickerInput
                label="Refill date"
                value={form.refillDate?.slice(0, 10) ?? ''}
                onChange={(v) =>
                  setForm((f) => ({ ...f, refillDate: v ? new Date(v).toISOString() : '' }))
                }
              />
              <View style={{ height: 12 }} />
              {renderFormInput('instructions', 'Instructions', {
                value: form.instructions ?? '',
                onChangeText: (v) => setForm((f) => ({ ...f, instructions: v })),
                multiline: true,
              })}
            </>
          )}
          {formStep === 2 && (
            <>
              {renderFormInput('prescriberName', 'Prescriber name', {
                value: form.prescriberInfo?.name ?? '',
                onChangeText: (v) =>
                  setForm((f) => ({
                    ...f,
                    prescriberInfo: { ...f.prescriberInfo, name: v },
                  })),
                isFirstInteractive: true,
              })}
              {renderFormInput('prescriberContact', 'Prescriber contact', {
                value: form.prescriberInfo?.contact ?? '',
                onChangeText: (v) =>
                  setForm((f) => ({
                    ...f,
                    prescriberInfo: { ...f.prescriberInfo, contact: v },
                  })),
              })}
              {renderFormInput('prescriberClinic', 'Prescriber clinic', {
                value: form.prescriberInfo?.clinic ?? '',
                onChangeText: (v) =>
                  setForm((f) => ({
                    ...f,
                    prescriberInfo: { ...f.prescriberInfo, clinic: v },
                  })),
              })}
              {renderFormInput('pharmacyName', 'Pharmacy name', {
                value: form.pharmacyInfo?.name ?? '',
                onChangeText: (v) =>
                  setForm((f) => ({
                    ...f,
                    pharmacyInfo: { ...f.pharmacyInfo, name: v },
                  })),
              })}
              {renderFormInput('pharmacyPhone', 'Pharmacy phone', {
                value: form.pharmacyInfo?.phone ?? '',
                onChangeText: (v) =>
                  setForm((f) => ({
                    ...f,
                    pharmacyInfo: { ...f.pharmacyInfo, phone: v },
                  })),
              })}
              {renderFormInput('pharmacyAddress', 'Pharmacy address', {
                value: form.pharmacyInfo?.address ?? '',
                onChangeText: (v) =>
                  setForm((f) => ({
                    ...f,
                    pharmacyInfo: { ...f.pharmacyInfo, address: v },
                  })),
              })}
            </>
          )}
          {formStep === 3 && (
            <>
              {renderFormInput('totalPills', 'Total pills', {
                value: form.totalPills !== undefined ? String(form.totalPills) : '',
                onChangeText: (v) =>
                  setForm((f) => ({ ...f, totalPills: v ? Number(v) : undefined })),
                keyboardType: 'numeric',
                isFirstInteractive: true,
              })}
              {renderFormInput('remainingPills', 'Remaining pills', {
                value: form.remainingPills !== undefined ? String(form.remainingPills) : '',
                onChangeText: (v) =>
                  setForm((f) => ({
                    ...f,
                    remainingPills: v ? Number(v) : undefined,
                  })),
                keyboardType: 'numeric',
              })}
              {renderFormInput('currentSupply', 'Current supply (doses on hand)', {
                value: form.currentSupply !== undefined ? String(form.currentSupply) : '',
                onChangeText: (v) =>
                  setForm((f) => ({
                    ...f,
                    currentSupply: v ? Number(v) : undefined,
                  })),
                keyboardType: 'numeric',
              })}
              {renderFormInput('notes', 'Notes', {
                value: form.notes ?? '',
                onChangeText: (v) => setForm((f) => ({ ...f, notes: v })),
                multiline: true,
              })}
            </>
          )}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={closeModal}
              testID="medication-form-cancel-button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            {!isFormFirstStep && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={goFormBack}
                accessibilityRole="button"
                accessibilityLabel="Go to previous step"
                testID="medication-form-back-button"
              >
                <Text style={styles.cancelBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            {!isFormLastStep ? (
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => {
                  if (validateMedicationStep()) goFormNext();
                }}
                accessibilityRole="button"
                accessibilityLabel="Go to next step"
                testID="medication-form-next-button"
              >
                <Text style={styles.saveBtnText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => void handleSave()}
                testID="medication-form-save-button"
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Drug interaction warning */}
          {interactionResult?.hasInteractions && (
            <View style={styles.interactionWarning} testID="medication-interaction-warning">
              <Text style={styles.interactionTitle}>⚠️ Drug Interaction Detected</Text>
              {(['contraindicated', 'severe', 'moderate', 'mild'] as InteractionSeverity[]).map(
                (severity) => {
                  const group = interactionResult.interactions.filter(
                    (i: DrugInteraction) => i.severity === severity,
                  );
                  if (group.length === 0) return null;
                  return (
                    <View key={severity} style={styles.severityGroup}>
                      <View
                        style={[
                          styles.severityBadge,
                          severity === 'contraindicated' && styles.badgeContraindicated,
                          severity === 'severe' && styles.badgeSevere,
                          severity === 'moderate' && styles.badgeModerate,
                          severity === 'mild' && styles.badgeMild,
                        ]}
                      >
                        <Text style={styles.severityBadgeText}>{getSeverityLabel(severity)}</Text>
                      </View>
                      {group.map((i: DrugInteraction, idx: number) => (
                        <View key={idx} style={styles.interactionItem}>
                          <Text style={styles.interactionDrugs}>
                            {i.drugA} + {i.drugB}
                          </Text>
                          <Text style={styles.interactionDesc}>{i.description}</Text>
                          <Text style={styles.interactionRec}>{i.recommendation}</Text>
                        </View>
                      ))}
                    </View>
                  );
                },
              )}

              {/* Contraindicated acknowledgement gate */}
              {interactionResult.interactions.some((i) => i.severity === 'contraindicated') &&
                !contraindicatedAcknowledged && (
                  <View style={styles.contraindicatedWarning}>
                    <Text style={styles.contraindicatedWarningText}>
                      ⛔ This combination is contraindicated. You must explicitly acknowledge the
                      danger before a vet override can be applied.
                    </Text>
                    <TouchableOpacity
                      style={styles.acknowledgeBtn}
                      onPress={() => setContraindicatedAcknowledged(true)}
                      testID="medication-interaction-acknowledge-button"
                    >
                      <Text style={styles.acknowledgeBtnText}>
                        I understand the risk — acknowledge
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

              {/* Override controls — only shown after contraindicated is acknowledged (or not present) */}
              {(!interactionResult.interactions.some((i) => i.severity === 'contraindicated') ||
                contraindicatedAcknowledged) && (
                <>
                  {!vetOverrideMode ? (
                    <TouchableOpacity
                      style={styles.overrideBtn}
                      onPress={() => setVetOverrideMode(true)}
                      testID="medication-vet-override-button"
                    >
                      <Text style={styles.overrideBtnText}>Vet Override</Text>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <TextInput
                        style={styles.input}
                        placeholder="Vet ID *"
                        value={vetId}
                        onChangeText={setVetId}
                        testID="medication-vet-id-input"
                      />
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Justification for override *"
                        multiline
                        value={overrideJustification}
                        onChangeText={setOverrideJustification}
                        testID="medication-override-justification-input"
                      />
                      <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={() => void handleSave()}
                        testID="medication-save-with-override-button"
                      >
                        <Text style={styles.saveBtnText}>Save with Override</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderRefillModal = () => (
    <Modal
      visible={refillModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setRefillModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: 30 }]}>
          <Text style={styles.modalTitle}>Mark Refill Complete</Text>
          {refillTargetMed && (
            <Text style={[styles.medDetail, { marginBottom: 12 }]}>
              {refillTargetMed.name} — enter new supply count
            </Text>
          )}
          <TextInput
            style={styles.input}
            placeholder="New dose / pill count"
            keyboardType="numeric"
            value={newSupplyInput}
            onChangeText={setNewSupplyInput}
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRefillModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => void handleRefillComplete()}>
              <Text style={styles.saveBtnText}>Confirm Refill</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Medications</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} testID="add-medication-button">
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        {(['list', 'daily', 'weekly'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
            testID={`medication-tab-${t}`}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'list' && displayLoading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonCard key={`skeleton-${index}`} />
          ))}
        </View>
      ) : tab === 'list' ? (
        <FlatList
          data={medications}
          keyExtractor={(item) => item.id}
          renderItem={renderMedItem}
          contentContainerStyle={styles.listContent}
          testID="medication-list"
          ListEmptyComponent={
            <EmptyState
              icon="medkit"
              title="No Medications"
              description="Keep track of your pet's prescriptions, dosages, and refill schedules."
              buttonText="Add medication"
              onPress={openAdd}
            />
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      ) : null}
      {tab === 'daily' && renderSchedule(todayDates())}
      {tab === 'weekly' && renderSchedule(weekDates())}
      {renderModal()}
      {renderRefillModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#4CAF50' },
  tabText: { color: '#666', fontSize: 14 },
  activeTabText: { color: '#4CAF50', fontWeight: '600' },
  listContent: { padding: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  medName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e8f5e9',
  },
  actionBtnText: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fdecea' },
  deleteBtnText: { color: '#e53935' },
  medDetail: { fontSize: 13, color: '#555', marginTop: 2 },
  lowStock: { color: '#e65100', fontWeight: '600' },
  doseActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  // Refill badge
  refillBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  refillBadgeOk: { backgroundColor: '#e8f5e9' },
  refillBadgeWarning: { backgroundColor: '#fff8e1' },
  refillBadgeUrgent: { backgroundColor: '#fdecea' },
  refillBadgeText: { fontSize: 11, fontWeight: '700' },
  pendingVetReviewBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
    backgroundColor: '#FFF3E0',
  },
  pendingVetReviewText: { fontSize: 11, fontWeight: '700', color: '#E65100' },
  logBtn: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipBtn: { backgroundColor: '#9e9e9e' },
  refillBtn: { backgroundColor: '#1565C0' },
  logBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  scheduleContainer: { flex: 1, padding: 12 },
  dayBlock: { marginBottom: 16 },
  dayLabel: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  slotTaken: { borderLeftColor: '#9e9e9e', opacity: 0.7 },
  slotTime: { fontSize: 13, fontWeight: '600', color: '#333', width: 60 },
  slotName: { flex: 1, fontSize: 13, color: '#555' },
  takenBadge: { fontSize: 16, color: '#4CAF50' },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  textArea: { height: 70, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  interactionWarning: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCA28',
  },
  interactionTitle: { fontSize: 15, fontWeight: '700', color: '#7B4F00', marginBottom: 8 },
  severityGroup: { marginBottom: 12 },
  severityBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  badgeContraindicated: { backgroundColor: '#B71C1C' },
  badgeSevere: { backgroundColor: '#E53935' },
  badgeModerate: { backgroundColor: '#F57C00' },
  badgeMild: { backgroundColor: '#F9A825' },
  severityBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  interactionItem: { marginBottom: 8, paddingLeft: 4 },
  interactionDrugs: { fontWeight: '700', fontSize: 13, color: '#1a1a1a', marginBottom: 2 },
  interactionDesc: { fontSize: 13, color: '#333', marginBottom: 2 },
  interactionRec: { fontSize: 12, color: '#555', fontStyle: 'italic' },
  contraindicatedWarning: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B71C1C',
  },
  contraindicatedWarningText: {
    fontSize: 13,
    color: '#B71C1C',
    fontWeight: '600',
    marginBottom: 8,
  },
  acknowledgeBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#B71C1C',
    alignItems: 'center',
  },
  acknowledgeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  overrideBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center',
  },
  overrideBtnText: { color: '#fff', fontWeight: '700' },
});

export default MedicationScreen;
