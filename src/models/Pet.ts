/**
 * Pet model for mobile app
 */

export type Species =
  | 'dog'
  | 'cat'
  | 'bird'
  | 'rabbit'
  | 'hamster'
  | 'guinea_pig'
  | 'fish'
  | 'reptile'
  | 'horse'
  | 'ferret'
  | 'turtle'
  | 'other';

/** Human-readable label + emoji for each species, used in forms and UI */
export const SPECIES_OPTIONS: { value: Species; label: string; emoji: string }[] = [
  { value: 'dog', label: 'Dog', emoji: '🐕' },
  { value: 'cat', label: 'Cat', emoji: '🐈' },
  { value: 'bird', label: 'Bird', emoji: '🐦' },
  { value: 'rabbit', label: 'Rabbit', emoji: '🐇' },
  { value: 'hamster', label: 'Hamster', emoji: '🐹' },
  { value: 'guinea_pig', label: 'Guinea Pig', emoji: '🐾' },
  { value: 'fish', label: 'Fish', emoji: '🐠' },
  { value: 'reptile', label: 'Reptile', emoji: '🦎' },
  { value: 'horse', label: 'Horse', emoji: '🐴' },
  { value: 'ferret', label: 'Ferret', emoji: '🦔' },
  { value: 'turtle', label: 'Turtle', emoji: '🐢' },
  { value: 'other', label: 'Other', emoji: '🐾' },
];

/** Returns the emoji for a given species */
export const getSpeciesEmoji = (species: Species): string =>
  SPECIES_OPTIONS.find((s) => s.value === species)?.emoji ?? '🐾';

/** Returns the display label for a given species */
export const getSpeciesLabel = (species: Species): string =>
  SPECIES_OPTIONS.find((s) => s.value === species)?.label ?? 'Other';

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed?: string;
  dateOfBirth?: string;
  weightKg?: number;
  microchipId?: string;
  photoUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: { stepGoal?: number; [key: string]: unknown };
}

/**
 * Factory to safely create a Pet object from raw data,
 * ensuring all required fields have sensible defaults.
 */
export const createPet = (data: Partial<Pet>): Pet => ({
  id: data.id || '',
  name: data.name || 'Unknown Pet',
  species: data.species || 'other',
  breed: data.breed,
  dateOfBirth: data.dateOfBirth,
  weightKg: data.weightKg,
  microchipId: data.microchipId,
  photoUrl: data.photoUrl,
  ownerId: data.ownerId || '',
  createdAt: data.createdAt || new Date().toISOString(),
  updatedAt: data.updatedAt || new Date().toISOString(),
  metadata: data.metadata,
});

export interface PetFormData {
  name: string;
  species: Species;
  breed?: string;
  dateOfBirth?: string;
  weightKg?: number;
  microchipId?: string;
  photoUrl?: string;
}

export const validatePet = (data: Partial<PetFormData>): string[] => {
  const errors: string[] = [];

  if (!data.name?.trim()) {
    errors.push('Name is required');
  }

  if (!data.species) {
    errors.push('Species is required');
  }

  if (data.microchipId && !/^[0-9A-Fa-f]{15}$/.test(data.microchipId)) {
    errors.push('Microchip ID must be 15 hexadecimal characters');
  }

  if (data.photoUrl && !isValidImageUrl(data.photoUrl)) {
    errors.push('Invalid photo URL format');
  }

  return errors;
};

const isValidImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
};
