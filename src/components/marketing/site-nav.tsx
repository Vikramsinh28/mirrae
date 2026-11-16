'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { siteConfig } from '@/app/siteConfig';
import UserProfile from '@/components/branding/userProfile';
import { MARKETING_NAV } from '@/data/marketing-content';
import { useSignInModalContext } from '@/providers/SignInModalProvider';
import { useAuthStore } from '@/store/auth';

import { ctaSolid } from './cta-styles';
import { SiteMark } from './site-mark';

const LINK_CLASS =
  'cursor-pointer text-[15px] font-medium text-site-ink-2 transition-colors duration-200 hover:text-site-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-site-forest';

export function SiteNav() {
  const { user } = useAuthStore();
  const { openModal } = useSignInModalContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);
  const accountSlot = user ? (
    <UserProfile />
  ) : (
    <button type="button" onClick={openModal} className={`${ctaSolid} min-h-11 px-5`}>
      Sign in
    </button>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-site-rule bg-site-paper/90 backdrop-blur-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-site-forest focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-site-paper"
      >
        Skip to content
      </a>

      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6" aria-label="Main">
        <Link href="/" aria-label="Mirrae home" onClick={closeMenu} className="text-site-ink">
          <SiteMark />
        </Link>

        <ul className="hidden items-center gap-9 md:flex">
          {MARKETING_NAV.map(item => (
            <li key={item.label}>
              <Link href={item.href} className={LINK_CLASS}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <Link href={siteConfig.baseLinks.home} className={LINK_CLASS}>
            Dashboard
          </Link>
          {accountSlot}
        </div>

        <button
          type="button"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-site-rule text-site-ink md:hidden"
          onClick={() => setIsMenuOpen(open => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </nav>

      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-site-rule px-6 pb-6 pt-2 md:hidden">
          <ul>
            {MARKETING_NAV.map(item => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={closeMenu}
                  className="flex min-h-12 items-center text-base font-medium text-site-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4">{accountSlot}</div>
        </div>
      )}
    </header>
  );
}
