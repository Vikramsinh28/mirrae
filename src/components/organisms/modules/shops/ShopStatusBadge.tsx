import { Badge } from '@/components/ui/badge';
import type { ShopStatus } from '@/services/api/shops';

const STATUS_LABELS: Record<ShopStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  ACTIVE: { label: 'Live', variant: 'success' },
  PAUSED: { label: 'Paused', variant: 'warning' },
  SUSPENDED: { label: 'Suspended', variant: 'error' },
  UNINSTALLED: { label: 'Removed', variant: 'default' },
};

export function ShopStatusBadge({ status }: { status: ShopStatus }) {
  const { label, variant } = STATUS_LABELS[status];
  return <Badge variant={variant}>{label}</Badge>;
}
