"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * A status filter kept in the URL's ?status, so overview links and reloads
 * agree. The default option is the bare path.
 */
export function UrlStatusFilter<T extends string>({
  basePath,
  defaultValue,
  options,
  value,
}: {
  basePath: string;
  defaultValue: T;
  options: readonly { value: T; label: string }[];
  value: T;
}) {
  const router = useRouter();
  return (
    <Select
      onValueChange={(next) =>
        router.replace(
          next === defaultValue ? basePath : `${basePath}?status=${next}`,
          { scroll: false }
        )
      }
      value={value}
    >
      <SelectTrigger aria-label="Filter by status" className="w-48">
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
