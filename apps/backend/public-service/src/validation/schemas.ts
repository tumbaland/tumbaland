import { z } from 'zod';

// Log entries are intentionally schema-flexible (arbitrary fields from up to
// eight different frontends) — this only guards against non-object garbage,
// not against a fixed field set.
const logEntrySchema = z.record(z.string(), z.any());

export const submitLogsSchema = z.union([logEntrySchema, z.array(logEntrySchema)]);
