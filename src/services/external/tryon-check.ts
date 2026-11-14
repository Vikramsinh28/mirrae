import { z } from 'zod';

import { vertexModelUrl, vertexPost } from './vertex-client';

/**
 * Cheap pre-flight check that both photos are usable, run BEFORE the paid try-on call.
 * Without it Vertex happily "tries on" a photo that contains no person and the shopper is charged for garbage.
 *
 * Uses a small Gemini vision model with structured JSON output (~5s). Verified by experiment on 2026-11-14:
 * `gemini-3-flash-preview` is the only text/vision Gemini this project can call (2.x models returned 404).
 * It is a preview model, so the id is configurable via VERTEX_CHECK_MODEL.
 *
 * Fails OPEN: if the checker is down or answers oddly, the try-on proceeds (an outage must not block merchants).
 */

const CHECK_MODEL_ID = process.env.VERTEX_CHECK_MODEL || 'gemini-3-flash-preview';
const CHECK_LOCATION = 'global';
const CHECK_TIMEOUT_MS = 20_000;

export type PhotoProblem = 'NO_PERSON' | 'MULTIPLE_PEOPLE' | 'PERSON_TOO_SMALL' | 'NOT_CLOTHING';

export interface PhotoCheckInput {
  personBase64: string;
  personContentType: string;
  garmentBase64: string;
  garmentContentType: string;
}

const personSchema = z.object({
  personCount: z.number(),
  torsoVisible: z.boolean(),
  isPhotoOfRealPerson: z.boolean(),
});
const garmentSchema = z.object({ showsClothingItem: z.boolean() });

const PERSON_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    personCount: { type: 'INTEGER', description: 'Number of real people clearly visible in the foreground' },
    torsoVisible: {
      type: 'BOOLEAN',
      description: "The main person's shoulders and torso are visible (not only a face or a tiny distant figure)",
    },
    isPhotoOfRealPerson: {
      type: 'BOOLEAN',
      description: 'A photograph of a real person, not a drawing, a product-only image or a mannequin',
    },
  },
  required: ['personCount', 'torsoVisible', 'isPhotoOfRealPerson'],
};
const GARMENT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    showsClothingItem: {
      type: 'BOOLEAN',
      description: 'The main subject is a clothing item or outfit (worn by a model, on a mannequin, or laid flat)',
    },
  },
  required: ['showsClothingItem'],
};

const generateResponseSchema = z.object({
  candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }) })).min(1),
});

async function askJson<T>(
  prompt: string,
  image: { base64: string; contentType: string },
  responseSchema: object,
  parser: z.ZodType<T>
): Promise<T> {
  const body = await vertexPost(
    vertexModelUrl(CHECK_MODEL_ID, 'generateContent', CHECK_LOCATION),
    {
      contents: [
        { role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: image.contentType, data: image.base64 } }] },
      ],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema },
    },
    CHECK_TIMEOUT_MS
  );

  const text = generateResponseSchema.parse(body).candidates[0].content.parts.find(part => part.text)?.text;
  return parser.parse(JSON.parse(text ?? 'null'));
}

function personProblemOf(person: z.infer<typeof personSchema>): PhotoProblem | null {
  if (person.personCount === 0 || !person.isPhotoOfRealPerson) return 'NO_PERSON';
  if (person.personCount > 1) return 'MULTIPLE_PEOPLE';
  if (!person.torsoVisible) return 'PERSON_TOO_SMALL';
  return null;
}

const askAboutPerson = (image: { base64: string; contentType: string }) =>
  askJson(
    'You are validating a photo for a virtual clothing try-on. Describe only what is visible about the people in it.',
    image,
    PERSON_RESPONSE_SCHEMA,
    personSchema
  );

/** Checks only the shopper photo (used right after upload, so the shopper hears about a bad photo at once). */
export async function findPersonProblem(image: { base64: string; contentType: string }): Promise<PhotoProblem | null> {
  try {
    return personProblemOf(await askAboutPerson(image));
  } catch (error) {
    console.warn('Photo pre-check unavailable, continuing without it', error instanceof Error ? error.message : error);
    return null;
  }
}

/** The first problem found (person photo first), or null when both photos look usable. */
export async function findPhotoProblem(input: PhotoCheckInput): Promise<PhotoProblem | null> {
  try {
    const [person, garment] = await Promise.all([
      askAboutPerson({ base64: input.personBase64, contentType: input.personContentType }),
      askJson(
        'You are validating a product photo for a virtual clothing try-on. Describe only what the main subject is.',
        { base64: input.garmentBase64, contentType: input.garmentContentType },
        GARMENT_RESPONSE_SCHEMA,
        garmentSchema
      ),
    ]);

    return personProblemOf(person) ?? (garment.showsClothingItem ? null : 'NOT_CLOTHING');
  } catch (error) {
    console.warn('Photo pre-check unavailable, continuing without it', error instanceof Error ? error.message : error);
    return null;
  }
}
