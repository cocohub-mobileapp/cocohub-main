import axios from 'axios';

import apiClient from './apiClient';
import { getItem, setItem, removeItem } from './localDB';
import offlineQueue from './offlineQueue';
import { scanQRCode, type QRScanResult } from './qrCodeService';
import type { Species } from '../models/Pet';
import { logError } from '../utils/errorLogger';
import { pickImage, compressImage, generateThumbnail, uploadToStorage } from '../utils/imageUtils';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface PetOwnerSummary {
  id: string;
  name: string;
  email: string;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed?: string;
  dateOfBirth?: string;
  weightKg?: number;
  microchipId?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  ownerId: string;
  owner?: PetOwnerSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePetInput {
  name: string;
  species: Species;
  breed?: string;
  dateOfBirth?: string;
  weightKg?: number;
  microchipId?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  ownerId: string;
}

export interface UpdatePetInput {
  name?: string;
  species?: Species;
  breed?: string;
  dateOfBirth?: string;
  weightKg?: number;
  microchipId?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  metadata?: { stepGoal?: number; [key: string]: unknown };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PETS_CACHE_KEY = '@pets_list';
const PET_CACHE_PREFIX = '@pet_';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cachePets(pets: Pet[]): Promise<void> {
  await setItem(PETS_CACHE_KEY, JSON.stringify(pets));
  // Also cache individual pets
  await Promise.all(
    pets.map((pet) => setItem(`${PET_CACHE_PREFIX}${pet.id}`, JSON.stringify(pet))),
  );
}

async function getCachedPets(): Promise<Pet[]> {
  const cached = await getItem(PETS_CACHE_KEY);
  return cached ? JSON.parse(cached) : [];
}

async function getCachedPet(petId: string): Promise<Pet | null> {
  const cached = await getItem(`${PET_CACHE_PREFIX}${petId}`);
  return cached ? JSON.parse(cached) : null;
}

// ─────────────────────────────────────────────
// ERROR CLASS
// ─────────────────────────────────────────────

export class PetServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PetServiceError';
  }
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const _QR_DEEP_LINK_PREFIX = 'cocohub://pet/';
const _PETS_ENDPOINT = '/pets';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function unwrapApiData<T>(payload: ApiResponse<T> | T): T {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    (payload as ApiResponse<T>).success === true &&
    'data' in payload
  ) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
}

function petFromQRData(scan: QRScanResult): Pet | null {
  if (!scan.petId || !scan.petData) return null;

  const now = new Date().toISOString();
  return {
    id: scan.petId,
    name: scan.petData.name || 'Unknown Pet',
    species: scan.petData.species || 'other',
    breed: scan.petData.breed,
    weightKg: scan.petData.weightKg,
    microchipId: scan.petData.microchipId,
    photoUrl: scan.petData.photoUrl,
    ownerId: scan.petData.ownerId || '',
    createdAt: scan.petData.createdAt || now,
    updatedAt: scan.petData.updatedAt || now,
  };
}

function logPetError(error: Error, context: Record<string, unknown>) {
  logError(error, context);
}

function toPetServiceError(error: unknown, context: Record<string, unknown>): PetServiceError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Pet API request failed';

    const code = error.response?.data?.error?.code || (status ? `HTTP_${status}` : 'NETWORK_ERROR');

    const finalError = new PetServiceError(message, code, status, error.response?.data);

    logPetError(finalError, {
      service: 'petService',
      action: 'api_error',
      status: status ?? null,
      context,
    });

    return finalError;
  }

  if (error instanceof PetServiceError) {
    logPetError(error, {
      service: 'petService',
      action: 'known_error',
      context,
    });
    return error;
  }

  const finalError = new PetServiceError(
    error instanceof Error ? error.message : 'Unexpected pet service error',
    'UNKNOWN_ERROR',
  );

  logPetError(finalError, {
    service: 'petService',
    action: 'unknown_error',
    context,
  });

  return finalError;
}

// ─────────────────────────────────────────────
// API METHODS
// ─────────────────────────────────────────────

export async function getAllPets(): Promise<Pet[]> {
  try {
    const response = await apiClient.get<ApiResponse<Pet[]> | Pet[]>('/pets');
    const pets = unwrapApiData(response.data);
    await cachePets(pets);
    return pets;
  } catch (error) {
    const cached = await getCachedPets();
    if (cached.length > 0) return cached;
    throw toPetServiceError(error, { action: 'get_all_pets' });
  }
}

export async function getPetById(petId: string): Promise<Pet> {
  const id = petId.trim();
  if (!id) {
    const err = new PetServiceError('Pet ID is required', 'INVALID_PET_ID');
    logPetError(err, { service: 'petService', action: 'validation' });
    throw err;
  }

  try {
    const response = await apiClient.get(`/pets/${encodeURIComponent(id)}`);
    const pet = unwrapApiData(response.data);
    await setItem(`${PET_CACHE_PREFIX}${pet.id}`, JSON.stringify(pet));
    return pet;
  } catch (error) {
    const cached = await getCachedPet(id);
    if (cached) return cached;
    throw toPetServiceError(error, { action: 'get_pet_by_id', petId: id });
  }
}

export async function getPetByQRCode(qrCode: string): Promise<Pet> {
  const value = qrCode.trim();

  if (!value) {
    const err = new PetServiceError('QR code is required', 'INVALID_QR_CODE');
    logPetError(err, { service: 'petService', action: 'qr_validation' });
    throw err;
  }

  const scan = await scanQRCode(value);
  if (!scan.valid || !scan.petId) {
    const err = new PetServiceError(scan.error || 'Invalid QR code', 'INVALID_QR_CODE');
    logPetError(err, { service: 'petService', action: 'qr_parse' });
    throw err;
  }

  const cached = await getCachedPet(scan.petId);
  if (cached) return cached;

  const cachedList = await getCachedPets();
  const listMatch = cachedList.find((pet) => pet.id === scan.petId);
  if (listMatch) {
    await setItem(`${PET_CACHE_PREFIX}${listMatch.id}`, JSON.stringify(listMatch));
    return listMatch;
  }

  const embeddedPet = petFromQRData(scan);
  if (embeddedPet) {
    await setItem(`${PET_CACHE_PREFIX}${embeddedPet.id}`, JSON.stringify(embeddedPet));
    return embeddedPet;
  }

  const err = new PetServiceError('Pet not found in local storage', 'LOCAL_PET_NOT_FOUND');
  logPetError(err, { service: 'petService', action: 'qr_local_lookup', petId: scan.petId });
  throw err;
}

export async function createPet(data: CreatePetInput): Promise<Pet> {
  try {
    // If online, this will go through, otherwise it throws and we catch
    const response = await apiClient.post('/pets', data);
    const pet = unwrapApiData(response.data);
    await setItem(`${PET_CACHE_PREFIX}${pet.id}`, JSON.stringify(pet));
    return pet;
  } catch (error) {
    // Check if it's a network error
    if (axios.isAxiosError(error) && !error.response) {
      const tempId = `temp_${Date.now()}`;
      const newPet: Pet = {
        ...data,
        id: tempId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await offlineQueue.enqueue('pet', 'create', newPet as unknown as Record<string, unknown>);
      await setItem(`${PET_CACHE_PREFIX}${tempId}`, JSON.stringify(newPet));

      // Update pets list cache
      const list = await getCachedPets();
      list.push(newPet);
      await setItem(PETS_CACHE_KEY, JSON.stringify(list));

      return newPet;
    }
    throw toPetServiceError(error, { action: 'create_pet' });
  }
}

export async function updatePet(petId: string, data: UpdatePetInput): Promise<Pet> {
  const id = petId.trim();

  if (!id) {
    const err = new PetServiceError('Pet ID is required', 'INVALID_PET_ID');
    logPetError(err, { service: 'petService', action: 'update_validation' });
    throw err;
  }

  try {
    const response = await apiClient.put(`/pets/${encodeURIComponent(id)}`, data);
    const pet = unwrapApiData(response.data);
    await setItem(`${PET_CACHE_PREFIX}${pet.id}`, JSON.stringify(pet));
    return pet;
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      const current = await getCachedPet(id);
      if (current) {
        const updatedPet = { ...current, ...data, updatedAt: new Date().toISOString() };
        await offlineQueue.enqueue('pet', 'update', { id, ...data });
        await setItem(`${PET_CACHE_PREFIX}${id}`, JSON.stringify(updatedPet));

        // Update list cache
        const list = await getCachedPets();
        const idx = list.findIndex((p) => p.id === id);
        if (idx >= 0) {
          list[idx] = updatedPet;
          await setItem(PETS_CACHE_KEY, JSON.stringify(list));
        }

        return updatedPet;
      }
    }
    throw toPetServiceError(error, { action: 'update_pet', petId: id });
  }
}

export async function deletePet(petId: string): Promise<void> {
  const id = petId.trim();

  if (!id) {
    const err = new PetServiceError('Pet ID is required', 'INVALID_PET_ID');
    logPetError(err, { service: 'petService', action: 'delete_validation' });
    throw err;
  }

  try {
    await apiClient.delete(`/pets/${encodeURIComponent(id)}`);
    await removeItem(`${PET_CACHE_PREFIX}${id}`);
    const list = await getCachedPets();
    await setItem(PETS_CACHE_KEY, JSON.stringify(list.filter((p) => p.id !== id)));
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      await offlineQueue.enqueue('pet', 'delete', { id });
      await removeItem(`${PET_CACHE_PREFIX}${id}`);
      const list = await getCachedPets();
      await setItem(PETS_CACHE_KEY, JSON.stringify(list.filter((p) => p.id !== id)));
      return;
    }
    throw toPetServiceError(error, { action: 'delete_pet', petId: id });
  }
}

export async function uploadPetPhoto(
  petId: string,
): Promise<{ photoUrl: string; thumbnailUrl: string } | null> {
  try {
    const image = await pickImage();
    if (!image) return null;

    const compressed = await compressImage(image.uri);
    const _thumbnail = await generateThumbnail(image.uri);

    const upload = await uploadToStorage(compressed.uri, petId);

    await updatePet(petId, {
      photoUrl: upload.url,
      thumbnailUrl: upload.thumbnailUrl,
    });

    return { photoUrl: upload.url, thumbnailUrl: upload.thumbnailUrl };
  } catch (error) {
    throw toPetServiceError(error, {
      action: 'upload_pet_photo',
      petId,
    });
  }
}

// Default export for screens that import petService as default
const petService = {
  getAllPets,
  getPetById,
  getPetByQRCode,
  createPet,
  updatePet,
  deletePet,
  uploadPetPhoto,
};

export default petService;
