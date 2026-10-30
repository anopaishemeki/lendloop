import { CATEGORY_STYLES } from "@/lib/tool-labels";
import { cn } from "@/lib/utils";
import type { ToolCategory } from "../../convex/lib/validators";

const SIZES = {
  lg: "size-12 rounded-xl [&_svg]:size-6",
  md: "size-10 rounded-lg [&_svg]:size-5",
  sm: "size-8 rounded-md [&_svg]:size-4",
};

/** A tinted tile with the category's icon. */
export function CategoryIcon({
  category,
  size = "md",
  className,
}: {
  category: ToolCategory;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { icon: Icon, tint } = CATEGORY_STYLES[category];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZES[size],
        tint,
        className
      )}
    >
      <Icon />
    </span>
  );
}
