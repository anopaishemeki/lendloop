import {
  BOARD_SECTIONS,
  type BoardSection,
  type LoanRole,
} from "../../../convex/lib/validators";
import { LoanSection } from "./loan-section";

type SectionCopy = { title: string; empty: string };

/** Pending, active and closed loans; each section pages through the server. */
export function LoanBoard({
  viewerRole,
  copy,
}: {
  viewerRole: LoanRole;
  copy: Record<BoardSection, SectionCopy>;
}) {
  return (
    <div className="space-y-12">
      {BOARD_SECTIONS.map((section) => (
        <LoanSection
          {...copy[section]}
          key={section}
          section={section}
          viewerRole={viewerRole}
        />
      ))}
    </div>
  );
}
