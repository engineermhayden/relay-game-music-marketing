let csrfToken = '';
export function setCsrf(value: string) { csrfToken = value; }
// Send the token matching the cookie Django compares against. Concurrent first requests in a
// new browser can each issue a token, so the last response body is not always the cookie's.
function csrfHeader() { const cookie = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/); return cookie ? decodeURIComponent(cookie[1]) : csrfToken; }
/** Carries the HTTP status and response body for callers that react to specific errors. */
export class ApiError extends Error { constructor(message: string, readonly status: number, readonly data: unknown) { super(message); } }
function send(path: string, body?: unknown) {
  return fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(body === undefined ? {} : { 'X-CSRFToken': csrfHeader() }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(35000) });
}
const readJson = (response: Response) => response.json().catch(() => ({detail: 'Server unavailable. Start Docker Compose to connect.'}));
function failure(response: Response, data: any) {
  return new ApiError(typeof data.detail === 'string' ? data.detail : Array.isArray(data) ? data.join(' ') : 'Request failed. Please try again.', response.status, data);
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await send(path, body);
  const data = await readJson(response);
  if (!response.ok) throw failure(response, data);
  return data as T;
}
/** Like api(), but returns the response as a file named by the server, for downloads such as the data export. */
export async function apiFile(path: string, body?: unknown): Promise<{ blob: Blob; filename: string }> {
  const response = await send(path, body);
  if (!response.ok) throw failure(response, await readJson(response));
  const filename = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'relay-download';
  return { blob: await response.blob(), filename };
}
