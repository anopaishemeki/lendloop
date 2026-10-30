import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type ToolView = FunctionReturnType<typeof api.tools.list>[number];
