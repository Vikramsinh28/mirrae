import { CREDIT_OPERATIONS, CREDIT_TRANSACTION_TYPES } from '@/lib/constants/credits';
import { prisma } from '@/lib/prisma';

export interface CreditTransactionInput {
  userId: number;
  amount: number;
  operation: keyof typeof CREDIT_OPERATIONS;
  objectId?: string;
  description?: string;
}

const isValidAmount = (amount: number) => Number.isFinite(amount) && amount > 0;

const PRISMA_RECORD_NOT_FOUND = 'P2025';

export class CreditService {
  /**
   * Deduct credits from user account and record transaction.
   * The balance check and the decrement are ONE conditional UPDATE, so concurrent deductions can never
   * both read the same balance (a read-then-write here lost credits under load).
   */
  static async deductCredits({
    userId,
    amount,
    operation,
    objectId,
    description,
  }: CreditTransactionInput): Promise<{ success: boolean; newBalance: number; error?: string }> {
    if (!isValidAmount(amount)) return { success: false, newBalance: 0, error: 'Invalid amount' };

    try {
      const result = await prisma.$transaction(async tx => {
        const { count } = await tx.user.updateMany({
          where: { id: userId, credits: { gte: amount } },
          data: { credits: { decrement: amount } },
        });

        if (count === 0) {
          const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
          throw new Error(exists ? 'Insufficient credits' : 'User not found');
        }

        // The row stays locked by the UPDATE above until commit, so this is exactly our balance.
        const { credits: newBalance } = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { credits: true },
        });

        await tx.creditHistory.create({
          data: {
            userId,
            type: CREDIT_TRANSACTION_TYPES.DEBIT,
            operation: CREDIT_OPERATIONS[operation],
            amount: -amount, // Negative for debit
            balanceAfter: newBalance,
            objectId,
            description,
          },
        });

        return { newBalance };
      });

      return { success: true, newBalance: result.newBalance };
    } catch (error) {
      console.error('Error deducting credits:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add credits to user account and record transaction (one atomic increment).
   */
  static async addCredits({
    userId,
    amount,
    operation,
    objectId,
    description,
  }: CreditTransactionInput): Promise<{ success: boolean; newBalance: number; error?: string }> {
    if (!isValidAmount(amount)) return { success: false, newBalance: 0, error: 'Invalid amount' };

    try {
      const result = await prisma.$transaction(async tx => {
        const { credits: newBalance } = await tx.user.update({
          where: { id: userId },
          data: { credits: { increment: amount } },
          select: { credits: true },
        });

        await tx.creditHistory.create({
          data: {
            userId,
            type: CREDIT_TRANSACTION_TYPES.CREDIT,
            operation: CREDIT_OPERATIONS[operation],
            amount, // Positive for credit
            balanceAfter: newBalance,
            objectId,
            description,
          },
        });

        return { newBalance };
      });

      return { success: true, newBalance: result.newBalance };
    } catch (error) {
      console.error('Error adding credits:', error);
      const notFound = (error as { code?: string } | null)?.code === PRISMA_RECORD_NOT_FOUND;
      return {
        success: false,
        newBalance: 0,
        error: notFound ? 'User not found' : error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get user's current credit balance
   */
  static async getUserCredits(userId: number): Promise<number> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      return user?.credits || 0;
    } catch (error) {
      console.error('Error getting user credits:', error);
      return 0;
    }
  }

  /**
   * Get user's credit history
   */
  static async getCreditHistory(userId: number, limit = 50) {
    try {
      return await prisma.creditHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      console.error('Error getting credit history:', error);
      return [];
    }
  }

  /**
   * Check if user has sufficient credits for an operation
   */
  static async hassufficientCredits(userId: number, amount: number): Promise<boolean> {
    try {
      const credits = await this.getUserCredits(userId);
      return credits >= amount;
    } catch (error) {
      console.error('Error checking credit sufficiency:', error);
      return false;
    }
  }
}
