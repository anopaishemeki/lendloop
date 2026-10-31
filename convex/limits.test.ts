import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addDays, todayUtc } from "./lib/dates";
import { LIMITS } from "./lib/limits";
import { identityFor, newTest } from "./test.setup";

const day = (offset: number) => addDays(todayUtc(), offset);
const { borrowRequest, newListing, ownerRequests } = LIMITS;

const ladder = {
  category: "other" as const,
  condition: "good" as const,
  description: "",
  name: "Ladder",
};

afterEach(() => {
  vi.useRealTimers();
});

async function setup() {
  const t = newTest();
  const as = async (subject: string, role?: "admin") => {
    const caller = t.withIdentity(identityFor(subject, role));
    await caller.mutation(api.users.syncCurrentUser, {});
    return caller;
  };
  const owner = await as("olive");
  const toolId = await owner.mutation(api.tools.create, ladder);
  return { as, toolId };
}

type Caller = Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["as"]>>;

/** A one-day request; distinct offsets never overlap. */
function request(caller: Caller, toolId: Id<"tools">, offset: number) {
  return caller.mutation(api.loans.request, {
    endDate: day(offset),
    startDate: day(offset),
    toolId,
  });
}

const rateLimited = expect.objectContaining({
  data: expect.objectContaining({ code: "RATE_LIMITED" }),
});

describe("borrow request limits", () => {
  test("allow a burst per borrower, then refuse until tokens refill", async () => {
    vi.useFakeTimers();
    const { as, toolId } = await setup();
    const ben = await as("ben");
    for (let i = 1; i <= borrowRequest.capacity; i += 1) {
      await request(ben, toolId, i);
    }
    await expect(request(ben, toolId, 99)).rejects.toThrow(
      /lot of borrow requests recently\. Try again in \d+ min/u
    );

    // Limits are per neighbor.
    const otto = await as("otto");
    await expect(request(otto, toolId, 1)).resolves.toBeDefined();

    // One token refills every period / rate.
    vi.advanceTimersByTime(borrowRequest.period / borrowRequest.rate);
    await expect(request(ben, toolId, 99)).resolves.toBeDefined();
  });

  test("cap the requests one owner receives across borrowers", async () => {
    const { as, toolId } = await setup();
    const perBorrower = borrowRequest.capacity;
    let offset = 0;
    for (let b = 0; offset < ownerRequests.capacity; b += 1) {
      const borrower = await as(`borrower${b}`);
      for (
        let i = 0;
        i < perBorrower && offset < ownerRequests.capacity;
        i += 1
      ) {
        offset += 1;
        await request(borrower, toolId, offset);
      }
    }
    const late = await as("late");
    await expect(request(late, toolId, 99)).rejects.toThrow(
      /This lender has had a lot of requests/u
    );
  });

  test("an invalid request gets its own error and uses no token", async () => {
    const { as, toolId } = await setup();
    const ben = await as("ben");
    const ownTool = await ben.mutation(api.tools.create, ladder);
    for (let i = 0; i <= borrowRequest.capacity; i += 1) {
      await expect(request(ben, ownTool, 1)).rejects.toThrow(/own tool/u);
    }
    await expect(request(ben, toolId, 1)).resolves.toBeDefined();
  });
});

describe("new listing limit", () => {
  test("allows a burst of listings, then refuses; admins are exempt", async () => {
    const { as } = await setup();
    const ben = await as("ben");
    const root = await as("root", "admin");
    for (let i = 0; i < newListing.capacity; i += 1) {
      await ben.mutation(api.tools.create, ladder);
      await root.mutation(api.tools.create, ladder);
    }
    await expect(ben.mutation(api.tools.create, ladder)).rejects.toEqual(
      rateLimited
    );
    await expect(
      root.mutation(api.tools.create, ladder)
    ).resolves.toBeDefined();
  });
});
