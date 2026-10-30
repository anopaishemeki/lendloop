import { describe, expect, test } from "vitest";
import {
  canAccessRoute,
  isAdminRoute,
  isPublicRoute,
} from "../../src/lib/route-access";

describe("isPublicRoute", () => {
  test.each([
    ["/", true],
    ["/sign-in", true],
    ["/sign-in/factor-one", true],
    ["/sign-up", true],
    ["/tools", false],
    ["/sign-inside", false],
    ["/admin", false],
  ])("%s -> %s", (path, expected) => {
    expect(isPublicRoute(path)).toBe(expected);
  });
});

describe("admin routes", () => {
  test("matches /admin and nested paths only", () => {
    expect(isAdminRoute("/admin")).toBe(true);
    expect(isAdminRoute("/admin/loans")).toBe(true);
    expect(isAdminRoute("/administrator")).toBe(false);
  });

  test("only the admin role may open them", () => {
    expect(canAccessRoute("/admin", "admin")).toBe(true);
    expect(canAccessRoute("/admin", undefined)).toBe(false);
    expect(canAccessRoute("/admin", "Admin")).toBe(false);
    expect(canAccessRoute("/tools", undefined)).toBe(true);
  });
});
