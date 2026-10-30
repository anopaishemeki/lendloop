"use client";

import { useMutation, useQuery } from "convex/react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarClock, HandHelping } from "lucide-react";
import { type FormEvent, useState } from "react";
import { CategoryIcon } from "@/components/category-icon";
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
import { useToastAction } from "@/lib/use-toast-action";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { addDays } from "../../../convex/lib/dates";
import {
  LOAN_MAX_DAYS,
  LOAN_NOTE_MAX,
  type ToolCategory,
} from "../../../convex/lib/validators";

function latestEndFor(start: string) {
  return start ? addDays(start, LOAN_MAX_DAYS - 1) : undefined;
}

function BookedDates({ toolId }: { toolId: Id<"tools"> }) {
  const booked = useQuery(api.loans.bookedRanges, { toolId });
  if (!booked?.length) return null;
  return (
    <div className="rounded-xl border bg-muted/60 px-4 py-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <CalendarClock aria-hidden className="size-4 text-terracotta" />
        Already booked
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {booked.map((range) => (
          <li
            className="rounded-full border bg-card px-2.5 py-0.5 text-muted-foreground text-xs"
            key={range.startDate}
          >
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
  category,
}: {
  toolId: Id<"tools">;
  toolName: string;
  category: ToolCategory;
}) {
  const request = useMutation(api.loans.request);
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const { pending, run } = useToastAction();
  const today = localTodayIso();
  const latestEnd = latestEndFor(startDate);
  const days =
    startDate && endDate && endDate >= startDate
      ? differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1
      : null;

  const changeStart = (value: string) => {
    setStartDate(value);
    const latest = latestEndFor(value);
    if (endDate && (endDate < value || (latest && endDate > latest))) {
      setEndDate("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const sent = await run(
      () => request({ endDate, note: note || undefined, startDate, toolId }),
      "Request sent. Track it under My requests."
    );
    if (sent) {
      setOpen(false);
      setStartDate("");
      setEndDate("");
      setNote("");
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto" size="sm">
          <HandHelping aria-hidden />
          Request to borrow
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <DialogHeader className="flex-row items-center gap-3 text-left">
            <CategoryIcon category={category} />
            <div className="space-y-1">
              <DialogTitle className="font-semibold font-serif text-2xl">
                Borrow the {toolName}
              </DialogTitle>
              <DialogDescription>
                Pick the days you need it, up to {LOAN_MAX_DAYS} days.
              </DialogDescription>
            </div>
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
          <DialogFooter className="items-center sm:justify-between">
            <p className="text-muted-foreground text-sm" role="status">
              {days ? `${days === 1 ? "1 day" : `${days} days`} requested` : null}
            </p>
            <Button disabled={pending} type="submit">
              {pending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
