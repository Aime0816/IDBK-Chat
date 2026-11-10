export let csrf = '';
export function setCsrf(value: string) {
  csrf = value;
}
export async function api(path: string, options: RequestInit = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch('/api/v1' + path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(!isForm ? { 'Content-Type': 'application/json' } : {}),
      'x-csrf-token': csrf,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({ error: 'Unexpected response' }));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const post = (path: string, data: any = {}) =>
  api(path, { method: 'POST', body: JSON.stringify(data) });
export const put = (path: string, data: any) =>
  api(path, { method: 'PUT', body: JSON.stringify(data) });
export const patch = (path: string, data: any) =>
  api(path, { method: 'PATCH', body: JSON.stringify(data) });
export function refresh() {
  window.dispatchEvent(new Event('idbk-refresh'));
}
