import { toast } from "sonner";

export interface AppError {
  message: string;
  code?: string;
  originalError?: unknown;
}

/** Shape of a Supabase/PostgREST error; not all fields are always present. */
interface SupabaseLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const asSupabaseError = (error: unknown): SupabaseLikeError | null =>
  typeof error === "object" && error !== null ? (error as SupabaseLikeError) : null;

/**
 * Standardized error handler: logs the full error with context, maps known
 * Postgres/PostgREST codes to messages a coach can act on, and shows a toast.
 *
 * Use this instead of a hardcoded `toast.error("Failed to X")`. Generic strings
 * make an RLS rejection, a missing column and a constraint violation look
 * identical, which is what made several bugs in AUDIT_FINDINGS.md so hard to
 * diagnose — most notably §2.1, where every group insert failed with PGRST204 for
 * weeks while the UI only ever said "Failed to create group".
 */
export const handleError = (error: unknown, context: string = "Operation failed"): AppError => {
  // 1. Always log the raw error with context — this is what makes a bug reportable.
  console.error(`[${context}] Error:`, error);

  const supabaseError = asSupabaseError(error);
  const code = supabaseError?.code;
  let userMessage = "An unexpected error occurred. Please try again.";

  // 2. Map Supabase/Postgres error codes to human-readable messages
  if (code) {
    switch (code) {
      case "23505": // Unique violation
        userMessage = "That already exists. Duplicates aren't allowed.";
        break;
      case "23503": // Foreign key violation
        userMessage = "This is still linked to other records, so it can't be changed or removed.";
        break;
      case "PGRST116": // No rows returned where one was required
        userMessage = "That record could not be found.";
        break;
      case "42501": // RLS policy violation
        userMessage = "You don't have permission to do that.";
        break;
      case "23502": // Not null violation
        userMessage = "A required field is missing.";
        break;
      case "PGRST204": // Column missing from PostgREST's schema cache
        // Nearly always a code/schema mismatch rather than anything the coach did.
        userMessage =
          "The app tried to save a field the database doesn't have. This is a bug — please report it.";
        break;
      case "42P17": // Infinite recursion detected in policy
        userMessage =
          "A database permission rule is misconfigured. This is a bug — please report it.";
        break;
      default:
        userMessage = supabaseError?.message || userMessage;
    }
  } else if (error instanceof Error) {
    userMessage = error.message;
  }

  // 3. Show the Toast
  toast.error(userMessage);

  return { message: userMessage, code, originalError: error };
};