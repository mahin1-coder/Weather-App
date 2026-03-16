export function reportServerError(context: string, error: unknown): void {
  console.error(`[server:${context}]`, error);
}

export function reportClientError(context: string, error: unknown): void {
  console.error(`[client:${context}]`, error);
}
