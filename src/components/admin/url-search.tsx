"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useUrlParam } from "./use-url-param";

const DEBOUNCE_MS = 300;

/**
 * A search box kept in the URL (?q=…), so results can be linked and survive a
 * reload. Typing updates the URL after a short pause; other params are kept.
 * Callers sit inside a Suspense boundary (it reads the search params).
 */
export function UrlSearch({
  basePath,
  label,
  param = "q",
  placeholder,
}: {
  basePath: string;
  label: string;
  param?: string;
  placeholder: string;
}) {
  const { current, set } = useUrlParam(basePath, param);
  const [text, setText] = useState(current);

  // Follow the URL when it changes elsewhere (back button, "Clear filters").
  useEffect(() => setText(current), [current]);

  useEffect(() => {
    if (text.trim() === current) return;
    const timer = setTimeout(() => set(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [current, set, text]);

  return (
    <div className="relative w-full sm:w-64">
      <Search
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input
        aria-label={label}
        className="pl-9"
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={text}
      />
    </div>
  );
}
