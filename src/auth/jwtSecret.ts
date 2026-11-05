/** The session JWT secret. Kept here so request auth and the GraphQL context share it without importing each other. */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set in environment and at least 32 characters'
    );
  }
  return secret;
}
