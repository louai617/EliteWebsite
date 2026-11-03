"use server";

import { authedAction } from "@/lib/action";
import { invalid } from "@/lib/errors";
import { importUploadSchema } from "@/schemas/imports";
import { runImport } from "@/services/imports";
import { unwrapListings } from "@/integrations/remote";
import { ListingError } from "@/integrations/types";

/** Import page: an uploaded JSON export, or "Fetch from feed" when a feed URL is configured. */
export const runImportAction = authedAction(importUploadSchema, async (input, user) => {
  let records: unknown[] | null = null;
  if (!input.remote) {
    if (!input.payload) throw invalid("Choose a JSON file to import.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.payload);
    } catch {
      throw invalid("The file is not valid JSON.");
    }
    try {
      records = unwrapListings(parsed);
    } catch (error) {
      throw invalid(error instanceof ListingError ? error.message : "Couldn't read listings from the file.");
    }
  }
  const run = await runImport(user, input.source, records, { dryRun: input.dryRun, defaultAgentId: input.defaultAgentId ?? null, trigger: input.remote ? "remote" : "upload" });
  return { id: run.id, status: run.status, created: run.created, updated: run.updated, failed: run.failed };
});
