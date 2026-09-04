const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_REGEX = /^[\d\s\-\(\)\+]+$/;

export function validateRsvp(formData) {
  const firstName = (formData.get("firstName") || "").trim();
  const lastName = (formData.get("lastName") || "").trim();
  const email = (formData.get("email") || "").trim();
  const phone = (formData.get("phone") || "").trim();
  const attendanceRaw = (formData.get("attendance") || "yes").trim().toLowerCase();
  const attendance = attendanceRaw === "no" ? "no" : "yes";
  const songRequest = (formData.get("songRequest") || "").trim();

  let partySize = 1;
  try {
    partySize = parseInt(formData.get("partySize"), 10);
  } catch {
    partySize = 1;
  }
  if (isNaN(partySize) || partySize < 1) {
    partySize = 1;
  } else if (partySize > 10) {
    partySize = 10;
  }

  const guests = [];
  for (let idx = 2; idx <= partySize; idx++) {
    guests.push({
      first: (formData.get(`guest${idx}First`) || "").trim(),
      last: (formData.get(`guest${idx}Last`) || "").trim(),
    });
  }

  const errors = [];
  if (!firstName) errors.push("First name is required.");
  if (firstName.length > 100) errors.push("First name must be 100 characters or fewer.");
  if (!lastName) errors.push("Last name is required.");
  if (lastName.length > 100) errors.push("Last name must be 100 characters or fewer.");
  if (!email) errors.push("Email is required.");
  if (email.length > 254) errors.push("Email must be 254 characters or fewer.");
  if (!EMAIL_REGEX.test(email)) errors.push("Please provide a valid email address.");
  if (!phone) errors.push("Phone number is required.");
  if (phone.length > 20) errors.push("Phone number must be 20 characters or fewer.");
  if (!PHONE_REGEX.test(phone)) errors.push("Please provide a valid phone number.");
  if (songRequest.length > 500) errors.push("Song request must be 500 characters or fewer.");

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors[0],
      formData: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        attendance,
        party_size: partySize,
        song_request: songRequest,
        guests,
      },
    };
  }

  return {
    ok: true,
    submission: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      attendance,
      party_size: partySize,
      song_request: songRequest,
      guests,
    },
  };
}

export function buildGoogleCalendarUrl(config) {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", config.CALENDAR_TITLE);
  params.set("dates", `${config.CALENDAR_START_UTC}/${config.CALENDAR_END_UTC}`);
  params.set("details", config.CALENDAR_DESCRIPTION);
  params.set("location", config.CALENDAR_LOCATION);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsCalendar(config) {
  const uid = config.CALENDAR_ICS_UID;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const start = config.CALENDAR_START_UTC;
  const end = config.CALENDAR_END_UTC;
  const summary = config.CALENDAR_TITLE;
  const description = config.CALENDAR_DESCRIPTION;
  const location = config.CALENDAR_LOCATION;
  const prodid = config.CALENDAR_ICS_PRODID;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodid}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const folded = [];
  for (const line of lines) {
    const encoded = new TextEncoder().encode(line);
    if (encoded.length <= 75) {
      folded.push(line);
    } else {
      const chunks = [];
      let current = line;
      while (current) {
        let limit = 74;
        while (limit > 0 && new TextEncoder().encode(current.slice(0, limit)).length > 74) {
          limit--;
        }
        chunks.push(current.slice(0, limit));
        current = current.slice(limit);
      }
      folded.push(chunks[0]);
      for (let i = 1; i < chunks.length; i++) {
        folded.push(" " + chunks[i]);
      }
    }
  }

  return folded.join("\r\n") + "\r\n";
}

export function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
