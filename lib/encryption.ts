/**
 * Application-level encryption at rest for sensitive credentials —
 * AES-256-GCM via Node's built-in crypto. Nothing in this codebase had an
 * existing encryption-at-rest pattern to reuse (SchwabToken.refreshToken is
 * stored plaintext, confirmed by inspection — a pre-existing gap, not
 * touched here), and there's no pgcrypto/DB-level encryption configured on
 * the Railway Postgres instance, so this is a new, minimal
 * application-level utility rather than either of those.
 *
 * ENCRYPTION_KEY must be a 32-byte key, base64-encoded, set as an env var —
 * never hardcoded, never logged. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // recommended for GCM

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY is not configured')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes')
  return key
}

/** Returns "iv:authTag:ciphertext", each base64, colon-joined — one string, safe to store in a single text column. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`
}

export function decrypt(packed: string): string {
  const [ivB64, tagB64, ciphertextB64] = packed.split(':')
  if (!ivB64 || !tagB64 || !ciphertextB64) throw new Error('Malformed encrypted value')
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()])
  return plaintext.toString('utf8')
}
