// Supabase Storage implementation of the StorageService interface — see
// StorageService.ts for the contract every driver (this one, and
// LocalStorageProvider before it) satisfies identically. MediaService and
// everything above it never import this file directly; only
// storage/index.ts's factory does.
//
// Uses the service-role key exclusively, never the publishable/anon key —
// every write (put/delete/move) is an admin-only operation performed
// server-side, same trust boundary as every Postgres write this project
// makes. The bucket itself is public *read* (so storefront/admin <img>
// tags load without a signed URL or an extra auth round trip), which is
// the same effective access shape LocalStorageProvider always had (files
// under /uploads were served statically, unauthenticated, by design).
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { StorageService, StoredFile } from "./StorageService";

const BUCKET = "media";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Storage cannot operate without them."
    );
  }
  // No session persistence needed — this is a short-lived server-side
  // client constructed per call, not a browser client with a user session
  // to remember. Disabling auto-refresh avoids background timers in a
  // request-scoped context that has no business keeping one alive.
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function safeExtension(filename: string): string {
  const match = filename.match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : "";
}

export const SupabaseStorageProvider: StorageService = {
  async put({ buffer, filename, mimeType, folder }): Promise<StoredFile> {
    const generatedName = `${randomUUID()}${safeExtension(filename)}`;
    const objectPath = `${folder}/${generatedName}`;

    const client = getClient();
    const { error } = await client.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: mimeType,
      upsert: false, // generated names are unique — a collision means something is wrong, not something to overwrite silently
    });
    if (error) throw error;

    const { data } = client.storage.from(BUCKET).getPublicUrl(objectPath);
    return { path: objectPath, url: data.publicUrl, sizeBytes: buffer.byteLength };
  },

  async delete(objectPath: string): Promise<void> {
    const client = getClient();
    const { error } = await client.storage.from(BUCKET).remove([objectPath]);
    // Deleting an already-gone object isn't a failure worth surfacing —
    // matches LocalStorageProvider's fs.rm({ force: true }) semantics
    // (best-effort, idempotent). Any other error still throws.
    if (error && !/not.?found/i.test(error.message)) throw error;
  },

  async move(objectPath: string, toFolder): Promise<StoredFile> {
    const filename = objectPath.split("/").pop()!;
    const newPath = `${toFolder}/${filename}`;

    const client = getClient();
    const { error } = await client.storage.from(BUCKET).move(objectPath, newPath);
    if (error) throw error;

    const { data } = client.storage.from(BUCKET).getPublicUrl(newPath);
    // Supabase Storage's `move` API doesn't return the object's size, and
    // MediaService.move()'s caller doesn't currently use sizeBytes from a
    // move result (only from put()) — 0 here is an honest "not provided by
    // this operation" rather than a real fetched value, not a bug: the DB
    // row's existing size_bytes is left untouched by MediaRepository.updateLocation,
    // which only ever writes folder/path/url.
    return { path: newPath, url: data.publicUrl, sizeBytes: 0 };
  },
};
