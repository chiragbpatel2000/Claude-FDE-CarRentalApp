// Data access layer: talks to the Express API (proxied at /api in dev).
// The session lives in an httpOnly cookie, so there is no token handling here.

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed.');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Auth
export const getMe = () => request('/auth/me').then((d) => d.user);
export const register = (body) => request('/auth/register', { method: 'POST', body }).then((d) => d.user);
export const login = (body) => request('/auth/login', { method: 'POST', body }).then((d) => d.user);
export const logout = () => request('/auth/logout', { method: 'POST' });

// Cars (pass { start, end } to only get cars free for those dates)
export function getCars({ start, end } = {}) {
  const q = start && end ? `?start=${start}&end=${end}` : '';
  return request(`/cars${q}`).then((d) => d.cars);
}
export const getCar = (id) => request(`/cars/${id}`).then((d) => d.car);

// Bookings (require login)
export const getBookings = () => request('/bookings').then((d) => d.bookings);
export const createBooking = (body) => request('/bookings', { method: 'POST', body }).then((d) => d.booking);
export const cancelBooking = (id) => request(`/bookings/${id}/cancel`, { method: 'POST' });

// Client-side check against the booked ranges returned with a car (UX only; the server re-checks).
export const isRangeFree = (ranges, start, end) => !ranges.some((r) => start <= r.endDate && end >= r.startDate);

// Admin (require an admin session)
export const adminGetCars = () => request('/admin/cars').then((d) => d.cars);
export const adminCreateCar = (body) => request('/admin/cars', { method: 'POST', body }).then((d) => d.car);
export const adminUpdateCar = (id, body) => request(`/admin/cars/${id}`, { method: 'PUT', body }).then((d) => d.car);
export const adminDeleteCar = (id) => request(`/admin/cars/${id}`, { method: 'DELETE' });
export const adminGetBookings = () => request('/admin/bookings').then((d) => d.bookings);
export const adminCancelBooking = (id) => request(`/admin/bookings/${id}/cancel`, { method: 'POST' });
