import { createHmac } from 'node:crypto';
import { Resolver } from 'node:dns/promises';

/**
 * Proving that a merchant owns a website: they add a TXT record only the domain's owner can add. The token in
 * it is worked out from (their account, the website) and a server secret, so nothing is stored, and a record
 * made for one account is worthless to another even though DNS is public. DNS only: no request is ever made to
 * the merchant's website, so there is nothing for an attacker to point at our internal network.
 */

const RECORD_LABEL = '_mirrae-verification';
const VALUE_PREFIX = 'mirrae-verification=';
const TOKEN_LENGTH = 32;
const DNS_TIMEOUT_MS = 5_000;
// DNS errors that mean "there is no such record", as opposed to "the lookup itself broke"
const MISSING_RECORD_CODES = ['ENOTFOUND', 'ENODATA'];

export type DnsCheck = 'VERIFIED' | 'NOT_FOUND' | 'LOOKUP_FAILED';

export function domainVerificationToken(ownerId: number, domain: string, secret: string): string {
  return createHmac('sha256', secret).update(`domain-verification:v1:${ownerId}:${domain.toLowerCase()}`).digest('hex').slice(0, TOKEN_LENGTH);
}

export function verificationRecord(domain: string, token: string): { name: string; value: string } {
  return { name: `${RECORD_LABEL}.${domain}`, value: `${VALUE_PREFIX}${token}` };
}

/** Where the record may be: on the website's own name, and for a www website also on the bare domain (where most people manage DNS). */
export function candidateRecordNames(domain: string): string[] {
  const names = [`${RECORD_LABEL}.${domain}`];
  if (domain.startsWith('www.')) names.push(`${RECORD_LABEL}.${domain.slice(4)}`);
  return names;
}

type ResolveTxt = (name: string) => Promise<string[][]>;

function defaultResolveTxt(): ResolveTxt {
  const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 2 });
  return name => resolver.resolveTxt(name);
}

export async function checkDomainRecord(input: { domain: string; token: string; resolveTxt?: ResolveTxt }): Promise<DnsCheck> {
  if (!input.token) return 'NOT_FOUND';

  const resolveTxt = input.resolveTxt ?? defaultResolveTxt();
  const expected = `${VALUE_PREFIX}${input.token}`;
  let lookupFailed = false;

  for (const name of candidateRecordNames(input.domain)) {
    try {
      const records = await resolveTxt(name);
      // A long value is split into chunks by DNS; they belong together
      if (records.some(chunks => chunks.join('') === expected)) return 'VERIFIED';
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? '';
      if (!MISSING_RECORD_CODES.includes(code)) lookupFailed = true;
    }
  }
  return lookupFailed ? 'LOOKUP_FAILED' : 'NOT_FOUND';
}
