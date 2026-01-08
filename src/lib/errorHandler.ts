import { toast } from "sonner";

export interface AppError {
  message: string;
  originalError?: any;
}

/**
 * Standardized error handler.
 * Logs error to console with context and shows a user-friendly Toast.
 */
export const handleError = (error: any, context: string = "Operation failed"): AppError => {
  // 1. Log the full error for debugging
  console.error(`[${context}] Error:`, error);

  let userMessage = "An unexpected error occurred. Please try again.";

  // 2. Map Supabase/Postgres error codes to human-readable messages
  if (error?.code) {
    switch (error.code) {
      case "23505": // Unique violation
        userMessage = "This record already exists. duplicates are not allowed.";
        break;
      case "23503": // Foreign key violation
        userMessage = "Cannot perform this action because this record is linked to other data.";
        break;
      case "PGRST116": // Row not found
        userMessage = "The requested record could not be found.";
        break;
      case "42501": // RLS policy violation
        userMessage = "You do not have permission to perform this action.";
        break;
      case "23502": // Not null violation
        userMessage = "A required field is missing.";
        break;
      default:
        // Fallback to the server message if available, else generic
        userMessage = error.message || userMessage;
    }
  } else if (error instanceof Error) {
    userMessage = error.message;
  }

  // 3. Show the Toast
  toast.error(userMessage);

  return {
    message: userMessage,
    originalError: error,
  };
};