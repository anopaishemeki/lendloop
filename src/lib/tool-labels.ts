import {
  CookingPot,
  Drill,
  Hammer,
  type LucideIcon,
  Package,
  Sprout,
  SprayCan,
  Tent,
} from "lucide-react";
import type {
  ToolCategory,
  ToolCondition,
} from "../../convex/lib/validators";

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  camping: "Camping",
  cleaning: "Cleaning",
  garden: "Garden",
  hand_tools: "Hand tools",
  kitchen: "Kitchen",
  other: "Other",
  power_tools: "Power tools",
};

/** Icon and tint per category, used on tool cards, filters and the landing page. */
export const CATEGORY_STYLES: Record<
  ToolCategory,
  { icon: LucideIcon; tint: string }
> = {
  camping: {
    icon: Tent,
    tint: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  },
  cleaning: {
    icon: SprayCan,
    tint: "bg-cyan-100 text-cyan-800 dark:bg-cyan-400/15 dark:text-cyan-300",
  },
  garden: {
    icon: Sprout,
    tint: "bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300",
  },
  hand_tools: {
    icon: Hammer,
    tint: "bg-stone-200 text-stone-800 dark:bg-stone-400/15 dark:text-stone-300",
  },
  kitchen: {
    icon: CookingPot,
    tint: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
  },
  other: {
    icon: Package,
    tint: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300",
  },
  power_tools: {
    icon: Drill,
    tint: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  },
};

export const CONDITION_LABELS: Record<ToolCondition, string> = {
  fair: "Fair",
  good: "Good",
  new: "Like new",
  worn: "Well used",
};
