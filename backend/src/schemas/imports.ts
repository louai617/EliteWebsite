import { z } from "zod";
import { ExternalSource, ImportRecordStatus } from "@/generated/prisma/enums";

const agentId = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.cuid().nullable());

/**
 * POST /api/integrations/<source>
 *  - with `records`: imports those raw portal records (JSON export / webhook body)
 *  - without: fetches the configured remote feed
 */
export const importRequestSchema = z.object({
  records: z.array(z.unknown()).max(5000).optional(),
  dryRun: z.boolean().default(false),
  defaultAgentId: agentId.optional(),
});

/** Server Action: a JSON file's text from the import page. */
export const importUploadSchema = z.object({
  source: z.enum(ExternalSource),
  payload: z.string().max(9 * 1024 * 1024, "File is too large (max 9 MB)").optional(),
  remote: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  defaultAgentId: agentId.optional(),
});
export type ImportUploadInput = z.input<typeof importUploadSchema>;

export const importRunsQuery = z.object({
  source: z.enum(ExternalSource).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const importRunQuery = z.object({ status: z.enum(ImportRecordStatus).optional() });
