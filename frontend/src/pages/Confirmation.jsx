import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

function Confirmation({ config }) {
  const location = useLocation();
  const { firstName, lastName } = location.state || {};

  useEffect(() => {
    document.title = "RSVP Received";
  }, []);

  const name = [firstName, lastName].filter(Boolean).join(" ");

  return (
    <div className="rsvp-page">
      <section
        className="confirm-hero"
        aria-label="RSVP confirmation image"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18)), url("/static/assets/${config.CONFIRM_IMAGE}")`,
          backgroundColor: "#421C21",
        }}
      />
      <main className="confirm-wrap">
        <div className="confirm-border-icons">
          <img
            className="confirm-border-icon confirm-border-icon--tl"
            src="/static/assets/pngwing.com.png"
            alt="Decorative corner"
          />
          <img
            className="confirm-border-icon confirm-border-icon--tr"
            src="/static/assets/pngwing.com.png"
            alt="Decorative corner"
          />
          <img
            className="confirm-border-icon confirm-border-icon--bl"
            src="/static/assets/pngwing.com.png"
            alt="Decorative corner"
          />
          <img
            className="confirm-border-icon confirm-border-icon--br"
            src="/static/assets/pngwing.com.png"
            alt="Decorative corner"
          />
        </div>

        <h1 className="confirm-heading">RSVP Received</h1>
        <p className="confirm-message">
          Thank you{name ? `, ${name}` : ""}! We have recorded your response.
        </p>
        <p className="confirm-note">
          If you need to make any updates, feel free to submit the form again or
          contact us.
        </p>

        <div className="confirm-actions">
          <Link className="btn" to="/">
            Back to Home
          </Link>
          <Link className="btn" to="/rsvp">
            Submit Another RSVP
          </Link>
        </div>
      </main>
    </div>
  );
}

export default Confirmation;
