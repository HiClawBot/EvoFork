const defaultApiUrl = "http://127.0.0.1:3333";

export type ForwardApiResponse = {
  status: number;
  body: unknown;
};

export async function forwardApiRequest(
  path: string,
  body: unknown,
  options: { fallback?: unknown } = {}
): Promise<ForwardApiResponse> {
  const apiUrl = process.env.EVOFORK_API_URL ?? defaultApiUrl;

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    return {
      status: response.status,
      body: await response.json()
    };
  } catch (error) {
    return {
      status: options.fallback ? 200 : 202,
      body:
        options.fallback ??
        {
          ok: false,
          error: normalizeError(error).message,
          acceptedLocally: true
        }
    };
  }
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
