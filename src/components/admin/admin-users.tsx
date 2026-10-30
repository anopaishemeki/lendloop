"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { TrustedLenderBadge } from "@/components/trusted-lender-badge";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToastAction } from "@/lib/use-toast-action";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ADMIN_PAGE_SIZE, TableState } from "./table-state";

function TrustedToggle({
  userId,
  name,
  trusted,
}: {
  userId: Id<"users">;
  name: string;
  trusted: boolean;
}) {
  const setTrusted = useMutation(api.admin.setTrustedLender);
  const { pending, run } = useToastAction();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        run(
          () => setTrusted({ trusted: !trusted, userId }),
          trusted
            ? `${name} is no longer a trusted lender`
            : `${name} is now a trusted lender`
        )
      }
      size="sm"
      variant={trusted ? "ghost" : "outline"}
    >
      {trusted ? "Remove badge" : "Mark trusted"}
    </Button>
  );
}

export function AdminUsers() {
  const users = usePaginatedQuery(
    api.admin.listUsers,
    {},
    { initialNumItems: ADMIN_PAGE_SIZE }
  );

  return (
    <TableState empty="No neighbors have signed up yet." query={users}>
      {(rows) => (
        <>
          <TableHeader>
            <TableRow>
              <TableHead>Neighbor</TableHead>
              <TableHead>Trusted lender</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((user) => (
              <TableRow key={user._id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>
                  {user.isTrustedLender ? (
                    <TrustedLenderBadge label="Trusted" />
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <TrustedToggle
                    name={user.name}
                    trusted={user.isTrustedLender}
                    userId={user._id}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </>
      )}
    </TableState>
  );
}
