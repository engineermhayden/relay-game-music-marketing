let csrfToken = '';
export function setCsrf(value: string) { csrfToken = value; }
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(body === undefined ? {} : { 'X-CSRFToken': csrfToken }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(35000) });
  const data = await response.json().catch(() => ({detail: 'Server unavailable. Start Docker Compose to connect.'}));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : Array.isArray(data) ? data.join(' ') : 'Request failed. Please try again.');
  return data as T;
}
