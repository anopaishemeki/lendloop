"use client";

import { useQuery } from "convex/react";
import { AvailabilityBadge } from "@/components/tools/availability-badge";
import { RemoveToolButton } from "@/components/tools/remove-tool-button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_LABELS } from "@/lib/tool-labels";
import { api } from "../../../convex/_generated/api";
import { TableState } from "./table-state";

export function AdminTools() {
  const tools = useQuery(api.admin.listTools);

  return (
    <TableState empty="No listings yet." rows={tools}>
      {(rows) => (
        <>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Lender</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((tool) => (
              <TableRow key={tool._id}>
                <TableCell className="font-medium">{tool.name}</TableCell>
                <TableCell>{CATEGORY_LABELS[tool.category]}</TableCell>
                <TableCell>{tool.ownerName}</TableCell>
                <TableCell>
                  <AvailabilityBadge availability={tool.availability} />
                </TableCell>
                <TableCell className="text-right">
                  <RemoveToolButton toolId={tool._id} toolName={tool.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </>
      )}
    </TableState>
  );
}
