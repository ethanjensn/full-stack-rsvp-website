import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitRsvp } from "../api";

function Rsvp({ config }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    attendance: "yes",
    partySize: 1,
    songRequest: "",
  });
  const [guests, setGuests] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const extraGuests = Math.max(0, formData.partySize - 1);

  useEffect(() => {
    const nextGuests = [];
    for (let i = 0; i < extraGuests; i++) {
      nextGuests.push({
        first: guests[i]?.first || "",
        last: guests[i]?.last || "",
      });
    }
    if (nextGuests.length !== guests.length) {
      setGuests(nextGuests);
    }
  }, [extraGuests]);

  useEffect(() => {
    if (formData.attendance === "no" && formData.partySize !== 1) {
      setFormData((prev) => ({ ...prev, partySize: 1 }));
    }
  }, [formData.attendance, formData.partySize]);

  useEffect(() => {
    function triggerAnimations() {
      const animatedElements = document.querySelectorAll(
        ".rsvp-hero, .rsvp-wrap, .rsvp-section, .rsvp-actions"
      );
      animatedElements.forEach((el) => {
        el.style.animation = "none";
        void el.offsetHeight;
        el.style.animation = null;
      });
    }
    triggerAnimations();
    window.addEventListener("pageshow", triggerAnimations);
    return () => window.removeEventListener("pageshow", triggerAnimations);
  }, []);

  function updateGuest(index, field, value) {
    setGuests((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const body = {
      ...formData,
      guests,
    };

    const result = await submitRsvp(body);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.data?.error || "Something went wrong. Please try again.");
      if (result.data?.formData) {
        const fd = result.data.formData;
        setFormData({
          firstName: fd.first_name || "",
          lastName: fd.last_name || "",
          email: fd.email || "",
          phone: fd.phone || "",
          attendance: fd.attendance || "yes",
          partySize: fd.party_size || 1,
          songRequest: fd.song_request || "",
        });
        setGuests(fd.guests || []);
      }
      return;
    }

    navigate("/confirmation", {
      state: { firstName: formData.firstName, lastName: formData.lastName },
    });
  }

  const decline = formData.attendance === "no";

  return (
    <div className="rsvp-page">
      <section className="rsvp-hero" aria-label="RSVP header image" />
      <div className="rsvp-wrap">
        <div className="rsvp-border-icons">
          <img
            className="rsvp-border-icon rsvp-border-icon--tl"
            src="/static/assets/pngwing.com.png"
            alt="Decorative corner"
          />
          <img
            className="rsvp-border-icon rsvp-border-icon--tr"
            src="/static/assets/pngwing.com.png"
            alt="Decorative corner"
          />
          <img
            className="rsvp-border-icon rsvp-border-icon--bl"
            src="/static/assets/pngwing.com.png"
            alt="Decorative corner"
          />
          <img
            className="rsvp-border-icon rsvp-border-icon--br"
            src="/static/assets/pngwing.com.png"
            alt="Decorative corner"
          />
        </div>
        <h1 className="rsvp-heading">RSVP</h1>

        {error && (
          <div className="rsvp-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="rsvp-section">
            <div className="rsvp-section-title">Guest Details</div>
            <div className="rsvp-field-row">
              <div className="rsvp-field">
                <label className="rsvp-label" htmlFor="firstName">
                  First Name <span className="req">*</span>
                </label>
                <input
                  className="rsvp-input"
                  id="firstName"
                  name="firstName"
                  required
                  maxLength={100}
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                />
              </div>
              <div className="rsvp-field">
                <label className="rsvp-label" htmlFor="lastName">
                  Last Name <span className="req">*</span>
                </label>
                <input
                  className="rsvp-input"
                  id="lastName"
                  name="lastName"
                  required
                  maxLength={100}
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="rsvp-field-row">
              <div className="rsvp-field">
                <label className="rsvp-label" htmlFor="email">
                  Email <span className="req">*</span>
                </label>
                <input
                  className="rsvp-input"
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="rsvp-field">
                <label className="rsvp-label" htmlFor="phone">
                  Phone Number <span className="req">*</span>
                </label>
                <input
                  className="rsvp-input"
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  maxLength={20}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rsvp-section">
            <div className="rsvp-section-title">
              Will you join the celebration?
            </div>
            <div className="rsvp-radio-group">
              <label className="rsvp-radio-label">
                <input
                  type="radio"
                  name="attendance"
                  id="attendYes"
                  value="yes"
                  checked={formData.attendance === "yes"}
                  onChange={() =>
                    setFormData({ ...formData, attendance: "yes" })
                  }
                />
                Joyfully Accept
              </label>
              <label className="rsvp-radio-label">
                <input
                  type="radio"
                  name="attendance"
                  id="attendNo"
                  value="no"
                  checked={formData.attendance === "no"}
                  onChange={() =>
                    setFormData({ ...formData, attendance: "no" })
                  }
                />
                Regretfully Decline
              </label>
            </div>
          </div>

          <div className="rsvp-section">
            <div className="rsvp-section-title">Party Size</div>
            <p className="rsvp-note">
              Please reference your save the date for the number of seats
              reserved in your honor.
            </p>
            <div
              className="rsvp-field-row"
              style={{ justifyContent: "center" }}
            >
              <div className="rsvp-field" style={{ flex: "0 1 120px" }}>
                <input
                  className="rsvp-input"
                  id="partySize"
                  name="partySize"
                  type="number"
                  min={1}
                  max={10}
                  disabled={decline}
                  value={formData.partySize}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      partySize: parseInt(e.target.value, 10) || 1,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rsvp-section">
            <div className="rsvp-section-title">Song Request (Optional)</div>
            <p className="rsvp-note">
              Is there a song you'd love to hear on the dance floor?
            </p>
            <div className="rsvp-field-row">
              <div className="rsvp-field">
                <textarea
                  className="rsvp-input"
                  id="songRequest"
                  name="songRequest"
                  maxLength={500}
                  rows={3}
                  placeholder="Enter song title and artist..."
                  value={formData.songRequest}
                  onChange={(e) =>
                    setFormData({ ...formData, songRequest: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {extraGuests > 0 && (
            <div className="rsvp-section">
              <div className="rsvp-section-title">Additional Guests</div>
              {guests.map((guest, i) => {
                const idx = i + 2;
                return (
                  <div key={idx} className="rsvp-field-row">
                    <div className="rsvp-field">
                      <label className="rsvp-label" htmlFor={`guest${idx}First`}>
                        GUEST {idx} FIRST NAME <span className="req">*</span>
                      </label>
                      <input
                        className="rsvp-input"
                        id={`guest${idx}First`}
                        name={`guest${idx}First`}
                        maxLength={100}
                        required
                        value={guest.first}
                        onChange={(e) =>
                          updateGuest(i, "first", e.target.value)
                        }
                      />
                    </div>
                    <div className="rsvp-field">
                      <label className="rsvp-label" htmlFor={`guest${idx}Last`}>
                        GUEST {idx} LAST NAME <span className="req">*</span>
                      </label>
                      <input
                        className="rsvp-input"
                        id={`guest${idx}Last`}
                        name={`guest${idx}Last`}
                        maxLength={100}
                        required
                        value={guest.last}
                        onChange={(e) =>
                          updateGuest(i, "last", e.target.value)
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rsvp-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send My Response"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Rsvp;
