'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SignInButton } from '@/components/atom/SignInButton';
import UserProfile from '@/components/branding/userProfile';
import { NAV_ITEMS, SECTION_IDS } from '@/data/mirrae-content';
import { useSignInModalContext } from '@/providers/SignInModalProvider';
import { useAuthStore } from '@/store/auth';

import { MirraeMark } from './mirrae-mark';

const SCROLLED_THRESHOLD_PX = 24;

const linkClass = (isActive: boolean) =>
  `cursor-pointer text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mirrae-gold-soft ${
    isActive ? 'text-mirrae-gold-soft' : 'text-white/80 hover:text-white'
  }`;

export function SiteNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { openModal } = useSignInModalContext();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  const isHome = pathname === '/';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > SCROLLED_THRESHOLD_PX);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Highlight the section nearest the top of the viewport (home page only)
  useEffect(() => {
    if (!isHome) return;

    const sections = SECTION_IDS.map(id => document.getElementById(id)).filter(
      (element): element is HTMLElement => element !== null
    );
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(entry => entry.isIntersecting);
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-35% 0px -60% 0px' }
    );
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [isHome]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        isScrolled || isMenuOpen
          ? 'border-white/10 bg-mirrae-ink/85 backdrop-blur-md'
          : 'border-transparent bg-transparent'
      }`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-mirrae-gold-soft focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-mirrae-ink"
      >
        Skip to content
      </a>

      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6"
        aria-label="Main"
      >
        <Link
          href="/"
          className="cursor-pointer text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mirrae-gold-soft"
          aria-label="Mirrae home"
          onClick={closeMenu}
        >
          <MirraeMark />
        </Link>

        <ul className="hidden items-center gap-9 md:flex">
          {NAV_ITEMS.map(item => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={linkClass(isHome && item.sectionId !== '' && activeSection === item.sectionId)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center md:flex">
          {user ? <UserProfile /> : <SignInButton onClick={openModal} variant="light" />}
        </div>

        <button
          type="button"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-mirrae-gold-soft md:hidden"
          onClick={() => setIsMenuOpen(open => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </nav>

      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-white/10 px-6 pb-6 pt-2 md:hidden">
          <ul>
            {NAV_ITEMS.map(item => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={closeMenu}
                  className="flex min-h-12 items-center text-base font-medium text-white/90 hover:text-mirrae-gold-soft"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            {user ? (
              <UserProfile />
            ) : (
              <SignInButton onClick={openModal} variant="light" className="w-full" />
            )}
          </div>
        </div>
      )}
    </header>
  );
}
