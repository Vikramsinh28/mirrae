'use client';

import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClaimDomain, useClaimInstructions, useCreateShop } from '@/hooks/useShops';

import { DnsRecordBox } from './DnsRecordBox';

interface CreateShopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Shown when someone else registered the website without proving they own it: the merchant can take it over by proving ownership. */
function ClaimWebsite({ name, domain, onDone, onBack }: { name: string; domain: string; onDone: (shopId: string) => void; onBack: () => void }) {
  const instructions = useClaimInstructions(domain, true);
  const claim = useClaimDomain();

  const handleClaim = async () => {
    try {
      const shop = await claim.mutateAsync({ name, domain });
      onDone(shop.id);
    } catch {
      // The reason (record not found yet, DNS trouble) is shown as a message by the shared API error handling
    }
  };

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Claim this website</DialogTitle>
        <DialogDescription>
          Another account added {domain} but has not proved it owns it. If it is yours, add this record to show it, and the website moves to you.
        </DialogDescription>
      </DialogHeader>
      {instructions.data && <DnsRecordBox record={instructions.data.record} />}
      {instructions.isError && <p role="alert" className="text-destructive text-xs">Could not load the steps. Please try again.</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={!instructions.data} isLoading={claim.isPending} loadingText="Checking…" onClick={() => void handleClaim()}>
          Check and claim
        </Button>
      </DialogFooter>
    </div>
  );
}

export function CreateShopDialog({ open, onOpenChange }: CreateShopDialogProps) {
  const router = useRouter();
  const createShop = useCreateShop();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [claiming, setClaiming] = useState(false);

  const canSubmit = name.trim() !== '' && domain.trim() !== '' && !createShop.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      const shop = await createShop.mutateAsync({ name, domain });
      onOpenChange(false);
      setName('');
      setDomain('');
      router.push(`/app/shops/${shop.id}`);
    } catch (error) {
      // The error toast is shown by the shared API error handling; keep the form open to fix the input.
      if (isAxiosError(error) && error.response?.data?.code === 'DOMAIN_CLAIMABLE') setClaiming(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {claiming ? (
          <ClaimWebsite
            name={name}
            domain={domain}
            onBack={() => setClaiming(false)}
            onDone={shopId => {
              onOpenChange(false);
              setClaiming(false);
              setName('');
              setDomain('');
              router.push(`/app/shops/${shopId}`);
            }}
          />
        ) : (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add your shop</DialogTitle>
            <DialogDescription>
              Tell us where the try-on button will appear. You can change the details later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="shop-name">Shop name</Label>
            <Input id="shop-name" value={name} onChange={event => setName(event.target.value)} placeholder="My Fashion Store" maxLength={80} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="shop-domain">Website address</Label>
            <Input id="shop-domain" value={domain} onChange={event => setDomain(event.target.value)} placeholder="www.myfashionstore.com" inputMode="url" />
            <p className="text-text-muted text-xs">Paste your website or a product page. We keep just the address.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} isLoading={createShop.isPending} loadingText="Adding…">
              Add shop
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
