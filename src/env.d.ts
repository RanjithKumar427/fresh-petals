/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts once a request passes admin session verification. */
    admin?: {
      id: number;
      email: string;
    };
  }
}
