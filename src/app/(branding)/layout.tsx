import { Cormorant_Garamond, Jost } from 'next/font/google';
import React from 'react';

import { siteConfig } from '@/app/siteConfig';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteNav } from '@/components/marketing/site-nav';
import { SignInModalProvider } from '@/providers/SignInModalProvider';
import type { Metadata } from 'next';
import '../globals.css';

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant-garamond',
});

const jost = Jost({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-jost',
});

const TITLE = 'Mirrae | Virtual try-on for online fashion stores';

export const metadata: Metadata = {
  title: { default: TITLE, template: '%s | Mirrae' },
  description: siteConfig.description,
  keywords: [
    'virtual try-on',
    'AI try-on',
    'fashion e-commerce',
    'Shopify try-on',
    'online clothing store',
  ],
  openGraph: {
    title: TITLE,
    description: siteConfig.description,
    type: 'website',
    url: siteConfig.url,
    siteName: siteConfig.name,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: siteConfig.description },
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SignInModalProvider>
      <div
        className={`${cormorantGaramond.variable} ${jost.variable} relative min-h-screen overflow-x-hidden bg-site-paper font-lux text-site-ink`}
      >
        <SiteNav />
        <main id="main-content" className="relative pt-16">
          {children}
        </main>
        <SiteFooter />
      </div>
    </SignInModalProvider>
  );
}
