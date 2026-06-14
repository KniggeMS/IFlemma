/**
 * Helpers for shaping MCP tool responses.
 *
 * Every tool returns markdown text (for human-readable display) AND, where it
 * carries structured data, a `structuredContent` payload (for clients that
 * consume the tool's `outputSchema`). Pagination metadata lets read tools
 * advertise whether more results are available beyond the current page.
 */

export type ResponseFormat = "markdown" | "json";

export interface PaginationMeta {
  has_more: boolean;
  next_offset: number | null;
}

/** A single MCP text content block. */
export interface TextContent {
  type: "text";
  text: string;
}

/**
 * Compute has_more + next_offset from a total count, page size, and current offset.
 * Returns next_offset:null when there is no further page (so callers can omit it).
 */
export function paginationMeta(total: number, limit: number, offset: number): PaginationMeta {
  const has_more = offset + limit < total;
  return {
    has_more,
    next_offset: has_more ? offset + limit : null,
  };
}

export function textContent(text: string): TextContent {
  return { type: "text", text };
}

/**
 * Build a ToolResult-shaped object carrying both a markdown representation and
 * the structured data a client can parse against the tool's outputSchema.
 *
 * Pass `text` for the human/markdown view and `data` for the structured view.
 * When `format` is "json", the text body is the JSON-encoded data (useful when a
 * caller explicitly requests a machine-readable response).
 */
export function buildResult(opts: {
  text: string;
  data?: unknown;
  format?: ResponseFormat;
  isError?: boolean;
}): {
  content: TextContent[];
  structuredContent?: unknown;
  isError?: boolean;
} {
  const text = opts.format === "json" && opts.data !== undefined
    ? JSON.stringify(opts.data, null, 2)
    : opts.text;
  const result: {
    content: TextContent[];
    structuredContent?: unknown;
    isError?: boolean;
  } = {
    content: [{ type: "text", text }],
  };
  if (opts.data !== undefined) {
    result.structuredContent = opts.data;
  }
  if (opts.isError) {
    result.isError = true;
  }
  return result;
}
