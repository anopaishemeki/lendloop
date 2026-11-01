"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
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
import { ClearFilters } from "./tool-filters";
import { UrlFilter } from "./url-filter";
import { UrlSearch } from "./url-search";
import { useSearchText } from "./use-url-param";

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

const BASE_PATH = "/admin/neighbors";
const ALL = "all";
const TRUSTED = "trusted";
const TRUST_OPTIONS = [
  { label: "All neighbors", value: ALL },
  { label: "Trusted lenders", value: TRUSTED },
] as const;

/** Neighbors, filtered by the URL's ?q (name) and ?show=trusted. */
export function AdminUsers() {
  const search = useSearchText();
  const trustedOnly = useSearchParams().get("show") === TRUSTED;
  const filtered = Boolean(search) || trustedOnly;
  const users = usePaginatedQuery(
    api.admin.listUsers,
    { search, trustedOnly: trustedOnly || undefined },
    { initialNumItems: ADMIN_PAGE_SIZE }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <UrlSearch
          basePath={BASE_PATH}
          label="Search neighbors by name"
          placeholder="Search by name"
        />
        <UrlFilter<typeof ALL | typeof TRUSTED>
          basePath={BASE_PATH}
          defaultValue={ALL}
          label="Show"
          options={TRUST_OPTIONS}
          param="show"
          value={trustedOnly ? TRUSTED : ALL}
        />
        {filtered ? <ClearFilters basePath={BASE_PATH} /> : null}
      </div>
      <TableState
        empty={
          filtered ? "No neighbors match." : "No neighbors have signed up yet."
        }
        query={users}
      >
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
    </div>
  );
}
