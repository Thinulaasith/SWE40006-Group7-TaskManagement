let csrf = '';
export const setCsrf = value => { csrf = value || ''; };
export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch('/api' + path, { credentials: 'same-origin', ...options,
      headers: { 'Content-Type': 'application/json', 'X-Taskflow-Request': '1', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...options.headers }
    });
  } catch { throw new Error('Cannot reach the server. Check your connection and try again.'); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || `Request failed (${response.status}). Please try again.`);
    error.status = response.status;
    if (response.status === 401 && !['/auth/login','/auth/register','/auth/me'].includes(path)) window.dispatchEvent(new Event('session-expired'));
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
export const json = (method, body) => ({ method, body: JSON.stringify(body) });
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
