import { Cormorant, Montserrat, Syne } from 'next/font/google';
import React from 'react';

import { siteConfig } from '@/app/siteConfig';
import { SiteFooter } from '@/components/mirrae/site-footer';
import { SiteNav } from '@/components/mirrae/site-nav';
import { SignInModalProvider } from '@/providers/SignInModalProvider';
import type { Metadata } from 'next';
import '../globals.css';

const cormorant = Cormorant({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});

// Heavy, wide display face for oversized headlines; Cormorant italic stays as the editorial accent
const syne = Syne({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-syne',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: {
    default: 'Mirrae | Virtual try-on for online fashion stores',
    template: '%s | Mirrae',
  },
  description: siteConfig.description,
  keywords: [
    'virtual try-on',
    'AI try-on',
    'fashion e-commerce',
    'Shopify try-on',
    'online clothing store',
  ],
  openGraph: {
    title: 'Mirrae | Virtual try-on for online fashion stores',
    description: siteConfig.description,
    type: 'website',
    url: siteConfig.url,
    siteName: siteConfig.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mirrae | Virtual try-on for online fashion stores',
    description: siteConfig.description,
  },
};

export default function BrandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SignInModalProvider>
      <div
        className={`${cormorant.variable} ${montserrat.variable} ${syne.variable} relative min-h-screen overflow-x-hidden bg-mirrae-ink font-body`}
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
