// Mock environment variables for testing
// Never fall back to a real database: another project's DB (kostra) lives on the same server and
// DB tests call deleteMany. With no TEST_POSTGRES_URL, point at an unreachable address so any
// accidental DB access fails fast instead of touching real data. Mocked tests never connect.
process.env.POSTGRES_URL =
  process.env.TEST_POSTGRES_URL ||
  'postgresql://unset:unset@127.0.0.1:1/mirrae_test_url_not_set?schema=public';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_KEY = 'auth-token';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/test',
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console.error during tests unless explicitly needed
  error: jest.fn(),
  warn: jest.fn(),
};
