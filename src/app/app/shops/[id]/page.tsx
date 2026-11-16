'use client';

import { useParams } from 'next/navigation';

import { ShopDetailPage } from '@/components/organisms/modules/shops/ShopDetailPage';

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  return <ShopDetailPage shopId={id} />;
}
