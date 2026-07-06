import apiClient from './apiClient';
import { getItem, setItem } from './localDB';
import { type Species } from '../models/Pet';
import { formatWeight, weightUnit } from '../utils/localeValues';

export interface BreedInsight {
  id: string;
  name: string;
  species: Species;
  lifeExpectancyYears: number;
  commonHealthConditions: string[];
  careRecommendations: string[];
  /** Typical healthy weight range in kg for an adult of this breed */
  weightRangeKg?: { min: number; max: number };
}

export interface BreedSegment {
  name: string;
  percentage: number;
}

export interface PetBreedInsights {
  breedDisplay: string;
  ageYears?: number;
  weightKg?: number;
  lifeExpectancyLabel: string;
  healthRisks: string[];
  careRecommendations: string[];
  /** Blended healthy weight range across breed mix */
  weightRangeKg?: { min: number; max: number };
  breakdown: Array<{
    name: string;
    percentage: number;
    lifeExpectancyYears?: number;
    healthConditions?: string[];
    weightRangeKg?: { min: number; max: number };
  }>;
}

const BREED_CACHE_KEY = '@breed_insight_database';

function normalizeBreedName(name: string): string {
  return name.trim().toLowerCase();
}

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

function parseBreedPart(text: string): BreedSegment {
  const raw = text.trim();
  const match = raw.match(/^(.+?)\s*\(?\s*([0-9]{1,3})\s*%\s*\)?$/);
  if (match) {
    const name = match[1].trim();
    const percentage = Math.min(100, Math.max(0, Number(match[2])));
    return { name, percentage };
  }

  return { name: raw, percentage: 0 };
}

export function parseBreedBreakdown(breedText: string): BreedSegment[] {
  if (!breedText.trim()) return [];

  const parts = breedText
    .split(new RegExp('[,+/]| and ', 'gi'))
    .map(parseBreedPart)
    .filter((part) => part.name.length > 0);

  const total = parts.reduce((sum, part) => sum + part.percentage, 0);
  if (total === 0 && parts.length > 0) {
    return parts.map((part) => ({ ...part, percentage: Math.round(100 / parts.length) }));
  }

  return parts.map((part) => ({
    ...part,
    percentage: total > 0 ? Math.round((part.percentage / total) * 100) : part.percentage,
  }));
}

function estimateAgeYears(dateOfBirth?: string): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const diff = Date.now() - dob.getTime();
  return Math.max(0, Math.floor(diff / 31_557_600_000));
}

function buildLifeExpectancyLabel(years: number): string {
  return `${years} year${years === 1 ? '' : 's'}`;
}

function getDefaultBreedInsight(species: Species): BreedInsight {
  const fallback: Record<Species, BreedInsight> = {
    dog: {
      id: 'generic-dog',
      name: 'Dog',
      species: 'dog',
      lifeExpectancyYears: 12,
      commonHealthConditions: ['obesity', 'dental disease', 'joint stress'],
      careRecommendations: [
        'Keep exercise consistent and avoid feeding extra treats.',
        'Brush teeth regularly and schedule wellness exams.',
        'Monitor joints and mobility throughout life.',
      ],
    },
    cat: {
      id: 'generic-cat',
      name: 'Cat',
      species: 'cat',
      lifeExpectancyYears: 14,
      commonHealthConditions: ['urinary tract disease', 'dental disease', 'obesity'],
      careRecommendations: [
        'Provide hydration and indoor environmental enrichment.',
        'Monitor litter box habits and dental health.',
        'Keep portions consistent to maintain ideal weight.',
      ],
    },
    rabbit: {
      id: 'generic-rabbit',
      name: 'Rabbit',
      species: 'rabbit',
      lifeExpectancyYears: 9,
      commonHealthConditions: ['digestive upset', 'dental overgrowth', 'obesity'],
      careRecommendations: [
        'Offer a high-fiber diet with fresh hay every day.',
        'Inspect teeth and feet frequently.',
        'Provide safe daily exercise outside the cage.',
      ],
    },
    bird: {
      id: 'generic-bird',
      name: 'Bird',
      species: 'bird',
      lifeExpectancyYears: 10,
      commonHealthConditions: [
        'respiratory sensitivity',
        'feather stress',
        'nutritional imbalance',
      ],
      careRecommendations: [
        'Keep cages clean and well-ventilated.',
        'Offer a balanced diet with fresh produce.',
        'Provide toys and interaction for mental stimulation.',
      ],
    },
    other: {
      id: 'generic-animal',
      name: 'Pet',
      species: 'other',
      lifeExpectancyYears: 12,
      commonHealthConditions: ['stress', 'obesity', 'dental disease'],
      careRecommendations: [
        'Keep regular wellness appointments with your veterinarian.',
        'Maintain a balanced diet and active routine.',
        'Monitor behavior and appetite for early warning signs.',
      ],
    },
  };

  return fallback[species] ?? fallback.other;
}

function mergeHealthRisks(breedResults: BreedInsight[]): string[] {
  const risks = new Set<string>();
  for (const breed of breedResults) {
    for (const risk of breed.commonHealthConditions) {
      risks.add(risk);
    }
  }
  return [...risks];
}

function getWeightRecommendations(species: Species, weightKg?: number): string[] {
  if (!weightKg || weightKg <= 0) {
    return [`Record your pet's weight in ${weightUnit()} to improve personalized care guidance.`];
  }

  const suggestions: string[] = [];
  if (species === 'dog' && weightKg >= 30) {
    suggestions.push(
      'Large or heavier dogs benefit from joint-supporting nutrition and controlled portions.',
    );
  }
  if (species === 'cat' && weightKg >= 6) {
    suggestions.push(
      'Maintain a regular activity routine and avoid overeating to support healthy weight.',
    );
  }
  if (weightKg > 0 && suggestions.length === 0) {
    suggestions.push(
      `Keep monitoring weight and aim for stable health at ${formatWeight(weightKg)}.`,
    );
  }

  return suggestions;
}

export function generateCareRecommendations(input: {
  species: Species;
  breedName?: string;
  ageYears?: number;
  weightKg?: number;
  healthRisks: string[];
}): string[] {
  const recommendations = new Set<string>();
  const ageYears = input.ageYears;

  if (ageYears !== undefined) {
    if (ageYears < 2) {
      recommendations.add('Young pets need frequent wellness exams and monitored vaccinations.');
    } else if (ageYears >= 8) {
      recommendations.add(
        'Senior pets benefit from twice-yearly checkups and joint mobility monitoring.',
      );
    } else {
      recommendations.add('Keep a consistent preventive care routine with yearly wellness visits.');
    }
  }

  if (input.breedName) {
    if (/bulldog|pug|boxer/i.test(input.breedName)) {
      recommendations.add('Watch for breathing issues and avoid excessive heat or exertion.');
    }
    if (/chihuahua|toy|miniature/i.test(input.breedName)) {
      recommendations.add('Use a harness and avoid slips or falls for small-breed safety.');
    }
  }

  if (input.healthRisks.some((risk) => /hip|joint|mobility/i.test(risk))) {
    recommendations.add('Support joint health with moderate exercise and a weight-safe diet.');
  }
  if (input.healthRisks.some((risk) => /dental|tooth/i.test(risk))) {
    recommendations.add('Brush teeth regularly and schedule dental exams with your veterinarian.');
  }
  if (input.healthRisks.some((risk) => /urinary|kidney/i.test(risk))) {
    recommendations.add('Provide fresh water and monitor litter habits to support urinary health.');
  }
  if (input.healthRisks.some((risk) => /respiratory|brachycephalic/i.test(risk))) {
    recommendations.add('Avoid exposure to smoke and heat, and keep activity calm on warm days.');
  }

  for (const tip of getWeightRecommendations(input.species, input.weightKg)) {
    recommendations.add(tip);
  }

  if (input.healthRisks.length === 0) {
    recommendations.add(
      'Talk to your veterinarian about breed-specific wellness tests and lifestyle guidance.',
    );
  }

  return Array.from(recommendations);
}

export async function getBreedList(): Promise<BreedInsight[]> {
  const cached = await getItem(BREED_CACHE_KEY);
  let cachedBreeds: BreedInsight[] = [];
  if (cached) {
    try {
      cachedBreeds = JSON.parse(cached) as BreedInsight[];
    } catch {
      cachedBreeds = [];
    }
  }

  try {
    const response = await apiClient.get<ApiResponse<BreedInsight[]> | BreedInsight[]>('/breeds');
    const breeds = unwrapApiData(response.data);
    await setItem(BREED_CACHE_KEY, JSON.stringify(breeds));
    return breeds;
  } catch {
    if (cachedBreeds.length > 0) return cachedBreeds;
    throw new Error('Unable to load breed information at this time.');
  }
}

export async function searchBreedSuggestions(query: string): Promise<string[]> {
  const normalized = query.trim().toLowerCase();
  const breedList = await getBreedList();
  return breedList
    .filter((breed) => breed.name.toLowerCase().includes(normalized))
    .slice(0, 8)
    .map((breed) => breed.name);
}

export async function getBreedInsightsForPet(input: {
  breed?: string;
  species: Species;
  dateOfBirth?: string;
  weightKg?: number;
}): Promise<PetBreedInsights> {
  const ageYears = estimateAgeYears(input.dateOfBirth);
  const segments = parseBreedBreakdown(input.breed ?? '');
  const breedList = await getBreedList();

  const breakdown = segments.map((segment) => {
    const found = breedList.find(
      (breed) => normalizeBreedName(breed.name) === normalizeBreedName(segment.name),
    );
    return {
      name: segment.name.trim(),
      percentage: segment.percentage,
      lifeExpectancyYears: found?.lifeExpectancyYears,
      healthConditions: found?.commonHealthConditions,
      weightRangeKg: found?.weightRangeKg,
    };
  });

  const breedResults = breakdown
    .map((entry) => {
      const found = breedList.find(
        (breed) => normalizeBreedName(breed.name) === normalizeBreedName(entry.name),
      );
      return found ?? getDefaultBreedInsight(input.species);
    })
    .filter(Boolean);

  const lifeExpectancyYears = Math.round(
    breedResults.reduce((sum, breed, index) => {
      const percentage = breakdown[index]?.percentage ?? 0;
      return sum + breed.lifeExpectancyYears * (percentage / 100 || 1 / breedResults.length);
    }, 0),
  );

  const healthRisks = mergeHealthRisks(breedResults);
  const careRecommendations = generateCareRecommendations({
    species: input.species,
    breedName: input.breed,
    ageYears,
    weightKg: input.weightKg,
    healthRisks,
  });

  const breedDisplay = breakdown.length
    ? breakdown
        .map((segment) => `${segment.name}${segment.percentage ? ` (${segment.percentage}%)` : ''}`)
        .join(' + ')
    : 'Unknown';

  return {
    breedDisplay,
    ageYears,
    weightKg: input.weightKg,
    lifeExpectancyLabel:
      lifeExpectancyYears > 0 ? buildLifeExpectancyLabel(lifeExpectancyYears) : 'Unknown',
    healthRisks,
    careRecommendations,
    weightRangeKg: (() => {
      // Blend weight ranges weighted by breed percentage
      const ranged = breakdown.filter((b) => b.weightRangeKg);
      if (ranged.length === 0) return undefined;
      const totalPct = ranged.reduce((s, b) => s + (b.percentage || 1), 0);
      const min = ranged.reduce(
        (s, b) => s + (b.weightRangeKg!.min * (b.percentage || 1)) / totalPct,
        0,
      );
      const max = ranged.reduce(
        (s, b) => s + (b.weightRangeKg!.max * (b.percentage || 1)) / totalPct,
        0,
      );
      return { min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 };
    })(),
    breakdown,
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default {
  getBreedList,
  searchBreedSuggestions,
  getBreedInsightsForPet,
  getPetBreedInsights: getBreedInsightsForPet,
  parseBreedBreakdown,
  generateCareRecommendations,
  /** Returns blended healthy weight range for a pet, or null if unknown */
  async getPetWeightRange(input: {
    breed?: string;
    species: Species;
  }): Promise<{ min: number; max: number } | null> {
    if (!input.breed) return null;
    try {
      const insights = await getBreedInsightsForPet(input);
      return insights.weightRangeKg ?? null;
    } catch {
      return null;
    }
  },
};
