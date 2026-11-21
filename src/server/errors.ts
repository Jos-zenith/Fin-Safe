/** An expected, user-facing failure with an HTTP status and a short code (never a message that could echo content). */
export class WorkflowError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
