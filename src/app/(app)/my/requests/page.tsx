"use client";

import { useQuery } from "convex/react";
import { LoanBoard } from "@/components/loans/loan-board";
import { PageHeader } from "@/components/page-header";
import { api } from "../../../../../convex/_generated/api";

export default function MyRequestsPage() {
  const loans = useQuery(api.loans.listMyRequests);

  return (
    <>
      <PageHeader
        description="Tools you've asked to borrow."
        title="My requests"
      />
      <LoanBoard
        active={{
          empty: "Nothing borrowed right now.",
          title: "Approved and borrowed",
        }}
        history={{ empty: "No past loans yet.", title: "History" }}
        loans={loans}
        pending={{
          empty: "No requests waiting on an owner.",
          title: "Waiting for the owner",
        }}
      />
    </>
  );
}
