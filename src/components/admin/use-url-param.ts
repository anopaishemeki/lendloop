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
