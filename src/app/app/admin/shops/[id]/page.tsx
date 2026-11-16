'use client';

import { use } from 'react';

import { AdminShopDetailPage } from '@/components/organisms/modules/admin/AdminShopDetailPage';

export default function AdminShopDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AdminShopDetailPage shopId={id} />;
}
