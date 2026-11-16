'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateShop } from '@/hooks/useShops';

interface CreateShopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateShopDialog({ open, onOpenChange }: CreateShopDialogProps) {
  const router = useRouter();
  const createShop = useCreateShop();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

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
    } catch {
      // The error toast is shown by the shared API error handling; keep the form open to fix the input.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
      </DialogContent>
    </Dialog>
  );
}
