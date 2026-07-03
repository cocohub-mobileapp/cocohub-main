import { breedDatabase, type BreedInfo } from '../src/data/breeds';

export type SymptomUrgency = 'low' | 'moderate' | 'high' | 'emergency';

export interface SymptomCheckerInput {
  petId?: string;
  species?: string;
  breed?: string;
  symptoms?: string;
  selectedSymptoms?: string[];
}

export interface SymptomCondition {
  condition: string;
  confidence: number;
  description: string;
}

export interface SymptomAnalysis {
  probableConditions: SymptomCondition[];
  urgency: SymptomUrgency;
  urgencyReason: string;
  recommendedActions: string[];
  disclaimer: string;
}

interface Rule {
  condition: string;
  description: string;
  keywords: string[];
  confidence: number;
  urgency: SymptomUrgency;
}

export const symptomOptions = [
  'Vomiting',
  'Diarrhea',
  'Not eating',
  'Lethargy',
  'Coughing',
  'Fast breathing',
  'Limping',
  'Scratching',
  'Ear shaking',
  'Frequent urination',
  'Straining to urinate',
  'Skin redness',
  'Eye discharge',
  'Weight change',
  'Pain',
  'Collapse or fainting',
];

const emergencyKeywords = [
  'breathing trouble',
  'cannot breathe',
  'difficulty breathing',
  'fast breathing',
  'labored breathing',
  'blue gums',
  'pale gums',
  'collapse',
  'collapsed',
  'unconscious',
  'seizure',
  'bloated abdomen',
  'bloat',
  'poison',
  'toxin',
  'bleeding heavily',
  'severe bleeding',
  'trauma',
  'hit by car',
  'cannot urinate',
  'straining to urinate',
  'repeated vomiting',
  'severe pain',
];

const rules: Rule[] = [
  {
    condition: 'Gastrointestinal upset',
    description:
      'Vomiting, diarrhea, appetite loss, or diet changes can point to digestive irritation.',
    keywords: [
      'vomit',
      'throwing up',
      'diarrhea',
      'loose stool',
      'not eating',
      'appetite',
      'nausea',
    ],
    confidence: 0.74,
    urgency: 'moderate',
  },
  {
    condition: 'Respiratory distress or airway irritation',
    description: 'Coughing, panting, or fast breathing can require prompt veterinary assessment.',
    keywords: [
      'cough',
      'wheez',
      'panting',
      'fast breathing',
      'labored breathing',
      'breathing trouble',
    ],
    confidence: 0.82,
    urgency: 'high',
  },
  {
    condition: 'Ear or skin irritation',
    description:
      'Scratching, head shaking, redness, or odor often fits allergy, infection, or parasite patterns.',
    keywords: ['scratch', 'itch', 'ear', 'head shaking', 'red skin', 'rash', 'hot spot', 'odor'],
    confidence: 0.72,
    urgency: 'low',
  },
  {
    condition: 'Orthopedic pain or soft tissue injury',
    description:
      'Limping, stiffness, or pain after activity can involve joints, paws, muscles, or ligaments.',
    keywords: ['limp', 'lameness', 'stiff', 'sore', 'leg pain', 'joint', 'paw', 'injury'],
    confidence: 0.76,
    urgency: 'moderate',
  },
  {
    condition: 'Urinary tract concern',
    description:
      'Frequent urination, accidents, blood, or straining can signal urinary inflammation or blockage.',
    keywords: [
      'urinate',
      'urination',
      'pee',
      'straining',
      'blood in urine',
      'accident',
      'litter box',
    ],
    confidence: 0.79,
    urgency: 'high',
  },
  {
    condition: 'Systemic illness or reduced wellbeing',
    description:
      'Lethargy, appetite change, fever, or behavior shifts can reflect a broad health issue.',
    keywords: [
      'lethargy',
      'lethargic',
      'weak',
      'fever',
      'tired',
      'hiding',
      'behavior change',
      'weight',
    ],
    confidence: 0.68,
    urgency: 'moderate',
  },
  {
    condition: 'Eye irritation or infection',
    description:
      'Discharge, redness, squinting, or rubbing the eyes may need medication or injury evaluation.',
    keywords: ['eye', 'discharge', 'squint', 'red eye', 'cloudy', 'rubbing eye'],
    confidence: 0.71,
    urgency: 'moderate',
  },
];

function normalizeText(input: SymptomCheckerInput): string {
  return [input.symptoms ?? '', ...(input.selectedSymptoms ?? [])].join(' ').toLowerCase();
}

function findBreed(breedName?: string): BreedInfo | undefined {
  const normalized = String(breedName ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return undefined;
  return breedDatabase.find((breed) => breed.name.toLowerCase() === normalized);
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function maxUrgency(a: SymptomUrgency, b: SymptomUrgency): SymptomUrgency {
  const rank: Record<SymptomUrgency, number> = { low: 1, moderate: 2, high: 3, emergency: 4 };
  return rank[a] >= rank[b] ? a : b;
}

function addBreedContext(matches: SymptomCondition[], breed?: BreedInfo): SymptomCondition[] {
  if (!breed) return matches;

  const breedMatches = breed.commonHealthConditions.slice(0, 3).map((condition, index) => ({
    condition: `${breed.name} risk: ${condition}`,
    confidence: Math.max(0.48, 0.62 - index * 0.06),
    description: `${breed.name}s can be predisposed to ${condition}; compare this with current symptoms and vet history.`,
  }));

  return [...matches, ...breedMatches];
}

function buildActions(urgency: SymptomUrgency): string[] {
  if (urgency === 'emergency') {
    return [
      'Contact an emergency veterinarian or animal poison control now.',
      'Do not wait for symptoms to progress before seeking help.',
      'Bring medication names, recent foods, and medical records if available.',
    ];
  }

  if (urgency === 'high') {
    return [
      'Call your veterinarian today and describe the symptoms and timing.',
      'Monitor breathing, gum color, hydration, urination, and energy level closely.',
      'Seek urgent care sooner if symptoms worsen or your pet seems distressed.',
    ];
  }

  if (urgency === 'moderate') {
    return [
      'Schedule a veterinary check if symptoms persist, repeat, or worsen within 24 hours.',
      'Keep water available and avoid new foods, treats, or medicines unless a vet advises it.',
      'Track symptom timing, appetite, stool, urination, and activity for your vet.',
    ];
  }

  return [
    'Monitor at home and record any pattern or worsening symptoms.',
    'Keep routine care, hydration, and a calm environment consistent.',
    'Contact your vet if new symptoms appear or the issue does not improve.',
  ];
}

export function analyzeSymptoms(input: SymptomCheckerInput): SymptomAnalysis {
  const text = normalizeText(input);
  const breed = findBreed(input.breed);

  let urgency: SymptomUrgency = 'low';
  const matches: SymptomCondition[] = [];

  if (includesAny(text, emergencyKeywords)) {
    urgency = 'emergency';
    matches.push({
      condition: 'Emergency warning signs',
      confidence: 0.95,
      description: 'The symptom description includes red flags that can become life-threatening.',
    });
  }

  for (const rule of rules) {
    if (!includesAny(text, rule.keywords)) continue;
    urgency = maxUrgency(urgency, rule.urgency);
    matches.push({
      condition: rule.condition,
      confidence: rule.confidence,
      description: rule.description,
    });
  }

  const probableConditions = addBreedContext(matches, breed)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  if (probableConditions.length === 0) {
    probableConditions.push({
      condition: 'General health concern',
      confidence: 0.45,
      description:
        'The symptoms are nonspecific; tracking timing and severity will help a veterinarian triage.',
    });
  }

  return {
    probableConditions,
    urgency,
    urgencyReason:
      urgency === 'emergency'
        ? 'Emergency red flags were detected in the symptom description.'
        : `Current symptoms suggest ${urgency} urgency based on reported signs and breed context.`,
    recommendedActions: buildActions(urgency),
    disclaimer:
      'This is not veterinary advice and is not a diagnosis. Consult a licensed veterinarian for medical decisions.',
  };
}
