import { z } from 'zod';
import { toInputSchema } from './json-schema';

/**
 * The agent's structured output. Obtained via tool-forcing (DESIGN Decision 7):
 * the agent finishes by calling `resolve`, so the final answer is just another
 * validated tool call — guardrailable and trace-visible like the rest.
 */
export const Resolution = z.object({
  action: z.enum(['refunded', 'answered', 'escalated']),
  /** Customer-facing reply. */
  message: z.string().min(1),
  /** Durable handles produced during the run — refund ids, ticket ids, payment ids. */
  references: z.array(z.string()),
});

export type Resolution = z.infer<typeof Resolution>;
export type ResolutionAction = Resolution['action'];

export const RESOLVE_TOOL_NAME = 'resolve';

/** The terminal tool the model must call to finish. */
export const RESOLVE_TOOL = {
  name: RESOLVE_TOOL_NAME,
  description:
    'Finish the interaction. Call this exactly once as your final action, summarising what you did for the customer.',
  inputSchema: toInputSchema(Resolution),
} as const;
