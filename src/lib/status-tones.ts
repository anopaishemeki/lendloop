/** Badge colours shared by every status badge, so tones mean the same thing. */
export const STATUS_TONES = {
  bad: "bg-destructive/12 text-destructive",
  good: "bg-success/12 text-success",
  info: "bg-secondary text-secondary-foreground",
  muted: "bg-muted text-muted-foreground",
  warn: "bg-warning/18 text-accent-foreground",
} as const;
