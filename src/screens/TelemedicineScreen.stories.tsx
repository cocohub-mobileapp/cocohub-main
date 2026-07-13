import type { Meta, StoryObj } from '@storybook/react';
import { Text, View } from 'react-native';

import { darkTheme, lightTheme } from '../theme/colors';

const BookingCardPreview = ({ colors }: { colors: typeof lightTheme }) => (
  <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
    <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
      Telemedicine
    </Text>
    <Text style={{ color: colors.secondaryText, marginBottom: 16 }}>
      Book a video consultation with a licensed veterinarian.
    </Text>
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.info,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontWeight: '700', color: colors.text }}>Dr. Rivera</Text>
      <Text style={{ color: colors.secondaryText, marginTop: 4 }}>Small animal medicine</Text>
    </View>
    <View
      style={{
        backgroundColor: colors.info,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.white, fontWeight: '700' }}>Book Telemedicine Appointment</Text>
    </View>
  </View>
);

const meta: Meta<typeof BookingCardPreview> = {
  title: 'Screens/TelemedicineBooking',
  component: BookingCardPreview,
};

export default meta;

type Story = StoryObj<typeof BookingCardPreview>;

export const LightMode: Story = {
  render: () => <BookingCardPreview colors={lightTheme} />,
};

export const DarkMode: Story = {
  render: () => <BookingCardPreview colors={darkTheme} />,
};
