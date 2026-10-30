"use client";

import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatRange, localTodayIso } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { addDays } from "../../../convex/lib/dates";
import { LOAN_MAX_DAYS, LOAN_NOTE_MAX } from "../../../convex/lib/validators";

function BookedDates({ toolId }: { toolId: Id<"tools"> }) {
  const booked = useQuery(api.loans.bookedRanges, { toolId });
  if (!booked?.length) return null;
  return (
    <div className="bg-muted rounded-md px-3 py-2 text-sm">
      <p className="font-medium">Already booked</p>
      <ul className="text-muted-foreground">
        {booked.map((range) => (
          <li key={range.startDate}>
            {formatRange(range.startDate, range.endDate)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RequestDialog({
  toolId,
  toolName,
}: {
  toolId: Id<"tools">;
  toolName: string;
}) {
  const request = useMutation(api.loans.request);
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const today = localTodayIso();
  const latestEnd = startDate
    ? addDays(startDate, LOAN_MAX_DAYS - 1)
    : undefined;

  const changeStart = (value: string) => {
    setStartDate(value);
    const latest = value ? addDays(value, LOAN_MAX_DAYS - 1) : undefined;
    if (endDate && (endDate < value || (latest && endDate > latest))) {
      setEndDate("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await request({ endDate, note: note || undefined, startDate, toolId });
      toast.success("Request sent. Track it under My requests.");
      setOpen(false);
      setStartDate("");
      setEndDate("");
      setNote("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm">Request to borrow</Button>
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Borrow {toolName}</DialogTitle>
            <DialogDescription>
              Pick the days you need it, up to {LOAN_MAX_DAYS} days.
            </DialogDescription>
          </DialogHeader>
          {open ? <BookedDates toolId={toolId} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="loan-start">From</Label>
              <Input
                id="loan-start"
                min={today}
                onChange={(e) => changeStart(e.target.value)}
                required
                type="date"
                value={startDate}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loan-end">Until</Label>
              <Input
                id="loan-end"
                max={latestEnd}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                required
                type="date"
                value={endDate}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loan-note">Note for the owner (optional)</Label>
            <Textarea
              id="loan-note"
              maxLength={LOAN_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What it's for, when you could pick it up"
              rows={3}
              value={note}
            />
          </div>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
