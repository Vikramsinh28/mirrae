import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminAuditEntry } from '@/services/api/admin';

function describe(entry: AdminAuditEntry): string {
  const { details } = entry;
  switch (entry.action) {
    case 'SHOP_SUSPENDED':
      return 'Suspended the shop';
    case 'SHOP_UNSUSPENDED':
      return 'Let the shop back in';
    case 'CREDITS_GRANTED':
      return `Added ${details.amount} credits${details.reason ? `: ${details.reason}` : ''}`;
    case 'CREDITS_REMOVED':
      return `Removed ${Math.abs(details.amount ?? 0)} credits${details.reason ? `: ${details.reason}` : ''}`;
  }
}

/** What admins have done to this shop, newest first. */
export function AdminAuditCard({ audit }: { audit: AdminAuditEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin history</CardTitle>
        <CardDescription>Every change an admin made to this shop or its credits.</CardDescription>
      </CardHeader>
      <CardContent>
        {audit.length === 0 ? (
          <p className="text-text-muted text-xs">Nothing yet.</p>
        ) : (
          <ul className="grid gap-2.5 text-xs">
            {audit.map(entry => (
              <li key={entry.id} className="grid gap-0.5">
                <span className="text-text">{describe(entry)}</span>
                <span className="text-text-muted">
                  {entry.adminEmail} · {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
