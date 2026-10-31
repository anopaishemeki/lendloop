/**
 * Dedicated Clerk users for the end-to-end tests, created on first run by
 * global-setup.ts. Their addresses are Resend's test inbox, so the emails the
 * tests trigger are accepted without reaching a real person.
 */
export const E2E_USERS = {
  admin: {
    admin: true,
    email: "delivered+lendloop-e2e-admin@resend.dev",
    firstName: "Ada",
  },
  borrower: {
    admin: false,
    email: "delivered+lendloop-e2e-borrower@resend.dev",
    firstName: "Bo",
  },
  lender: {
    admin: false,
    email: "delivered+lendloop-e2e-lender@resend.dev",
    firstName: "Lee",
  },
} as const;

export type E2EUser = keyof typeof E2E_USERS;
