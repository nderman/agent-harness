import { z } from 'zod';

/**
 * Derive an Anthropic tool `input_schema` from a zod schema, so the schema the
 * model is shown and the schema Gate 1 validates against can never drift apart.
 * `$schema` is stripped — Anthropic's input_schema is a bare object schema.
 */
export function toInputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json['$schema'];
  return json;
}

/**
 * Render a zod validation failure as the single-line, field-pathed string that
 * gets fed back to the model as a re-prompt. Shared so every Gate 1 failure —
 * tool args and the terminal `resolve` alike — reads the same and keeps the path.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}
