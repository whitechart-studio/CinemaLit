/** Authenticated fetch wrapper — attaches JWT from localStorage. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = localStorage.getItem('cinemalit_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  const response = await fetch(path, { ...options, headers });
  
  if (response.status === 401) {
    // Token is invalid or expired
    localStorage.removeItem('cinemalit_user');
    localStorage.removeItem('cinemalit_token');
    window.location.reload();
  }
  
  return response;
}
