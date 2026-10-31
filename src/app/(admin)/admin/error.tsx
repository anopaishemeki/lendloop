"use client";

import type { ComponentProps } from "react";
import { RouteError } from "@/components/route-error";

export default function AdminError(props: ComponentProps<typeof RouteError>) {
  return <RouteError {...props} />;
}
