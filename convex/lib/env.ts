const TRAILING_SLASHES = /\/+$/u;

/** The web app's public URL without a trailing slash, or undefined if unset. */
export function appUrl(): string | undefined {
  return process.env.APP_URL?.replace(TRAILING_SLASHES, "") || undefined;
}
