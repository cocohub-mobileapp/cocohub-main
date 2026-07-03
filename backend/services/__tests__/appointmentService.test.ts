import { errorHandler } from '../../middleware/errorHandler';
import { AppointmentStatus } from '../../models/Appointment';
import apiClient from '../apiClient';
import {
  getAppointments,
  createAppointment,
  cancelAppointment,
  getUpcomingAppointments,
} from '../appointmentService';

jest.mock('../apiClient');
jest.mock('../../middleware/errorHandler');

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedErrorHandler = errorHandler as jest.Mock;

describe('backend appointmentService', () => {
  const mockAppointment = {
    id: 'apt-1',
    petId: 'pet-1',
    title: 'Vet Checkup',
    date: '2025-12-01',
    time: '10:00',
    status: AppointmentStatus.SCHEDULED,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAppointments', () => {
    it('should return all appointments', async () => {
      mockedApiClient.get.mockResolvedValue({ data: { data: [mockAppointment] } });
      const response = await getAppointments();
      expect(response.data).toHaveLength(1);
    });

    it('should filter by petId', async () => {
      mockedApiClient.get.mockResolvedValue({ data: { data: [mockAppointment] } });
      await getAppointments('pet-1');
      expect(mockedApiClient.get).toHaveBeenCalledWith('/appointments', {
        params: { petId: 'pet-1' },
      });
    });

    it('should throw error on failure', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('error'));
      mockedErrorHandler.mockReturnValue({ message: 'Handled error' });
      await expect(getAppointments()).rejects.toThrow('Handled error');
    });
  });

  describe('createAppointment', () => {
    it('should create an appointment', async () => {
      mockedApiClient.post.mockResolvedValue({ data: { data: mockAppointment } });
      const response = await createAppointment({ title: 'New' } as any);
      expect(response.data.id).toBe('apt-1');
    });
  });

  describe('cancelAppointment', () => {
    it('should update status to cancelled', async () => {
      mockedApiClient.put.mockResolvedValue({
        data: { data: { ...mockAppointment, status: AppointmentStatus.CANCELLED } },
      });
      const response = await cancelAppointment('apt-1');
      expect(response.data.status).toBe(AppointmentStatus.CANCELLED);
    });
  });

  describe('getUpcomingAppointments', () => {
    it('should filter only upcoming scheduled appointments', async () => {
      const pastApt = { ...mockAppointment, id: 'apt-past', date: '2020-01-01' };
      const upcomingApt = { ...mockAppointment, id: 'apt-future', date: '2030-01-01' };
      const cancelledApt = {
        ...mockAppointment,
        id: 'apt-cancelled',
        date: '2026-01-01',
        status: AppointmentStatus.CANCELLED,
      };

      mockedApiClient.get.mockResolvedValue({
        data: { data: [pastApt, upcomingApt, cancelledApt] },
      });

      const response = await getUpcomingAppointments();
      expect(response.data).toHaveLength(1);
      expect(response.data[0].id).toBe('apt-future');
    });
  });
});
