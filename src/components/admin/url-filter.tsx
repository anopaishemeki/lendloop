"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * A filter kept in the URL (?status=… by default), so overview links and
 * reloads agree. The default option drops the param. Callers sit inside a
 * Suspense boundary (it reads the search params).
 */
export function UrlFilter<T extends string>({
  basePath,
  defaultValue,
  label = "Filter by status",
  options,
  param = "status",
  value,
}: {
  basePath: string;
  defaultValue: T;
  /** Accessible name of the select. */
  label?: string;
  options: readonly { value: T; label: string }[];
  param?: string;
  value: T;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only this filter's param changes; any others in the URL are kept.
  const select = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === defaultValue) params.delete(param);
    else params.set(param, next);
    const query = params.toString();
    router.replace(query ? `${basePath}?${query}` : basePath, {
      scroll: false,
    });
  };
  return (
    <Select onValueChange={select} value={value}>
      <SelectTrigger aria-label={label} className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
