import { findPhotoProblem } from './tryon-check';

const getAccessToken = jest.fn();
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({ getAccessToken })),
}));

const input = {
  personBase64: 'UEVSU09O',
  personContentType: 'image/jpeg',
  garmentBase64: 'R0FSTUVOVA==',
  garmentContentType: 'image/jpeg',
};

const reply = (payload: unknown) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );

const goodPerson = { personCount: 1, torsoVisible: true, isPhotoOfRealPerson: true };
const goodGarment = { showsClothingItem: true };

/** The person check and the garment check are two separate calls, told apart by the response schema they ask for. */
function mockChecks(fetchSpy: jest.SpyInstance, person: unknown, garment: unknown) {
  fetchSpy.mockImplementation(async (_url: string, init: { body: string }) => {
    const { responseSchema } = JSON.parse(init.body).generationConfig;
    return 'personCount' in responseSchema.properties ? reply(person) : reply(garment);
  });
}

describe('findPhotoProblem', () => {
  const originalProject = process.env.GOOGLE_CLOUD_PROJECT;
  let fetchSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    getAccessToken.mockResolvedValue('test-token');
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    getAccessToken.mockReset();
    if (originalProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
    else process.env.GOOGLE_CLOUD_PROJECT = originalProject;
  });

  test('returns null when both photos are fine', async () => {
    mockChecks(fetchSpy, goodPerson, goodGarment);
    await expect(findPhotoProblem(input)).resolves.toBeNull();
  });

  test('runs both checks against the global Vertex endpoint with structured JSON output', async () => {
    mockChecks(fetchSpy, goodPerson, goodGarment);

    await findPhotoProblem(input);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/');
    expect(url).toContain(':generateContent');
    const body = JSON.parse(init.body);
    expect(body.generationConfig).toMatchObject({ temperature: 0, responseMimeType: 'application/json' });
    expect(body.generationConfig.responseSchema).toBeDefined();
  });

  test.each([
    ['no person is visible', { personCount: 0, torsoVisible: false, isPhotoOfRealPerson: false }, 'NO_PERSON'],
    ['it is not a photo of a real person', { personCount: 1, torsoVisible: true, isPhotoOfRealPerson: false }, 'NO_PERSON'],
    ['several people are in it', { personCount: 3, torsoVisible: true, isPhotoOfRealPerson: true }, 'MULTIPLE_PEOPLE'],
    ['the torso is not visible', { personCount: 1, torsoVisible: false, isPhotoOfRealPerson: true }, 'PERSON_TOO_SMALL'],
  ])('flags the person photo when %s', async (_name, person, expected) => {
    mockChecks(fetchSpy, person, goodGarment);
    await expect(findPhotoProblem(input)).resolves.toBe(expected);
  });

  test('flags a product photo that is not clothing', async () => {
    mockChecks(fetchSpy, goodPerson, { showsClothingItem: false });
    await expect(findPhotoProblem(input)).resolves.toBe('NOT_CLOTHING');
  });

  test('reports the person problem first when both photos are bad', async () => {
    mockChecks(fetchSpy, { personCount: 0, torsoVisible: false, isPhotoOfRealPerson: false }, { showsClothingItem: false });
    await expect(findPhotoProblem(input)).resolves.toBe('NO_PERSON');
  });

  test('fails open (null) and warns when the checker is down, so an outage never blocks try-ons', async () => {
    fetchSpy.mockResolvedValue(new Response('boom', { status: 503 }));

    await expect(findPhotoProblem(input)).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  test('fails open when the checker answers with something that is not the expected JSON', async () => {
    fetchSpy.mockImplementation(async () => reply({ unexpected: true }));
    await expect(findPhotoProblem(input)).resolves.toBeNull();
  });

  test('fails open when the access token cannot be obtained', async () => {
    getAccessToken.mockRejectedValue(new Error('no credentials'));
    await expect(findPhotoProblem(input)).resolves.toBeNull();
  });
});
