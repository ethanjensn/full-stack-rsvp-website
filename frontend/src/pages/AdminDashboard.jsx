import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminSession, getRsvps, deleteRsvp, logoutAdmin } from "../api";

function AdminDashboard({ adminPath }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rsvps, setRsvps] = useState([]);
  const [totals, setTotals] = useState({});
  const [csrfToken, setCsrfToken] = useState("");
  const [error, setError] = useState("");
  const observersRef = useRef([]);

  useEffect(() => {
    async function init() {
      const session = await getAdminSession();
      if (!session.data?.authenticated) {
        navigate(`/${adminPath}/login`);
        return;
      }
      setCsrfToken(session.data.csrf);
      await loadRsvps();
      setLoading(false);
    }
    init();
  }, [navigate, adminPath]);

  useEffect(() => {
    function staggerTableRows() {
      const rows = document.querySelectorAll("[data-row-index]");
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target)
          .sort(
            (a, b) =>
              Number(a.dataset.rowIndex) - Number(b.dataset.rowIndex)
          );
        visible.forEach((row, index) => {
          setTimeout(() => row.classList.add("is-visible"), index * 100);
        });
      }, { threshold: 0 });

      rows.forEach((row) => observer.observe(row));
      observersRef.current.push(observer);
    }

    function triggerAnimations() {
      const animatedElements = document.querySelectorAll(
        ".admin-title, table thead"
      );
      animatedElements.forEach((el) => {
        el.style.animation = "none";
        void el.offsetHeight;
        el.style.animation = null;
      });
    }

    if (!loading) {
      staggerTableRows();
      triggerAnimations();
    }

    return () => {
      observersRef.current.forEach((o) => o.disconnect());
      observersRef.current = [];
    };
  }, [loading, rsvps]);

  async function loadRsvps() {
    const result = await getRsvps();
    if (result.ok && result.data) {
      setRsvps(result.data.rsvps || []);
      setTotals({
        total_rsvps: result.data.total_rsvps || 0,
        total_yes: result.data.total_yes || 0,
        total_no: result.data.total_no || 0,
        total_guests: result.data.total_guests || 0,
        total_no_guests: result.data.total_no_guests || 0,
      });
      setCsrfToken(result.data.csrf_token || csrfToken);
    } else {
      setError("Failed to load RSVPs.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this RSVP?")) return;
    const result = await deleteRsvp(id, csrfToken);
    if (result.ok) {
      await loadRsvps();
    } else {
      setError("Failed to delete RSVP.");
    }
  }

  async function handleLogout() {
    await logoutAdmin();
    navigate(`/${adminPath}/login`);
  }

  if (loading) {
    return (
      <div className="admin-wrap">
        <p className="empty">Loading...</p>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="admin-title">RSVP Submissions</h1>
        <button className="delete-btn" onClick={handleLogout}>
          Log Out
        </button>
      </div>

      <div className="admin-totals">
        Total RSVPs: {totals.total_rsvps} | Attending: {totals.total_yes} (
        {totals.total_guests} guests) | Declined: {totals.total_no} (
        {totals.total_no_guests} not coming)
      </div>

      {error && <div className="login-error">{error}</div>}

      {rsvps.length === 0 ? (
        <div className="empty">No submissions yet.</div>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Attendance</th>
                <th>Party Size</th>
                <th>Guests</th>
                <th>Song Request</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {rsvps.map((rsvp, index) => (
                <tr key={rsvp.id} data-row-index={index}>
                  <td>{rsvp.created_at}</td>
                  <td>
                    {rsvp.first_name} {rsvp.last_name}
                  </td>
                  <td>{rsvp.email}</td>
                  <td>{rsvp.phone}</td>
                  <td>{rsvp.attendance}</td>
                  <td>{rsvp.party_size}</td>
                  <td>
                    {rsvp.guests.length === 0 ? (
                      "—"
                    ) : (
                      <ol className="guest-list">
                        {rsvp.guests.map((g, i) => (
                          <li key={i}>
                            {g.first} {g.last}
                          </li>
                        ))}
                      </ol>
                    )}
                  </td>
                  <td>{rsvp.song_request || "—"}</td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(rsvp.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="admin-cards">
            {rsvps.map((rsvp, index) => (
              <div key={rsvp.id} className="admin-card" data-row-index={index}>
                <div className="admin-card__row">
                  <span className="admin-card__label">Submitted</span>
                  <div className="admin-card__value">{rsvp.created_at}</div>
                </div>
                <div className="admin-card__row">
                  <span className="admin-card__label">Name</span>
                  <div className="admin-card__value">
                    {rsvp.first_name} {rsvp.last_name}
                  </div>
                </div>
                <div className="admin-card__row">
                  <span className="admin-card__label">Email</span>
                  <div className="admin-card__value">{rsvp.email}</div>
                </div>
                <div className="admin-card__row">
                  <span className="admin-card__label">Phone</span>
                  <div className="admin-card__value">{rsvp.phone}</div>
                </div>
                <div className="admin-card__row">
                  <span className="admin-card__label">Attendance</span>
                  <div className="admin-card__value">{rsvp.attendance}</div>
                </div>
                <div className="admin-card__row">
                  <span className="admin-card__label">Party Size</span>
                  <div className="admin-card__value">{rsvp.party_size}</div>
                </div>
                <div className="admin-card__row">
                  <span className="admin-card__label">Guests</span>
                  <div className="admin-card__value">
                    {rsvp.guests.length === 0 ? (
                      "—"
                    ) : (
                      <ol className="guest-list">
                        {rsvp.guests.map((g, i) => (
                          <li key={i}>
                            {g.first} {g.last}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
                <div className="admin-card__row">
                  <span className="admin-card__label">Song Request</span>
                  <div className="admin-card__value">
                    {rsvp.song_request || "—"}
                  </div>
                </div>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(rsvp.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
