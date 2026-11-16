import { randomBytes } from 'node:crypto';

const KEY_BYTES = 18;

/** A new public key for a shop. It is safe to embed in a web page: it only opens a session, and only from allowed websites. */
export const generatePublicKey = (): string => `pk_live_${randomBytes(KEY_BYTES).toString('hex')}`;
