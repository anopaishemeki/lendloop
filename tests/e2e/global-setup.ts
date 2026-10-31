import { createClerkClient } from "@clerk/backend";
import { clerkSetup } from "@clerk/testing/playwright";
import { E2E_USERS } from "./users";

/**
 * Fetches a Clerk testing token (reads .env.local or the environment) and
 * makes sure the test users exist, with the admin role only on the admin.
 */
export default async function globalSetup() {
  await clerkSetup();
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const users = Object.values(E2E_USERS);
  const { data: existing } = await clerk.users.getUserList({
    emailAddress: users.map((user) => user.email),
  });
  await Promise.all(
    users.map(async (user) => {
      // null clears a role Clerk would otherwise keep (metadata updates merge).
      const role = user.admin ? "admin" : null;
      const found = existing.find((candidate) =>
        candidate.emailAddresses.some((e) => e.emailAddress === user.email)
      );
      if (!found) {
        await clerk.users.createUser({
          emailAddress: [user.email],
          firstName: user.firstName,
          lastName: "Tester",
          publicMetadata: role ? { role } : {},
          skipPasswordRequirement: true,
        });
      } else if ((found.publicMetadata.role ?? null) !== role) {
        await clerk.users.updateUserMetadata(found.id, {
          publicMetadata: { role },
        });
      }
    })
  );
}
