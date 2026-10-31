"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/dates";
import { api } from "../../../convex/_generated/api";

type Series = FunctionReturnType<
  typeof api.admin.automationOutcomes
>["deliveries"];

const PLOT_HEIGHT = 112;
// The 2px gap between a day's two segments comes out of the plot height.
const SEGMENT_GAP = 2;
// Failed segments get a hatch as well as the red, so they read without color.
const FAILED_FILL =
  "repeating-linear-gradient(135deg, var(--destructive) 0 3px, color-mix(in oklch, var(--destructive) 55%, var(--card)) 3px 5px)";

const shortDay = (iso: string) => format(parseISO(iso), "d MMM");

function Legend() {
  return (
    <ul className="text-muted-foreground flex gap-4 text-xs">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="bg-success size-2.5 rounded-sm" />
        Sent
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-2.5 rounded-sm"
          style={{ background: FAILED_FILL }}
        />
        Failed
      </li>
    </ul>
  );
}

/** One day's stacked column: sent from the baseline, failed on top. */
function Column({
  day,
  failed,
  sent,
  max,
}: {
  day: string;
  failed: number;
  sent: number;
  max: number;
}) {
  const scale = (value: number) =>
    max > 0 ? (value / max) * (PLOT_HEIGHT - SEGMENT_GAP) : 0;
  const label = `${formatDay(day)}: ${sent} sent, ${failed} failed`;
  return (
    <li className="group relative flex h-full flex-1 justify-center">
      {/* The hit target is the whole day's slot, not just the bars. */}
      <button
        aria-label={label}
        className="focus-visible:ring-ring flex h-full w-full max-w-6 flex-col-reverse items-stretch gap-0.5 rounded-sm outline-none focus-visible:ring-2"
        type="button"
      >
        {sent > 0 ? (
          <span
            className={`bg-success block ${failed > 0 ? "" : "rounded-t"}`}
            style={{ height: scale(sent) }}
          />
        ) : null}
        {failed > 0 ? (
          <span
            className="block rounded-t"
            style={{ background: FAILED_FILL, height: scale(failed) }}
          />
        ) : null}
      </button>
      <span
        className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full z-10 mb-2 hidden rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md group-focus-within:block group-hover:block"
        role="tooltip"
      >
        <span className="font-medium">{formatDay(day)}</span>
        <span className="text-muted-foreground block tabular-nums">
          {sent} sent · {failed} failed
        </span>
      </span>
    </li>
  );
}

function OutcomeChart({ title, series }: { title: string; series: Series }) {
  const max = Math.max(...series.map((d) => d.sent + d.failed));
  const sent = series.reduce((sum, d) => sum + d.sent, 0);
  const failed = series.reduce((sum, d) => sum + d.failed, 0);
  const [first] = series;
  const last = series.at(-1);

  return (
    <figure className="space-y-3">
      <figcaption>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-muted-foreground text-xs tabular-nums">
          {sent} sent
          {failed > 0 ? (
            <span className="text-destructive"> · {failed} failed</span>
          ) : (
            " · none failed"
          )}
        </p>
      </figcaption>
      <div className="relative">
        <ol
          aria-label={`${title}, sent and failed per day`}
          className="border-border flex items-end gap-0.5 border-b"
          style={{ height: PLOT_HEIGHT }}
        >
          {series.map((d) => (
            <Column key={d.day} max={max} {...d} />
          ))}
        </ol>
        {max === 0 ? (
          <p className="text-muted-foreground absolute inset-0 grid place-items-center text-xs">
            Nothing in these {series.length} days
          </p>
        ) : null}
      </div>
      {first && last ? (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{shortDay(first.day)}</span>
          <span>{shortDay(last.day)}</span>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{title} per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Sent</th>
            <th scope="col">Failed</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <th scope="row">{formatDay(d.day)}</th>
              <td>{d.sent}</td>
              <td>{d.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Recent delivery and reminder outcomes, one small chart each. */
export function AutomationOutcomes() {
  const outcomes = useQuery(api.admin.automationOutcomes);
  const dayCount = outcomes?.deliveries.length;
  return (
    <section className="surface space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {dayCount ? `Last ${dayCount} days` : "Recent outcomes"}
          </h2>
          <p className="text-muted-foreground text-sm">
            Sent and failed, by UTC day. Hover or focus a day for its numbers.
          </p>
        </div>
        <Legend />
      </div>
      {outcomes ? (
        <div className="grid gap-8 md:grid-cols-2">
          <OutcomeChart
            series={outcomes.deliveries}
            title="Request notifications"
          />
          <OutcomeChart series={outcomes.reminders} title="Overdue reminders" />
        </div>
      ) : (
        <Skeleton className="h-40" />
      )}
    </section>
  );
}
