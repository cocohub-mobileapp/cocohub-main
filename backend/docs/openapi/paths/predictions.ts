/**
 * OpenAPI path definitions for /predictions endpoints.
 */

export const predictionPaths = {
  '/predictions/symptoms': {
    post: {
      tags: ['Predictions'],
      summary: 'Analyze pet symptoms with AI triage engine',
      description:
        'Analyzes natural language pet symptoms and generates a veterinary triage assessment with ranked probable conditions, confidence scores, urgency level, and clinical recommendations. Free tier is rate limited to 10 requests per user per day.',
      operationId: 'predictSymptoms',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SymptomPredictionRequest' },
            example: {
              petId: 'p-demo-1',
              species: 'dog',
              breed: 'Golden Retriever',
              symptoms: 'Continuous dry coughing, gagging, and lethargy for 2 days after visiting dog park',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Symptom analysis generated successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    properties: {
                      data: { $ref: '#/components/schemas/SymptomPrediction' },
                    },
                  },
                ],
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
        '429': { $ref: '#/components/responses/TooManyRequests' },
        '500': { $ref: '#/components/responses/InternalServerError' },
      },
    },
  },
} as const;
