'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { useSignInModalContext } from '@/providers/SignInModalProvider';
import { useAuthStore } from '@/store/auth';

type Props = {
  /** Where signed-in users go. Signed-out users get the sign-in modal instead. */
  href: string;
  className: string;
  children: ReactNode;
};

/** Call to action that opens the sign-in modal for visitors and deep-links for signed-in users. */
export function AuthCta({ href, className, children }: Props) {
  const { user } = useAuthStore();
  const { openModal } = useSignInModalContext();

  if (user) {
    return (
      <Link href={href} className={className}>
        {children}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <button type="button" onClick={openModal} className={className}>
      {children}
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}
