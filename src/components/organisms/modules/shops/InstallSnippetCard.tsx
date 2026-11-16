'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { siteConfig } from '@/app/siteConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { buildInstallSnippet, type SnippetLanguage } from '@/lib/shops/install-snippet';
import type { Shop } from '@/services/api/shops';

const COPIED_MS = 2000;
const LANGUAGE_CHOICES: { value: SnippetLanguage; label: string }[] = [
  { value: 'auto', label: 'Same as my page' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'ar', label: 'العربية (Arabic)' },
];

export function InstallSnippetCard({ shop }: { shop: Shop }) {
  const [lang, setLang] = useState<SnippetLanguage>('auto');
  const [color, setColor] = useState('#111111');
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const [showAllViews, setShowAllViews] = useState(true);
  const [copied, setCopied] = useState(false);

  const snippet = buildInstallSnippet({
    appUrl: siteConfig.url,
    publicKey: shop.publicKey,
    lang,
    color,
    label,
    target,
    views: showAllViews ? 'multi' : 'single',
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard access can be blocked; the snippet stays selectable in the box for a manual copy.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add it to your website</CardTitle>
        <CardDescription>
          Paste this code on your product pages, just before the closing <code>&lt;/body&gt;</code> tag. The Try it on button appears by itself.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="relative">
          <pre aria-label="Install code" className="bg-muted/60 overflow-x-auto rounded-lg p-3 pr-24 text-[11px] leading-relaxed whitespace-pre-wrap break-all select-all">
            {snippet}
          </pre>
          <Button type="button" size="sm" variant="secondary" className="absolute top-2 right-2" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="snippet-lang">Language</Label>
            <select
              id="snippet-lang"
              value={lang}
              onChange={event => setLang(event.target.value as SnippetLanguage)}
              className="bg-input/20 dark:bg-input/30 border-input h-7 w-full rounded-md border px-2 text-xs"
            >
              {LANGUAGE_CHOICES.map(choice => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="snippet-color">Button colour</Label>
            <div className="flex items-center gap-2">
              <input id="snippet-color" type="color" value={color} onChange={event => setColor(event.target.value)} className="size-7 cursor-pointer rounded border p-0" />
              <span className="text-text-muted text-xs">{color}</span>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="snippet-label">Button text (optional)</Label>
            <Input id="snippet-label" value={label} onChange={event => setLabel(event.target.value)} placeholder="Try it on" maxLength={40} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="snippet-target">Place the button inside (optional)</Label>
            <Input id="snippet-target" value={target} onChange={event => setTarget(event.target.value)} placeholder="#add-to-cart-area" />
            <p className="text-text-muted text-xs">A CSS selector. Leave empty for a floating button.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="snippet-views" checked={showAllViews} onCheckedChange={setShowAllViews} />
          <Label htmlFor="snippet-views">Show front, side and back views (uses 2 credits per try-on)</Label>
        </div>

        {shop.status !== 'ACTIVE' && (
          <p role="status" className="text-xs text-yellow-700 dark:text-yellow-500">
            This shop is not live right now, so the button will not work until it is switched on.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
