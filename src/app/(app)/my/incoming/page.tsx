"use client";

import { useQuery } from "convex/react";
import { LoanBoard } from "@/components/loans/loan-board";
import { PageHeader } from "@/components/page-header";
import { api } from "../../../../../convex/_generated/api";

const COPY = {
  active: {
    empty: "None of your tools are lent out.",
    title: "Lent out and upcoming",
  },
  history: { empty: "No past loans yet.", title: "History" },
  pending: { empty: "You're all caught up.", title: "Needs your decision" },
};

export default function IncomingRequestsPage() {
  const board = useQuery(api.loans.listIncoming);

  return (
    <>
      <PageHeader
        description="Requests to borrow your tools."
        title="Incoming requests"
      />
      <LoanBoard board={board} copy={COPY} />
    </>
  );
}
