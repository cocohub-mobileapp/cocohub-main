/**
 * OpenAPI schema definitions for AI Prediction and Symptom Checker endpoints.
 */

export const predictionSchemas = {
  SymptomPredictionRequest: {
    type: 'object',
    required: ['petId', 'symptoms'],
    properties: {
      petId: {
        type: 'string',
        example: 'p-demo-1',
        description: 'ID of the pet experiencing symptoms',
      },
      species: {
        type: 'string',
        enum: ['dog', 'cat', 'bird', 'rabbit', 'other'],
        example: 'dog',
        description: 'Pet species (optional, populated from pet record if omitted)',
      },
      breed: {
        type: 'string',
        example: 'Golden Retriever',
        description: 'Pet breed (optional, populated from pet record if omitted)',
      },
      symptoms: {
        type: 'string',
        minLength: 3,
        example: 'Continuous coughing and low energy for the past 2 days',
        description: 'Detailed natural language description of observed pet symptoms',
      },
    },
  },

  ProbableCondition: {
    type: 'object',
    required: ['condition', 'confidence', 'description'],
    properties: {
      condition: {
        type: 'string',
        example: 'Infectious Tracheobronchitis (Kennel Cough)',
        description: 'Name of the likely veterinary condition',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        example: 0.85,
        description: 'Model confidence score between 0.0 and 1.0',
      },
      description: {
        type: 'string',
        example: 'Contagious upper respiratory infection causing hacking cough and mild lethargy.',
        description: 'Clinical explanation of the condition and its relation to symptoms',
      },
    },
  },

  SymptomPrediction: {
    type: 'object',
    required: [
      'probableConditions',
      'urgency',
      'urgencyReason',
      'recommendedActions',
      'disclaimer',
    ],
    properties: {
      probableConditions: {
        type: 'array',
        items: { $ref: '#/components/schemas/ProbableCondition' },
        description: 'Top probable conditions ranked by likelihood',
      },
      urgency: {
        type: 'string',
        enum: ['low', 'moderate', 'high', 'emergency'],
        example: 'moderate',
        description: 'Urgency classification for veterinary triage',
      },
      urgencyReason: {
        type: 'string',
        example: 'Symptoms suggest a moderate respiratory infection that should be evaluated if persistent.',
        description: 'Clinical explanation justifying the assigned urgency triage tier',
      },
      recommendedActions: {
        type: 'array',
        items: { type: 'string' },
        example: [
          'Schedule an examination with your veterinarian within 24 to 48 hours.',
          'Ensure continuous access to fresh water and keep resting area clean.',
        ],
        description: 'Actionable clinical next steps for pet owner',
      },
      disclaimer: {
        type: 'string',
        example: 'This is an AI-assisted triage assessment and does not constitute a formal veterinary diagnosis.',
        description: 'Standard medical triage and diagnostic disclaimer',
      },
      modelVersion: {
        type: 'string',
        example: 'cocohub-symptom-v1.0',
        description: 'Identifier of the underlying ML/LLM model version used for inference',
      },
    },
  },
} as const;
