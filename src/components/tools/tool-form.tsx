"use client";

import { type FormEvent, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  CONDITION_LABELS,
} from "@/lib/tool-labels";
import { cn } from "@/lib/utils";
import {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  TOOL_DESCRIPTION_MAX,
  TOOL_NAME_MAX,
  TOOL_NAME_MIN,
  type ToolCategory,
  type ToolCondition,
} from "../../../convex/lib/validators";
import { ToolCard } from "./tool-card";
import type { ToolView } from "./types";

export type ToolFormValues = {
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
};

const EMPTY: ToolFormValues = {
  category: "power_tools",
  condition: "good",
  description: "",
  name: "",
};

/** Radio inputs styled as selectable tiles; native radios keep keyboard support. */
function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  render,
  className,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  render: (option: T) => React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={className}>
        {options.map((option) => (
          <label
            className={cn(
              "bg-card has-focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors has-focus-visible:ring-[3px]",
              option === value
                ? "border-primary bg-secondary text-secondary-foreground"
                : "hover:border-foreground/25"
            )}
            key={option}
          >
            <input
              checked={option === value}
              className="sr-only"
              name={name}
              onChange={() => onChange(option)}
              type="radio"
              value={option}
            />
            {render(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ToolForm({
  initial = EMPTY,
  availability = "available",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ToolFormValues;
  /** Shown in the preview so editing a lent-out tool previews "On loan". */
  availability?: ToolView["availability"];
  submitLabel: string;
  onSubmit: (values: ToolFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof ToolFormValues>(
    key: K,
    value: ToolFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await onSubmit(values);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form className="surface grid gap-7 p-6 sm:p-8" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="tool-name">Name</Label>
          <Input
            className="h-11 text-base"
            id="tool-name"
            maxLength={TOOL_NAME_MAX}
            minLength={TOOL_NAME_MIN}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Cordless drill"
            required
            value={values.name}
          />
        </div>

        <ChoiceGroup
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          legend="Category"
          name="category"
          onChange={(category) => set("category", category)}
          options={TOOL_CATEGORIES}
          render={(category) => {
            const Icon = CATEGORY_STYLES[category].icon;
            return (
              <>
                <Icon aria-hidden className="size-4 shrink-0" />
                {CATEGORY_LABELS[category]}
              </>
            );
          }}
          value={values.category}
        />

        <ChoiceGroup
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          legend="Condition"
          name="condition"
          onChange={(condition) => set("condition", condition)}
          options={TOOL_CONDITIONS}
          render={(condition) => CONDITION_LABELS[condition]}
          value={values.condition}
        />

        <div className="grid gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="tool-description">Short description</Label>
            <span className="text-muted-foreground text-xs tabular-nums">
              {values.description.length}/{TOOL_DESCRIPTION_MAX}
            </span>
          </div>
          <Textarea
            id="tool-description"
            maxLength={TOOL_DESCRIPTION_MAX}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What's included, any quirks, pickup notes"
            rows={4}
            value={values.description}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-6">
          <Button disabled={pending} size="lg" type="submit">
            {pending ? "Saving…" : submitLabel}
          </Button>
          <Button onClick={onCancel} size="lg" type="button" variant="ghost">
            Cancel
          </Button>
        </div>
      </form>

      <aside aria-label="Preview" className="space-y-3">
        <Eyebrow className="text-muted-foreground">
          How neighbors will see it
        </Eyebrow>
        <ToolCard
          tool={{
            ...values,
            availability,
            description: values.description.trim(),
            isMine: true,
            name: values.name.trim() || "Your tool's name",
            owner: { firstName: "", isTrustedLender: false },
          }}
        />
      </aside>
    </div>
  );
}
