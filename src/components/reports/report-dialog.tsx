"use client";

import { useMutation } from "convex/react";
import { Flag } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASON_LABELS } from "@/lib/report-labels";
import { useToastAction } from "@/lib/use-toast-action";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  type ReportReason,
} from "../../../convex/lib/validators";

/** Lets a neighbor flag someone else's listing for the admins. */
export function ReportDialog({
  toolId,
  toolName,
}: {
  toolId: Id<"tools">;
  toolName: string;
}) {
  const create = useMutation(api.reports.create);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const { pending, run } = useToastAction();

  // Closing without sending discards the draft too.
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setReason("");
      setDetails("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason) return;
    const sent = await run(
      () => create({ details: details || undefined, reason, toolId }),
      "Thanks. An admin will take a look."
    );
    if (sent) changeOpen(false);
  };

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label={`Report ${toolName}`}
          size="sm"
          title="Report this listing"
          variant="ghost"
        >
          <Flag aria-hidden />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-semibold">
              Report {toolName}
            </DialogTitle>
            <DialogDescription>
              Admins review every report. The lender isn't told who sent it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="report-reason">What's wrong?</Label>
            <Select
              onValueChange={(value) => setReason(value as ReportReason)}
              required
              value={reason}
            >
              <SelectTrigger className="w-full" id="report-reason">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {REPORT_REASON_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-details">Details (optional)</Label>
            <Textarea
              id="report-details"
              maxLength={REPORT_DETAILS_MAX}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything that helps an admin decide"
              rows={3}
              value={details}
            />
          </div>
          <DialogFooter>
            <Button disabled={pending || !reason} type="submit">
              {pending ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
