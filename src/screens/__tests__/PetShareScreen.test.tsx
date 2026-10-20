import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import PetShareScreen from '../PetShareScreen';
import { generateQR } from '../../services/qrCodeService';
import { getPetById } from '../../services/petService';

jest.mock('../../services/qrCodeService', () => ({
  generateQR: jest.fn().mockResolvedValue({
    qrData: 'cocohub://share/pet-123',
    token: 'token-abc',
    qrImageUrl: 'https://api.cocohub.app/qr/mock.png',
  }),
  getQRImageUrl: jest.fn().mockReturnValue('https://api.cocohub.app/qr/mock.png'),
  printPetQRCode: jest.fn(),
  revokeQRCode: jest.fn(),
  sharePetQRCode: jest.fn(),
}));

jest.mock('../../services/petService', () => ({
  getPetById: jest.fn().mockResolvedValue({
    id: 'pet-123',
    name: 'Bella',
    species: 'dog',
    breed: 'Beagle',
    microchipId: 'CHIP-999',
  }),
}));

describe('PetShareScreen QR Share Flow (#48)', () => {
  it('renders PetShareScreen and generates QR code on button tap', async () => {
    const onBack = jest.fn();
    const { getByTestId, getByText } = render(
      <PetShareScreen petId="pet-123" petName="Bella" onBack={onBack} />
    );

    expect(getByTestId('pet-share-screen')).toBeTruthy();
    expect(getByText('QR Code')).toBeTruthy();

    const generateBtn = getByTestId('generate-qr-button');
    fireEvent.press(generateBtn);

    await waitFor(() => {
      expect(generateQR).toHaveBeenCalled();
      expect(getByTestId('qr-code-image')).toBeTruthy();
      expect(getByTestId('share-qr-button')).toBeTruthy();
    });
  });
});
