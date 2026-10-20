export async function message<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!globalThis.chrome?.runtime?.id) throw new Error('Load the built extension in Chrome or Edge to use this feature.');
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || 'Extension did not respond. Reload the extension and try again.');
  return response.data as T;
}
export function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> { return message('API', { path, method, body }); }
