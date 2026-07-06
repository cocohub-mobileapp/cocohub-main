/**
 * DatePickerInput
 *
 * Cross-platform date selector. On iOS/Android it shows a native date picker
 * modal; on web it falls back to a plain text input accepting YYYY-MM-DD.
 *
 * Props:
 *  - label       Display label above the field
 *  - value       ISO date string (YYYY-MM-DD) or empty string
 *  - onChange    Called with new ISO date string when user picks a date
 *  - placeholder Shown when value is empty
 *  - minDate     Optional minimum selectable date
 *  - maxDate     Optional maximum selectable date
 *  - accessibilityLabel Optional a11y label
 */

import React, { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// We lazy-require DateTimePicker to avoid web bundle issues
let DateTimePicker: React.ComponentType<{
  value: Date;
  mode: 'date';
  display: string;
  onChange: (event: unknown, date?: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  textColor?: string;
}> | null = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch {
    DateTimePicker = null;
  }
}

interface Props {
  label?: string;
  value: string; // ISO YYYY-MM-DD
  onChange: (isoDate: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  accessibilityLabel?: string;
  style?: object;
  labelStyle?: object;
}

function toDate(iso: string): Date {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const DatePickerInput: React.FC<Props> = ({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  minDate,
  maxDate,
  accessibilityLabel,
  style,
  labelStyle,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value ? toDate(value) : new Date());

  // Web / no-native-module fallback
  if (Platform.OS === 'web' || !DateTimePicker) {
    return (
      <View style={style}>
        {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? 'YYYY-MM-DD'}
          placeholderTextColor="#bbb"
          keyboardType="number-pad"
          accessibilityLabel={accessibilityLabel ?? label}
          maxLength={10}
        />
      </View>
    );
  }

  // Android: show picker inline when tapped, confirm immediately on change
  if (Platform.OS === 'android') {
    return (
      <View style={style}>
        {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityValue={{ text: value ? formatDisplay(value) : placeholder }}
        >
          <Text style={[styles.inputText, !value && styles.placeholder]}>
            {value ? formatDisplay(value) : placeholder}
          </Text>
          <Text style={styles.calendarIcon}>📅</Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={value ? toDate(value) : new Date()}
            mode="date"
            display="default"
            minimumDate={minDate}
            maximumDate={maxDate}
            onChange={(_event, date) => {
              setShowPicker(false);
              if (date) onChange(toISO(date));
            }}
          />
        )}
      </View>
    );
  }

  // iOS: modal spinner
  return (
    <View style={style}>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
      <TouchableOpacity
        style={styles.input}
        onPress={() => {
          setTempDate(value ? toDate(value) : new Date());
          setShowPicker(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityValue={{ text: value ? formatDisplay(value) : placeholder }}
      >
        <Text style={[styles.inputText, !value && styles.placeholder]}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Toolbar */}
            <View style={styles.toolbar}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.toolbarCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.toolbarTitle}>{label ?? 'Select Date'}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPicker(false);
                  onChange(toISO(tempDate));
                }}
              >
                <Text style={styles.toolbarDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              minimumDate={minDate}
              maximumDate={maxDate}
              textColor="#1a1a1a"
              onChange={(_event, date) => {
                if (date) setTempDate(date);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fafafa',
  },
  inputText: {
    fontSize: 14,
    color: '#1a1a1a',
    flex: 1,
  },
  placeholder: {
    color: '#bbb',
  },
  calendarIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  toolbarCancel: {
    fontSize: 16,
    color: '#666',
  },
  toolbarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  toolbarDone: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
});

export default DatePickerInput;
