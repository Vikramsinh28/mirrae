import { DEFAULT_INITIAL_CREDITS } from '@/lib/constants/credits';
import { prisma } from '@/lib/prisma';
import { createUser } from './index';

jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findFirst: jest.fn(), create: jest.fn() } },
}));

const userDelegate = prisma.user as unknown as { findFirst: jest.Mock; create: jest.Mock };

describe('createUser starting credits', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    userDelegate.findFirst.mockResolvedValue(null);
    userDelegate.create.mockImplementation(async ({ data }: { data: object }) => data);
  });

  test('gives a new user exactly the configured number of free credits', async () => {
    await createUser({ email: 'a@example.com', name: 'A' });

    expect(userDelegate.create.mock.calls[0][0].data.credits).toBe(DEFAULT_INITIAL_CREDITS);
  });

  test('the free allowance is a small trial amount, not a large balance (each try-on costs real money)', () => {
    expect(DEFAULT_INITIAL_CREDITS).toBeGreaterThan(0);
    expect(DEFAULT_INITIAL_CREDITS).toBeLessThanOrEqual(10);
  });

  test('refuses to create a user whose email already exists', async () => {
    userDelegate.findFirst.mockResolvedValue({ id: 1 });

    await expect(createUser({ email: 'a@example.com', name: 'A' })).rejects.toThrow('Email already exists');
    expect(userDelegate.create).not.toHaveBeenCalled();
  });
});
