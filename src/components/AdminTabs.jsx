import { NavLink } from 'react-router-dom';

export default function AdminTabs() {
  return (
    <div className="tabs">
      <NavLink to="/admin" end>Cars</NavLink>
      <NavLink to="/admin/bookings">Bookings</NavLink>
    </div>
  );
}
