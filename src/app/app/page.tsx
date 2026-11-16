'use client';

import { Suspense } from 'react';

import { OverviewPage } from '@/components/organisms/modules/shops/OverviewPage';

export default function AppPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <OverviewPage />
    </Suspense>
  );
}
