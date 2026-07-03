import { breedDatabase, type BreedInfo, type Species } from '../src/data/breeds';

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
  aliases: string[];
}

export interface SymptomCheckerInput {
  species?: Species | string;
  breed?: string;
  symptoms?: string[];
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
  normalizedSymptoms: Array<{ id: SymptomKey; label: string }>;
  redFlags: string[];
  conditions: SymptomCondition[];
  breedRisks: string[];
  nextSteps: string[];
  missingContext: string[];
}

interface ConditionRule {
  id: string;
  name: string;
  symptoms: SymptomKey[];
  textKeywords: string[];
  breedKeywords: string[];
  urgency: UrgencyLevel;
  rationale: string;
  nextSteps: string[];
}

export const VETERINARY_DISCLAIMER =
  'This is not veterinary advice. Use this checker to decide how quickly to contact a licensed veterinarian.';

export const SYMPTOM_OPTIONS: SymptomOption[] = [
  { id: 'vomiting', label: 'Vomiting', aliases: ['vomit', 'throwing up', 'retching'] },
  { id: 'diarrhea', label: 'Diarrhea', aliases: ['loose stool', 'runny stool'] },
  {
    id: 'not_eating',
    label: 'Not eating',
    aliases: ['no appetite', 'appetite loss', 'refusing food'],
  },
  { id: 'lethargy', label: 'Lethargy', aliases: ['tired', 'weak', 'low energy', 'sluggish'] },
  { id: 'coughing', label: 'Coughing', aliases: ['cough', 'honking', 'hacking'] },
  { id: 'sneezing', label: 'Sneezing', aliases: ['sneeze', 'nasal discharge', 'runny nose'] },
  {
    id: 'difficulty_breathing',
    label: 'Difficulty breathing',
    aliases: ['labored breathing', 'gasping', 'wheezing', 'blue gums'],
  },
  { id: 'itching', label: 'Itching or rash', aliases: ['itchy', 'scratching', 'rash', 'hot spot'] },
  {
    id: 'ear_scratching',
    label: 'Ear scratching',
    aliases: ['head shaking', 'ear odor', 'ear discharge'],
  },
  { id: 'limping', label: 'Limping', aliases: ['lameness', 'favoring leg', 'stiffness'] },
  {
    id: 'eye_discharge',
    label: 'Eye discharge',
    aliases: ['watery eye', 'red eye', 'squinting'],
  },
  {
    id: 'urination_changes',
    label: 'Urination changes',
    aliases: ['peeing often', 'blood in urine', 'straining to pee', 'accidents'],
  },
  { id: 'seizure', label: 'Seizure', aliases: ['convulsion', 'fits', 'tremors'] },
  {
    id: 'toxin_exposure',
    label: 'Possible toxin exposure',
    aliases: ['poison', 'ate chocolate', 'ate grapes', 'medication ingestion'],
  },
  {
    id: 'swelling_or_bloat',
    label: 'Swollen belly or bloat',
    aliases: ['bloated', 'distended belly', 'hard abdomen'],
  },
];

const conditionRules: ConditionRule[] = [
  {
    id: 'gastrointestinal-upset',
    name: 'Digestive upset or gastroenteritis',
    symptoms: ['vomiting', 'diarrhea', 'not_eating', 'lethargy'],
    textKeywords: ['stomach', 'nausea', 'food change', 'garbage', 'blood in stool'],
    breedKeywords: ['gastric', 'digestive', 'torsion', 'bloat'],
    urgency: 'soon',
    rationale:
      'Vomiting, diarrhea, appetite loss, and low energy often point to digestive illness.',
    nextSteps: [
      'Call your vet if vomiting or diarrhea repeats, contains blood, or lasts more than 24 hours.',
      'Offer water frequently and avoid new foods until a vet advises otherwise.',
    ],
  },
  {
    id: 'respiratory-illness',
    name: 'Respiratory irritation or infection',
    symptoms: ['coughing', 'sneezing', 'difficulty_breathing', 'lethargy'],
    textKeywords: ['nasal', 'wheeze', 'wheezing', 'kennel cough', 'congestion'],
    breedKeywords: ['airway', 'tracheal', 'respiratory', 'heat intolerance'],
    urgency: 'urgent',
    rationale: 'Coughing, sneezing, and breathing changes can progress quickly in pets.',
    nextSteps: [
      'Keep the pet calm and avoid strenuous activity.',
      'Seek same-day care for persistent cough, fever, blue gums, or any labored breathing.',
    ],
  },
  {
    id: 'skin-allergy',
    name: 'Skin allergy, irritation, or parasite reaction',
    symptoms: ['itching', 'ear_scratching'],
    textKeywords: ['flea', 'rash', 'hot spot', 'red skin', 'hair loss'],
    breedKeywords: ['skin', 'dermatitis', 'allergy', 'ear infections'],
    urgency: 'soon',
    rationale:
      'Itching, rash, and ear irritation are common with allergies, parasites, or infection.',
    nextSteps: [
      'Prevent licking or chewing if possible and photograph skin changes for the vet.',
      'Schedule a visit if itching is intense, skin is open, or ears smell painful or swollen.',
    ],
  },
  {
    id: 'ear-infection',
    name: 'Possible ear infection',
    symptoms: ['ear_scratching'],
    textKeywords: ['ear odor', 'ear discharge', 'head tilt', 'head shaking'],
    breedKeywords: ['ear infections'],
    urgency: 'soon',
    rationale: 'Ear scratching, odor, discharge, or head shaking can indicate an ear infection.',
    nextSteps: [
      'Do not put medication in the ear unless your vet prescribed it for this episode.',
      'Book a vet exam to check the ear canal and eardrum.',
    ],
  },
  {
    id: 'orthopedic-pain',
    name: 'Orthopedic pain, strain, or joint condition',
    symptoms: ['limping', 'lethargy'],
    textKeywords: ['injury', 'fall', 'swollen paw', 'joint', 'back pain'],
    breedKeywords: ['hip', 'patella', 'disc', 'myelopathy', 'joint', 'arthritis'],
    urgency: 'soon',
    rationale:
      'Limping or stiffness can come from soft-tissue injury, joint disease, or back pain.',
    nextSteps: [
      'Limit running, jumping, and stairs until evaluated.',
      'Seek urgent care if the pet cannot bear weight, cries in pain, or has a suspected fracture.',
    ],
  },
  {
    id: 'urinary-issue',
    name: 'Urinary tract irritation or blockage risk',
    symptoms: ['urination_changes', 'lethargy', 'not_eating'],
    textKeywords: ['straining', 'blood in urine', 'litter box', 'accidents', 'cannot pee'],
    breedKeywords: ['urinary', 'kidney', 'renal'],
    urgency: 'urgent',
    rationale: 'Changes in urination can signal infection, stones, inflammation, or blockage.',
    nextSteps: [
      'Track frequency, urine color, and whether any urine is passing.',
      'Treat inability to urinate as an emergency, especially in cats.',
    ],
  },
  {
    id: 'eye-irritation',
    name: 'Eye irritation or infection',
    symptoms: ['eye_discharge'],
    textKeywords: ['red eye', 'squinting', 'cloudy eye', 'pawing eye'],
    breedKeywords: ['eye', 'retinal'],
    urgency: 'soon',
    rationale: 'Eye redness, discharge, or squinting can worsen without prompt care.',
    nextSteps: [
      'Prevent rubbing at the eye and avoid human eye drops.',
      'Arrange a vet visit within 24 hours for squinting, pain, cloudiness, or trauma.',
    ],
  },
];

const urgencyRank: Record<UrgencyLevel, number> = {
  monitor: 0,
  soon: 1,
  urgent: 2,
  emergency: 3,
};

const likelihoodRank: Record<Likelihood, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function normalizeText(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function includesPhrase(text: string, phrase: string): boolean {
  return text.includes(phrase.toLowerCase());
}

function findBreed(breed?: string): BreedInfo | undefined {
  const normalized = normalizeText(breed);
  if (!normalized) return undefined;

  return breedDatabase.find((candidate) => {
    const name = normalizeText(candidate.name);
    return name === normalized || name.includes(normalized) || normalized.includes(name);
  });
}

export function hasSymptomInput(input: SymptomCheckerInput): boolean {
  return Boolean(input.symptoms?.length || normalizeText(input.freeText));
}

export function normalizeSymptoms(input: SymptomCheckerInput): SymptomKey[] {
  const selected = new Set<SymptomKey>();
  const selectedRaw = new Set((input.symptoms ?? []).map((symptom) => normalizeText(symptom)));
  const freeText = normalizeText(input.freeText);

  for (const option of SYMPTOM_OPTIONS) {
    if (selectedRaw.has(option.id) || selectedRaw.has(normalizeText(option.label))) {
      selected.add(option.id);
      continue;
    }

    if (
      freeText &&
      (includesPhrase(freeText, option.label) ||
        option.aliases.some((alias) => includesPhrase(freeText, alias)))
    ) {
      selected.add(option.id);
    }
  }

  return [...selected];
}

function getBreedRisks(breed?: BreedInfo): string[] {
  if (!breed) return [];
  return breed.commonHealthConditions.map((condition) => `${breed.name}: ${condition}`);
}

function findEmergencyRedFlags(
  symptoms: Set<SymptomKey>,
  freeText: string,
  species?: string,
): string[] {
  const redFlags: string[] = [];

  if (symptoms.has('difficulty_breathing')) {
    redFlags.push('Difficulty breathing needs emergency veterinary attention.');
  }
  if (symptoms.has('seizure')) {
    redFlags.push('Seizure activity should be treated as urgent or emergency care.');
  }
  if (symptoms.has('toxin_exposure')) {
    redFlags.push('Possible toxin exposure needs immediate poison-control or veterinary guidance.');
  }
  if (symptoms.has('swelling_or_bloat')) {
    redFlags.push('A swollen or hard abdomen can indicate bloat or another emergency.');
  }
  if (/blood\s+in\s+(vomit|stool|urine)|bloody\s+(vomit|stool|urine)/i.test(freeText)) {
    redFlags.push('Blood in vomit, stool, or urine warrants prompt veterinary care.');
  }
  if (/collapse|unconscious|pale gums|blue gums|severe trauma/i.test(freeText)) {
    redFlags.push('Collapse, abnormal gum color, or severe trauma is an emergency.');
  }
  if (
    /cannot (pee|urinate)|can't (pee|urinate)|unable to (pee|urinate)|not passing urine/i.test(
      freeText,
    )
  ) {
    redFlags.push('Inability to urinate is an emergency, especially for cats.');
  }
  if (
    normalizeText(species) === 'cat' &&
    symptoms.has('urination_changes') &&
    /straining|blocked|little urine|no urine/i.test(freeText)
  ) {
    redFlags.push('Cats with straining or little urine may have a urinary blockage.');
  }

  return [...new Set(redFlags)];
}

function getBreedMatchRationale(rule: ConditionRule, breed?: BreedInfo): string | undefined {
  if (!breed) return undefined;

  const matchingRisks = breed.commonHealthConditions.filter((risk) => {
    const normalizedRisk = normalizeText(risk);
    return rule.breedKeywords.some((keyword) => normalizedRisk.includes(keyword));
  });

  if (matchingRisks.length === 0) return undefined;
  return `${breed.name} has known risk factors that overlap: ${matchingRisks.join(', ')}.`;
}

function likelihoodFromScore(score: number): Likelihood {
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function analyzeCondition(
  rule: ConditionRule,
  symptoms: Set<SymptomKey>,
  freeText: string,
  breed?: BreedInfo,
): SymptomCondition | undefined {
  let score = 0;
  const rationale = new Set<string>();
  const matchedSymptoms = rule.symptoms.filter((symptom) => symptoms.has(symptom));

  if (matchedSymptoms.length > 0) {
    score += matchedSymptoms.length * 2;
    rationale.add(rule.rationale);
  }

  const matchedText = rule.textKeywords.filter((keyword) => includesPhrase(freeText, keyword));
  if (matchedText.length > 0) {
    score += matchedText.length;
    rationale.add(`The description mentions ${matchedText.slice(0, 3).join(', ')}.`);
  }

  if (score === 0) return undefined;

  const breedRationale = getBreedMatchRationale(rule, breed);
  if (breedRationale) {
    score += 1;
    rationale.add(breedRationale);
  }

  return {
    id: rule.id,
    name: rule.name,
    likelihood: likelihoodFromScore(score),
    urgency: rule.urgency,
    rationale: [...rationale],
    nextSteps: rule.nextSteps,
  };
}

function getTopUrgency(conditions: SymptomCondition[], redFlags: string[]): UrgencyLevel {
  if (redFlags.length > 0) return 'emergency';

  return conditions.reduce<UrgencyLevel>(
    (current, condition) =>
      urgencyRank[condition.urgency] > urgencyRank[current] ? condition.urgency : current,
    'monitor',
  );
}

function getUrgencyLabel(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'emergency':
      return 'Emergency care now';
    case 'urgent':
      return 'Contact a vet today';
    case 'soon':
      return 'Schedule veterinary care soon';
    default:
      return 'Monitor closely';
  }
}

function getGeneralNextSteps(urgency: UrgencyLevel): string[] {
  if (urgency === 'emergency') {
    return [
      'Contact an emergency veterinarian or pet poison hotline now.',
      'Bring medication packaging, food labels, or photos of symptoms if relevant.',
    ];
  }
  if (urgency === 'urgent') {
    return [
      'Call your veterinarian today and describe the symptoms and timing.',
      'Escalate to emergency care if breathing, collapse, severe pain, or urination stops.',
    ];
  }
  if (urgency === 'soon') {
    return [
      'Book a non-emergency veterinary appointment and keep notes on symptom frequency.',
      'Seek urgent care if symptoms worsen, repeat, or are paired with severe lethargy.',
    ];
  }
  return [
    'Monitor appetite, water intake, energy, bathroom habits, and symptom timing.',
    'Contact your vet if symptoms persist, worsen, or new red flags appear.',
  ];
}

function getMissingContext(input: SymptomCheckerInput): string[] {
  const missing: string[] = [];
  if (!normalizeText(input.species)) missing.push('species');
  if (!normalizeText(input.breed)) missing.push('breed');
  if (input.ageYears === undefined || Number.isNaN(Number(input.ageYears))) missing.push('age');
  return missing;
}

export function analyzeSymptoms(input: SymptomCheckerInput): SymptomCheckResult {
  const freeText = normalizeText(input.freeText);
  const normalized = normalizeSymptoms(input);
  const symptomSet = new Set(normalized);
  const breed = findBreed(input.breed);
  const conditions = conditionRules
    .map((rule) => analyzeCondition(rule, symptomSet, freeText, breed))
    .filter((condition): condition is SymptomCondition => Boolean(condition))
    .sort((left, right) => {
      const urgencyDiff = urgencyRank[right.urgency] - urgencyRank[left.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return likelihoodRank[right.likelihood] - likelihoodRank[left.likelihood];
    })
    .slice(0, 4);

  const redFlags = findEmergencyRedFlags(symptomSet, freeText, input.species);
  const urgency = getTopUrgency(conditions, redFlags);

  return {
    disclaimer: VETERINARY_DISCLAIMER,
    urgency,
    urgencyLabel: getUrgencyLabel(urgency),
    normalizedSymptoms: normalized.map((id) => ({
      id,
      label: SYMPTOM_OPTIONS.find((option) => option.id === id)?.label ?? id,
    })),
    redFlags,
    conditions,
    breedRisks: getBreedRisks(breed),
    nextSteps: getGeneralNextSteps(urgency),
    missingContext: getMissingContext(input),
  };
}
