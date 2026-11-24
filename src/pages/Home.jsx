import { useEffect, useMemo, useState } from 'react';
import CarCard from '../components/CarCard.jsx';
import { getCars } from '../lib/api';
import { countDays, quote, money, todayStr } from '../lib/pricing';

export default function Home() {
  const [cars, setCars] = useState(null);
  const [categories, setCategories] = useState(['All']);
  const [loadError, setLoadError] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('price-asc');
  const [maxPrice, setMaxPrice] = useState(150);

    const days = countDays(start, end);
  const dateSearch = start && end && days >= 1 && start >= todayStr();
  const dateError = start && end && !dateSearch;

  // Availability is decided by the server, so refetch when valid dates change.
  useEffect(() => {
    let stale = false;
    getCars(dateSearch ? { start, end } : {})
      .then((list) => {
        if (stale) return;
        setCars(list);
        setLoadError('');
        // Build the category chips from the first (unfiltered) load only.
        setCategories((prev) => (prev.length > 1 ? prev : ['All', ...new Set(list.map((c) => c.category))]));
      })
      .catch((e) => !stale && setLoadError(e.message));
    return () => { stale = true; };
  }, [dateSearch, start, end]);

  const visible = useMemo(() => {
    if (!cars) return [];
    const q = query.trim().toLowerCase();
    return cars
      .filter((c) => category === 'All' || c.category === category)
      .filter((c) => c.dailyRate <= maxPrice)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.features.some((f) => f.toLowerCase().includes(q)))
      .sort((a, b) =>
        sort === 'price-asc' ? a.dailyRate - b.dailyRate :
        sort === 'price-desc' ? b.dailyRate - a.dailyRate :
        b.seats - a.seats);
  }, [cars, category, query, sort, maxPrice]);

  return (
    <>
      <section className="hero">
        <h1>Find your ride</h1>
        <p>Compare daily and weekly rates, then book online in a minute.</p>
      </section>

      <section className="card dates">
        <label>Pick-up
          <input type="date" min={todayStr()} value={start}
            onChange={(e) => { setStart(e.target.value); if (end && e.target.value > end) setEnd(e.target.value); }} />
        </label>
        <label>Return
          <input type="date" min={start || todayStr()} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button className="btn secondary-btn" disabled={!start && !end} onClick={() => { setStart(''); setEnd(''); }}>Clear dates</button>
        <p className="muted small dates-note">
          {dateError ? <span className="error">Pick today or later, with return on/after pick-up.</span>
            : dateSearch ? `Showing cars available for ${days} day${days > 1 ? 's' : ''}.`
            : 'Pick dates to hide cars that are already booked.'}
        </p>
      </section>

      <section className="filters card">
        <input placeholder="Search by name or feature…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label>Max daily price: <strong>${maxPrice}</strong>
          <input type="range" min="30" max="150" step="5" value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="seats">Most seats</option>
        </select>
        <div className="chips">
          {categories.map((c) => (
            <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      </section>

      {loadError ? <p className="error">Couldn't load cars: {loadError}</p> : !cars ? <p>Loading…</p> : visible.length === 0 ? <p className="muted">{dateSearch ? 'No cars are available for those dates. Try different dates or filters.' : 'No cars match your filters.'}</p> : (
        <div className="grid">{visible.map((c) => <CarCard key={c.id} car={c} search={dateSearch ? `?start=${start}&end=${end}` : ''} priceLine={dateSearch ? money(quote(c, days).base) : null} />)}</div>
      )}
    </>
  );
}
