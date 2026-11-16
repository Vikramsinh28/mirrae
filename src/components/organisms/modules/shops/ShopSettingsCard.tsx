'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRotateShopKey, useUpdateShop } from '@/hooks/useShops';
import type { Shop } from '@/services/api/shops';

const toLines = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map(line => line.trim())
    .filter(Boolean);

export function ShopSettingsCard({ shop }: { shop: Shop }) {
  const update = useUpdateShop(shop.id);
  const rotate = useRotateShopKey(shop.id);

  const [name, setName] = useState(shop.name);
  const [origins, setOrigins] = useState(shop.allowedOrigins.join('\n'));
  const [imageHosts, setImageHosts] = useState(shop.imageHosts.join('\n'));
  const [cap, setCap] = useState(String(shop.dailyTryOnCap));

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await update.mutateAsync({
        name,
        allowedOrigins: toLines(origins),
        imageHosts: toLines(imageHosts),
        dailyTryOnCap: Number(cap),
      });
    } catch {
      // The shared API error handling shows what to fix; keep what the merchant typed.
    }
  };

  const handleRotate = () => {
    if (window.confirm('Create a new public key? The old one stops working immediately, so you must paste the new code on your website.')) {
      void rotate.mutateAsync(undefined).catch(() => undefined);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Control where the button works and how much it can spend each day.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="settings-name">Shop name</Label>
            <Input id="settings-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="settings-origins">Websites allowed to show the button</Label>
            <Textarea id="settings-origins" value={origins} onChange={event => setOrigins(event.target.value)} rows={3} placeholder="https://www.example.com" />
            <p className="text-text-muted text-xs">One per line, with https://. Other websites cannot use your shop key.</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="settings-hosts">Extra image hosts (optional)</Label>
            <Textarea id="settings-hosts" value={imageHosts} onChange={event => setImageHosts(event.target.value)} rows={2} placeholder="cdn.shopify.com" />
            <p className="text-text-muted text-xs">Where your product photos are stored, if not on {shop.domain}. One per line.</p>
          </div>

          <div className="grid max-w-xs gap-1.5">
            <Label htmlFor="settings-cap">Daily try-on limit</Label>
            <Input id="settings-cap" type="number" min={1} max={2000} value={cap} onChange={event => setCap(event.target.value)} />
            <p className="text-text-muted text-xs">The most try-ons shoppers can start per day (resets at midnight UTC). Stops surprise spending.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="submit" isLoading={update.isPending} loadingText="Saving…">
              Save settings
            </Button>
            <Button type="button" variant="destructive" onClick={handleRotate} isLoading={rotate.isPending} loadingText="Creating…">
              Create a new public key
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
