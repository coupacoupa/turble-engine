/**
 * Parse user-entered JSON that must be a flat object of key-value pairs
 * (e.g. sub-workflow input/output mappings). Returns an explicit error
 * instead of throwing so edit sites can render inline validation and block
 * save while invalid (AGENTS.md §2 No-Fallback Policy, §8 Persistence Hygiene).
 */
export interface JsonRecordParseResult {
  value?: Record<string, string>;
  error?: string;
}

export function parseJsonRecord(text: string): JsonRecordParseResult {
  try {
    const parsed = JSON.parse(text);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { error: "Must be a JSON object of key-value pairs" };
    }
    return { value: parsed };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Invalid JSON syntax",
    };
  }
}
