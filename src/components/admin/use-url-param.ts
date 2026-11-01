"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Sets (or, with an empty value, removes) one query param on `basePath`,
 * keeping the others, without scrolling. Callers sit inside a Suspense
 * boundary (it reads the search params).
 */
export function useUrlParam(basePath: string, param: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const set = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set(param, value);
      else params.delete(param);
      const query = params.toString();
      router.replace(query ? `${basePath}?${query}` : basePath, {
        scroll: false,
      });
    },
    [basePath, param, router, searchParams]
  );
  return { current: searchParams.get(param) ?? "", set };
}

/** The URL value that means "no filter" in every admin filter. */
export const ALL = "all";

/** One of `values` from the URL's `param`, or undefined if absent or unknown. */
export function useEnumParam<T extends string>(
  param: string,
  values: readonly T[]
): T | undefined {
  const raw = useSearchParams().get(param);
  return values.find((value) => value === raw);
}

/** The URL's search text (?q= by default), trimmed; undefined when empty. */
export function useSearchText(param = "q") {
  return useSearchParams().get(param)?.trim() || undefined;
}

/** Select options: "all" first, then each value with its label. */
export function filterOptions<T extends string>(
  allLabel: string,
  values: readonly T[],
  labelOf: (value: T) => string
) {
  return [
    { label: allLabel, value: ALL },
    ...values.map((value) => ({ label: labelOf(value), value })),
  ] as const;
}
