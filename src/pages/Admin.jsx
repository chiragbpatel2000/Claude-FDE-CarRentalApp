import { useEffect, useState } from 'react';
import { adminCreateCar, adminDeleteCar, adminGetCars, adminUpdateCar } from '../lib/api';
import { money } from '../lib/pricing';
import AdminTabs from '../components/AdminTabs.jsx';

const EMPTY = {
  name: '', category: '', image: '', emoji: '🚗', color: '#4f8cff', seats: 5, transmission: 'Automatic',
  fuel: 'Petrol', mpg: 30, bags: 2, dailyRate: '', weeklyRate: '', featuresText: '', active: true,
};

const toForm = (c) => ({ ...c, image: c.image || '', featuresText: c.features.join('\n') });

function toPayload(f) {
  return {
    ...f,
    seats: Number(f.seats), mpg: Number(f.mpg), bags: Number(f.bags),
    dailyRate: Number(f.dailyRate), weeklyRate: Number(f.weeklyRate),
    features: f.featuresText.split('\n').map((s) => s.trim()).filter(Boolean),
  };
}

export default function Admin() {
  const [cars, setCars] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, { id?, ...form }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => adminGetCars().then(setCars).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = toPayload(editing);
      if (editing.id) await adminUpdateCar(editing.id, payload);
      else await adminCreateCar(payload);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(car) {
    const verb = car.active ? 'Deactivate' : 'Activate';
    const warn = car.active && car.upcomingBookings
      ? ` It has ${car.upcomingBookings} upcoming booking(s); they stay valid but no new bookings can be made.` : '';
    if (!confirm(`${verb} ${car.name}?${warn}`)) return;
    try {
      await adminUpdateCar(car.id, { ...toPayload(toForm(car)), active: !car.active });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(car) {
    if (!confirm(`Permanently delete ${car.name}? This cannot be undone.`)) return;
    try {
      await adminDeleteCar(car.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!cars) return error ? <p className="error">{error}</p> : <p>Loading…</p>;

  return (
    <>
      <AdminTabs />
      <div className="row between">
        <h1>Manage cars</h1>
        <button className="btn" onClick={() => { setError(''); setEditing({ ...EMPTY }); }}>+ Add car</button>
      </div>
      {error && !editing && <p className="error">{error}</p>}

      <div className="card table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Car</th><th>Category</th><th>Daily</th><th>Weekly</th><th>Upcoming</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {cars.map((c) => (
              <tr key={c.id} className={c.active ? '' : 'inactive'}>
                <td className="car-cell">
                  {c.image ? <img src={c.image} alt="" /> : <span className="thumb-emoji">{c.emoji}</span>}
                  {c.name}
                </td>
                <td>{c.category}</td>
                <td>{money(c.dailyRate)}</td>
                <td>{money(c.weeklyRate)}</td>
                <td>{c.upcomingBookings}</td>
                <td><span className={`status ${c.active ? 'confirmed' : 'cancelled'}`}>{c.active ? 'active' : 'inactive'}</span></td>
                <td className="actions">
                  <button className="linkbtn" onClick={() => { setError(''); setEditing(toForm(c)); }}>Edit</button>
                  <button className="linkbtn" onClick={() => toggleActive(c)}>{c.active ? 'Deactivate' : 'Activate'}</button>
                  <button className="linkbtn danger" onClick={() => remove(c)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{editing.id ? `Edit ${editing.name || 'car'}` : 'Add car'}</h2>
            <div className="form-grid">
              <label className="span2">Name<input value={editing.name} onChange={set('name')} required /></label>
              <label>Category
                <input list="cats" value={editing.category} onChange={set('category')} required />
                <datalist id="cats">{[...new Set(cars.map((c) => c.category))].map((c) => <option key={c} value={c} />)}</datalist>
              </label>
              <label>Seats<input type="number" min="1" max="12" value={editing.seats} onChange={set('seats')} required /></label>
              <label>Transmission
                <select value={editing.transmission} onChange={set('transmission')}>
                  <option>Automatic</option><option>Manual</option>
                </select>
              </label>
              <label>Fuel
                <select value={editing.fuel} onChange={set('fuel')}>
                  <option>Petrol</option><option>Diesel</option><option>Hybrid</option><option>Electric</option>
                </select>
              </label>
              <label>MPG<input type="number" min="0" max="500" value={editing.mpg} onChange={set('mpg')} required /></label>
              <label>Bags<input type="number" min="0" max="20" value={editing.bags} onChange={set('bags')} required /></label>
              <label>Daily rate ($)<input type="number" min="1" step="0.01" value={editing.dailyRate} onChange={set('dailyRate')} required /></label>
              <label>Weekly rate ($)<input type="number" min="1" step="0.01" value={editing.weeklyRate} onChange={set('weeklyRate')} required /></label>
              <label className="span2">Image URL or path
                <input value={editing.image} onChange={set('image')} placeholder="/cars/1.jpg or https://…" />
                <span className="muted small">Leave empty to show the emoji on a coloured background.</span>
              </label>
              <label>Emoji<input value={editing.emoji} onChange={set('emoji')} maxLength={8} /></label>
              <label>Fallback colour<input type="color" value={editing.color} onChange={set('color')} /></label>
              <label className="span2">Features (one per line)
                <textarea rows="4" value={editing.featuresText} onChange={set('featuresText')} />
              </label>
              <label className="check span2">
                <input type="checkbox" checked={editing.active} onChange={set('active')} />
                Active (visible to customers and bookable)
              </label>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row end">
              <button type="button" className="btn secondary-btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
