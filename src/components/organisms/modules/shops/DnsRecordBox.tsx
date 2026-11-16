'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { VerificationRecord } from '@/services/api/shops';

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copying is a convenience: the value is shown, so it can still be selected by hand
    }
  };

  return (
    <div className="grid gap-1">
      <span className="text-text-muted text-[11px]">{label}</span>
      <div className="flex items-center gap-2">
        <code className="bg-muted min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs break-all">{value}</code>
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

/** The DNS TXT record a merchant adds at their domain provider to prove they own the website. */
export function DnsRecordBox({ record }: { record: VerificationRecord }) {
  return (
    <div className="grid gap-3">
      <p className="text-text-muted text-xs">
        Add this record where you manage your domain (your domain provider&apos;s DNS settings). Keep the record once added.
      </p>
      <CopyField label="Type" value="TXT" />
      <CopyField label="Name (Host)" value={record.name} />
      <CopyField label="Value" value={record.value} />
      <p className="text-text-muted text-[11px]">
        Some providers want only the first part of the name (the part before your domain). Changes can take a few minutes, sometimes a few hours.
      </p>
    </div>
  );
}
