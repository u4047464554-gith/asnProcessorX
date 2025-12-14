/**
 * Extract error message from various error formats (axios, Error, unknown)
 */
export const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Unknown error';
};

/**
 * Format error message from axios response or Error object
 */
export const formatErrorMessage = (err: unknown): string => {
  // Handle axios-style errors with response.data.detail
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;

    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (entry && typeof entry === 'object') {
            const location = Array.isArray(entry.loc) ? entry.loc.join('.') : entry.loc;
            return `${entry.type || 'Error'} at ${location}: ${entry.msg || entry.message || ''}`.trim();
          }
          return JSON.stringify(entry);
        })
        .join('\n');
    }
    if (detail && typeof detail === 'object') {
      return JSON.stringify(detail);
    }
  }

  return getErrorMessage(err);
};

/**
 * Log error with context for debugging
 */
export const logError = (context: string, err: unknown): void => {
  const message = formatErrorMessage(err);
  console.error(`[${context}] Error:`, message);

  // In development, log the full error object for debugging
  if (import.meta.env.DEV) {
    console.error(`[${context}] Full error:`, err);
  }
};








