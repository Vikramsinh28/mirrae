'use client';

import Link from 'next/link';

import { siteConfig } from '@/app/siteConfig';
import { useSignInModalContext } from '@/providers/SignInModalProvider';
import { useAuthStore } from '@/store/auth';

import { MirraeMark } from './mirrae-mark';

const LINK_CLASS =
  'inline-flex min-h-9 cursor-pointer items-center text-sm text-white/70 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mirrae-gold-soft';

const PRODUCT_LINKS = [
  { label: 'How it works', href: '/#how' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
] as const;

const LEGAL_LINKS = [
  { label: 'Privacy policy', href: siteConfig.baseLinks.privacy },
  { label: 'Terms of service', href: siteConfig.baseLinks.terms },
] as const;

export function SiteFooter() {
  const { user } = useAuthStore();
  const { openModal } = useSignInModalContext();

  return (
    <footer className="border-t border-white/10 bg-mirrae-ink text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <MirraeMark />
            <p className="mt-5 max-w-xs leading-relaxed text-white/65">
              Virtual try-on for online fashion stores. See it on you before you buy it.
            </p>
          </div>

          <nav aria-label="Product">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-mirrae-gold-soft">
              Product
            </h2>
            <ul className="mt-4">
              {PRODUCT_LINKS.map(link => (
                <li key={link.label}>
                  <Link href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-mirrae-gold-soft">
              Company
            </h2>
            <ul className="mt-4">
              <li>
                <Link href="/contact" className={LINK_CLASS}>
                  Contact
                </Link>
              </li>
              <li>
                {user ? (
                  <Link href={siteConfig.baseLinks.home} className={LINK_CLASS}>
                    Dashboard
                  </Link>
                ) : (
                  <button type="button" onClick={openModal} className={LINK_CLASS}>
                    Sign in
                  </button>
                )}
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-mirrae-gold-soft">
              Legal
            </h2>
            <ul className="mt-4">
              {LEGAL_LINKS.map(link => (
                <li key={link.label}>
                  <Link href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-14 border-t border-white/10 pt-8 text-sm text-white/55">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
