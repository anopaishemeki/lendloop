import { STATUS_TONES } from "@/lib/status-tones";
import type { ReportReason, ReportStatus } from "../../convex/lib/validators";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate: "Inappropriate",
  misleading: "Misleading or inaccurate",
  other: "Something else",
  spam: "Spam",
  unsafe: "Unsafe to use",
};

export const REPORT_STATUS_STYLES: Record<
  ReportStatus,
  { label: string; className: string }
> = {
  actioned: { className: STATUS_TONES.bad, label: "Listing removed" },
  dismissed: { className: STATUS_TONES.muted, label: "Dismissed" },
  open: { className: STATUS_TONES.warn, label: "Open" },
};
