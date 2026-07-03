import apiClient from './apiClient';
import { type Species } from '../models/Pet';

export type SymptomKey =
  | 'vomiting'
  | 'diarrhea'
  | 'not_eating'
  | 'lethargy'
  | 'coughing'
  | 'sneezing'
  | 'difficulty_breathing'
  | 'itching'
  | 'ear_scratching'
  | 'limping'
  | 'eye_discharge'
  | 'urination_changes'
  | 'seizure'
  | 'toxin_exposure'
  | 'swelling_or_bloat';

export type UrgencyLevel = 'monitor' | 'soon' | 'urgent' | 'emergency';
export type Likelihood = 'low' | 'medium' | 'high';

export interface SymptomOption {
  id: SymptomKey;
  label: string;
}

export interface SymptomCheckerInput {
  species?: Species;
  breed?: string;
  symptoms: SymptomKey[];
  freeText?: string;
  ageYears?: number;
}

export interface SymptomCondition {
  id: string;
  name: string;
  likelihood: Likelihood;
  urgency: UrgencyLevel;
  rationale: string[];
  nextSteps: string[];
}

export interface SymptomCheckResult {
  disclaimer: string;
  urgency: UrgencyLevel;
  urgencyLabel: string;
  normalizedSymptoms: SymptomOption[];
  redFlags: string[];
  conditions: SymptomCondition[];
  breedRisks: string[];
  nextSteps: string[];
  missingContext: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const SYMPTOM_OPTIONS: SymptomOption[] = [
  { id: 'vomiting', label: 'Vomiting' },
  { id: 'diarrhea', label: 'Diarrhea' },
  { id: 'not_eating', label: 'Not eating' },
  { id: 'lethargy', label: 'Lethargy' },
  { id: 'coughing', label: 'Coughing' },
  { id: 'sneezing', label: 'Sneezing' },
  { id: 'difficulty_breathing', label: 'Difficulty breathing' },
  { id: 'itching', label: 'Itching or rash' },
  { id: 'ear_scratching', label: 'Ear scratching' },
  { id: 'limping', label: 'Limping' },
  { id: 'eye_discharge', label: 'Eye discharge' },
  { id: 'urination_changes', label: 'Urination changes' },
  { id: 'seizure', label: 'Seizure' },
  { id: 'toxin_exposure', label: 'Possible toxin exposure' },
  { id: 'swelling_or_bloat', label: 'Swollen belly or bloat' },
];

export async function checkSymptoms(input: SymptomCheckerInput): Promise<SymptomCheckResult> {
  const response = await apiClient.post<ApiResponse<SymptomCheckResult>>(
    '/symptom-checker/check',
    input,
  );
  return response.data.data;
}
