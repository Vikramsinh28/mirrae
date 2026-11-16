'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdjustCredits } from '@/hooks/useAdminShops';

/** Adds or removes credits on the account that pays for a shop. Needs a reason, asks before applying, and is recorded. */
export function AdminCreditsCard({ shopId, shopName, credits }: { shopId: string; shopName: string; credits: number }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const adjust = useAdjustCredits(shopId);

  const parsed = Number(amount);
  const validAmount = amount.trim() !== '' && Number.isFinite(parsed) && parsed !== 0;
  const canSubmit = validAmount && reason.trim().length >= 3 && !adjust.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    const verb = parsed > 0 ? `Add ${parsed} credits to` : `Remove ${Math.abs(parsed)} credits from`;
    if (!window.confirm(`${verb} ${shopName}? This is recorded with your name.`)) return;

    try {
      await adjust.mutateAsync({ amount: parsed, reason: reason.trim() });
      setAmount('');
      setReason('');
    } catch {
      // The reason (for example "would go below zero") is shown by the shared API error handling
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credits</CardTitle>
        <CardDescription>Balance of the account that pays for this shop. Use a negative number to remove credits.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-text text-2xl font-semibold">{credits.toFixed(1)}</p>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="credit-amount">Amount</Label>
            <Input id="credit-amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="50 or -10" className="max-w-[10rem]" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="credit-reason">Reason (kept in the history)</Label>
            <Input id="credit-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Compensation for the failed launch" maxLength={200} />
          </div>
          <Button type="submit" size="sm" className="w-fit" disabled={!canSubmit} isLoading={adjust.isPending} loadingText="Applying…">
            Apply
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
