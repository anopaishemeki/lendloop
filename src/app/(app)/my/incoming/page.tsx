import { LoanBoard } from "@/components/loans/loan-board";
import { PageHeader } from "@/components/page-header";

const COPY = {
  active: {
    empty: "None of your tools are lent out.",
    title: "Lent out and upcoming",
  },
  history: { empty: "No past loans yet.", title: "History" },
  pending: { empty: "You're all caught up.", title: "Needs your decision" },
};

export default function IncomingRequestsPage() {
  return (
    <>
      <PageHeader
        description="Neighbors asking to borrow your tools. Approve, decline, and mark things returned when they come back."
        eyebrow="Lending"
        title="Incoming requests"
      />
      <LoanBoard copy={COPY} viewerRole="owner" />
    </>
  );
}
