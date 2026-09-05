// Redirects to the admin login page when a fetch response indicates the
// session has expired. Returns true if it redirected, so callers can bail out.
export function redirectIfUnauthorized(res) {
  if (res.status === 401) {
    window.location.href = '/admin/login';
    return true;
  }
  return false;
}
