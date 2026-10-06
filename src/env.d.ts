/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts once a request passes admin session verification. Id is a Supabase Auth UUID as of Phase 2B.3, not an app-generated integer. */
    admin?: {
      id: string;
      email: string;
    };
    /** Set only on /admin/mfa for an approved admin who has passed the password step (aal1) but not yet the second factor. */
    pendingAdmin?: {
      id: string;
      email: string;
      hasVerifiedFactor: boolean;
    };
  }
}
