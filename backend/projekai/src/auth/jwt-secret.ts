/**
 * The JWT signing secret. There is deliberately no fallback: a default secret
 * would let anyone forge tokens (including the `role` claim) on any host where
 * the variable was forgotten.
 */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET wajib diatur (minimal 32 karakter).');
  }
  return secret;
}
