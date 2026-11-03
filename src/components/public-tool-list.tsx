import { ConvexHttpClient } from "convex/browser";
import { PackageOpen } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { CATEGORY_LABELS } from "@/lib/tool-labels";
import { api } from "../../convex/_generated/api";

const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

/**
 * Not `fetchQuery` from convex/nextjs: it forces `no-store`, which would make
 * the landing page render on every request instead of once a minute. Only the
 * build tolerates a failure (CI builds against a placeholder URL); a failed
 * background refresh throws, so Next keeps serving the last good page.
 */
async function fetchShelf() {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  try {
    return await convex.query(api.tools.listPublic);
  } catch (error) {
    if (process.env.NEXT_PHASE === "phase-production-build") return null;
    throw error;
  }
}

/**
 * Read-only list for signed-out visitors: name and category only. A server
 * component, refreshed with the landing page rather than kept live.
 */
export async function PublicToolList() {
  const tools = await fetchShelf();

  if (tools === null) {
    return (
      <EmptyState icon={PackageOpen} title="The shelf is out of reach">
        <p className="text-muted-foreground text-sm">
          Sign in to see what neighbors are lending.
        </p>
      </EmptyState>
    );
  }

  if (tools.length === 0) {
    return (
      <EmptyState icon={PackageOpen} title="The shelf is empty for now">
        <p className="text-muted-foreground text-sm">
          Sign in and be the first to lend something.
        </p>
      </EmptyState>
    );
  }

  return (
    <ul className={GRID}>
      {tools.map((tool, i) => (
        <li
          className="surface flex items-center gap-3 rounded-xl px-4 py-3"
          // The public query deliberately omits ids, so position is the key.
          key={`${i}-${tool.name}`}
        >
          <CategoryIcon category={tool.category} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{tool.name}</p>
            <p className="text-muted-foreground text-xs">
              {CATEGORY_LABELS[tool.category]}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
