export interface FetchOptions {
  timeoutMs?: number;
  revalidateSeconds?: number;
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const { timeoutMs = 12000, revalidateSeconds } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      ...(typeof revalidateSeconds === "number"
        ? { next: { revalidate: revalidateSeconds } }
        : {}),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
