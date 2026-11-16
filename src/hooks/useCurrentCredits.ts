import { useAuthStore } from '@/store/auth';
import { useCreditStore } from '@/store/credits';

/** The merchant's credit balance: the live store once it is loaded, else what the sign-in returned. */
export function useCurrentCredits(): number | undefined {
  const authCredits = useAuthStore(state => state.user?.credits);
  const { credits, initialized } = useCreditStore();
  return initialized ? credits : authCredits;
}
