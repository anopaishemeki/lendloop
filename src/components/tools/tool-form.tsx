"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/tool-labels";
import {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  type ToolCategory,
  type ToolCondition,
} from "../../../convex/lib/validators";

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

export function ToolForm({
  initial = EMPTY,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ToolFormValues;
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
    <form className="grid max-w-xl gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="tool-name">Name</Label>
        <Input
          id="tool-name"
          maxLength={80}
          minLength={2}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Cordless drill"
          required
          value={values.name}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="tool-category">Category</Label>
          <Select
            onValueChange={(v) => set("category", v as ToolCategory)}
            value={values.category}
          >
            <SelectTrigger className="w-full" id="tool-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOOL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tool-condition">Condition</Label>
          <Select
            onValueChange={(v) => set("condition", v as ToolCondition)}
            value={values.condition}
          >
            <SelectTrigger className="w-full" id="tool-condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOOL_CONDITIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CONDITION_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="tool-description">Short description</Label>
        <Textarea
          id="tool-description"
          maxLength={500}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What's included, any quirks, pickup notes"
          rows={4}
          value={values.description}
        />
      </div>
      <div className="flex gap-2">
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
