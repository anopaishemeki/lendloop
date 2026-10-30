"use client";

import { useQuery } from "convex/react";
import { LoanBoard } from "@/components/loans/loan-board";
import { PageHeader } from "@/components/page-header";
import { api } from "../../../../../convex/_generated/api";

export default function IncomingRequestsPage() {
  const loans = useQuery(api.loans.listIncoming);

  return (
    <>
      <PageHeader
        description="Requests to borrow your tools."
        title="Incoming requests"
      />
      <LoanBoard
        active={{
          empty: "None of your tools are lent out.",
          title: "Lent out and upcoming",
        }}
        history={{ empty: "No past loans yet.", title: "History" }}
        loans={loans}
        pending={{
          empty: "You're all caught up.",
          title: "Needs your decision",
        }}
      />
    </>
  );
}
