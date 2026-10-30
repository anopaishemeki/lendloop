import type { ToolCategory, ToolCondition } from "../../convex/lib/validators";

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  camping: "Camping",
  cleaning: "Cleaning",
  garden: "Garden",
  hand_tools: "Hand tools",
  kitchen: "Kitchen",
  other: "Other",
  power_tools: "Power tools",
};

export const CONDITION_LABELS: Record<ToolCondition, string> = {
  fair: "Fair",
  good: "Good",
  new: "Like new",
  worn: "Well used",
};
