import Link from 'next/link';

import { siteConfig } from '@/app/siteConfig';
import { MARKETING_NAV } from '@/data/marketing-content';

import { SiteMark } from './site-mark';

const LINK_CLASS =
  'inline-flex min-h-9 items-center text-sm text-site-ink-2 transition-colors duration-200 hover:text-site-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-forest';

const COMPANY_LINKS = [
  { label: 'Contact', href: '/contact' },
  { label: 'Blog', href: '/blog' },
  { label: 'Dashboard', href: siteConfig.baseLinks.home },
] as const;

const LEGAL_LINKS = [
  { label: 'Privacy policy', href: siteConfig.baseLinks.privacy },
  { label: 'Terms of service', href: siteConfig.baseLinks.terms },
] as const;

type ColumnProps = {
  title: string;
  links: readonly { label: string; href: string }[];
};

function FooterColumn({ title, links }: ColumnProps) {
  return (
    <nav aria-label={title}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-site-forest">{title}</h2>
      <ul className="mt-4">
        {links.map(link => (
          <li key={link.label}>
            <Link href={link.href} className={LINK_CLASS}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-site-rule bg-site-paper-2">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <SiteMark />
            <p className="mt-5 max-w-xs leading-relaxed text-site-muted">
              Virtual try-on for online fashion stores. See it on you before you buy it.
            </p>
          </div>
          <FooterColumn title="Product" links={MARKETING_NAV} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>
        <p className="mt-14 border-t border-site-rule pt-8 text-sm text-site-muted">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
