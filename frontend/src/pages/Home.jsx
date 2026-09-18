import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

function Home({ config }) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarHref, setCalendarHref] = useState("/calendar");
  const [showMenu, setShowMenu] = useState(true);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const host = window.location.host;

    if (isIOS) {
      setCalendarHref(`webcal://${host}/calendar.ics`);
      setShowMenu(false);
    } else if (isAndroid) {
      setCalendarHref("/calendar");
      setShowMenu(false);
    }
  }, []);

  useEffect(() => {
    function closeMenu(event) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }
    if (showMenu) {
      document.addEventListener("click", closeMenu);
      return () => document.removeEventListener("click", closeMenu);
    }
  }, [showMenu]);

  useEffect(() => {
    function triggerAnimations() {
      const animatedElements = document.querySelectorAll(
        ".hero, .names, .actions, .info__block"
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

  useEffect(() => {
    document.title = config.COUPLE_DISPLAY_NAME || "Wedding RSVP";
  }, [config.COUPLE_DISPLAY_NAME]);

  const scheduleLines = config.EVENT_SCHEDULE_LINES || [];

  return (
    <main className="page">
      <section className="hero" aria-label="Wedding invitation" />

      <section className="details">
        <div className="details__container">
          <h1
            className="names"
            dangerouslySetInnerHTML={{
              __html: config.COUPLE_DISPLAY_NAME_HTML || config.COUPLE_DISPLAY_NAME,
            }}
          />

          <div className="actions" aria-label="RSVP">
            <Link className="btn" to="/rsvp">
              RSVP
            </Link>
            <Link className="btn" to="/qa">
              Q&A
            </Link>
            <a
              className="btn"
              href={config.REGISTRY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              REGISTRY
            </a>
          </div>

          <div className="info" aria-label="Event details">
            <div className="info__block">
              <div className="info__label info__label--title">Date</div>
              <div className="info__divider" />
              <div className="info__calendar-text">
                <div className="info__label info__label--date">
                  {config.EVENT_DATE_DISPLAY}
                </div>
                <div className="info__schedule">
                  {scheduleLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="info__label"
                      dangerouslySetInnerHTML={{ __html: line }}
                    />
                  ))}
                </div>
              </div>
              <div className="calendar-widget">
                <a
                  ref={buttonRef}
                  className="btn calendar-widget__button"
                  href={calendarHref}
                  target={showMenu ? undefined : "_blank"}
                  rel={showMenu ? undefined : "noopener noreferrer"}
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  onClick={
                    showMenu
                      ? (event) => {
                          event.preventDefault();
                          setMenuOpen(!menuOpen);
                        }
                      : undefined
                  }
                >
                  Add to Calendar
                </a>
                {showMenu && (
                  <div
                    ref={menuRef}
                    className="calendar-widget__menu"
                    hidden={!menuOpen}
                  >
                    <a
                      className="calendar-widget__option"
                      href="/calendar"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpen(false)}
                    >
                      Google Calendar
                    </a>
                    <a
                      className="calendar-widget__option"
                      href="/calendar.ics"
                      download="wedding.ics"
                      onClick={() => setMenuOpen(false)}
                    >
                      Download .ics
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div className="info__block">
              <div className="info__label info__label--title">Location</div>
              <div className="info__divider" />
              <div className="info__map-text">
                <span className="info__label">{config.VENUE_NAME_UPPER}</span>
                <span className="info__value">{config.VENUE_ADDRESS}</span>
              </div>
              <a
                className="btn directions-button"
                href={config.VENUE_DIRECTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                DIRECTIONS
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
