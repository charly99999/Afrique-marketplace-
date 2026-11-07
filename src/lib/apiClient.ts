/**
 * Resilient API Client with strict Content-Type inspection
 * Prevents "Unexpected token 'T', "The page c"... is not valid JSON" errors
 * caused by static hosting 404 text/plain responses (e.g., Vercel / Cloudflare).
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  isHtmlOr404?: boolean;
  rawText?: string;
}

/**
 * Safely fetches an API endpoint and strictly validates Content-Type
 * before attempting JSON deserialization.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(input, init);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    // Check if the server explicitly returned JSON
    if (contentType.includes('application/json') || contentType.includes('+json')) {
      try {
        const json = (await res.json()) as T;
        return {
          ok: res.ok,
          status: res.status,
          data: json,
          error: !res.ok
            ? ((json as any)?.message || `Erreur serveur HTTP ${res.status}`)
            : undefined,
          isHtmlOr404: false,
        };
      } catch (parseErr: any) {
        console.warn('[ApiClient] Failed parsing JSON from JSON content-type:', parseErr);
        return {
          ok: false,
          status: res.status,
          error: `Erreur de format de réponse du serveur (${res.status}).`,
          isHtmlOr404: false,
        };
      }
    }

    // Non-JSON response (e.g. 404 "The page could not be found" on Vercel, HTML error page, 502 Bad Gateway)
    let text = '';
    try {
      text = await res.text();
    } catch {
      // ignore text read failure
    }

    const is404 =
      res.status === 404 ||
      text.includes('NOT_FOUND') ||
      text.includes('could not be found') ||
      text.includes('Cannot POST') ||
      text.includes('Cannot GET');

    console.warn('[ApiClient] Non-JSON response received:', {
      url: typeof input === 'string' ? input : (input as any)?.url || 'unknown',
      status: res.status,
      contentType,
      bodyPreview: text.slice(0, 120),
    });

    return {
      ok: false,
      status: res.status,
      isHtmlOr404: true,
      rawText: text,
      error: is404
        ? 'Service backend temporairement inaccessible (Code 404).'
        : `Erreur serveur (${res.status}) : Réponse non reconnue.`,
    };
  } catch (networkErr: any) {
    console.warn('[ApiClient] Network error during fetch:', networkErr);
    return {
      ok: false,
      status: 0,
      isHtmlOr404: false,
      error: networkErr?.message?.includes('Failed to fetch')
        ? 'Impossible de contacter le serveur. Vérifiez votre connexion Internet.'
        : (networkErr?.message || 'Erreur réseau inconnue.'),
    };
  }
}
