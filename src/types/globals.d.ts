export {};

declare global {
  interface CustomJwtSessionClaims {
    // Untrusted shape; read it through roleFromMetadata in convex/lib/roles.ts.
    metadata?: unknown;
  }
}
