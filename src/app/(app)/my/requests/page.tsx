import { LoanBoard } from "@/components/loans/loan-board";
import { PageHeader } from "@/components/page-header";

const COPY = {
  active: {
    empty: "Nothing borrowed right now.",
    title: "Approved and borrowed",
  },
  history: { empty: "No past loans yet.", title: "History" },
  pending: {
    empty: "No requests waiting on an owner.",
    title: "Waiting for the owner",
  },
};

export default function MyRequestsPage() {
  return (
    <>
      <PageHeader
        description="Tools you've asked to borrow, what's out with you now, and what you've returned."
        eyebrow="Borrowing"
        title="My requests"
      />
      <LoanBoard copy={COPY} viewerRole="borrower" />
    </>
  );
}
