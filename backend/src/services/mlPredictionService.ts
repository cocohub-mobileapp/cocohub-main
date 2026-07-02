import { OpenAI } from "openai";

interface PredictionRequest {
  petId: string;
  species: string;
  breed: string;
  symptoms: string[];
}

interface PredictionResponse {
  urgency: "low" | "moderate" | "high" | "emergency";
  probableConditions: string[];
  recommendedActions: string[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function predictPetSymptoms(data: PredictionRequest): Promise<PredictionResponse> {
  try {
    const prompt = `Analyze pet symptoms. Species: ${data.species}, Breed: ${data.breed}, Symptoms: ${data.symptoms.join(", ")}. Respond ONLY with a valid JSON object matching this schema: { "urgency": "low" | "moderate" | "high" | "emergency", "probableConditions": ["string"], "recommendedActions": ["string"] }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const resultText = response.choices[0].message.content || "{}";
    return JSON.parse(resultText) as PredictionResponse;
  } catch (error) {
    return {
      urgency: "moderate",
      probableConditions: ["Unknown Condition due to error"],
      recommendedActions: ["Please consult a veterinarian online or nearby."],
    };
  }
}
