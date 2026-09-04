const nunjucks = require("nunjucks");
const { templates } = require("../src/templates-bundle.js");

const env = new nunjucks.Environment(
  {
    getSource(name) {
      return { src: templates[name], path: name, noCache: true };
    },
  },
  { autoescape: true, trimBlocks: true, lstripBlocks: true }
);

env.addFilter("tojson", (value) => JSON.stringify(value));

const config = {
  COUPLE_DISPLAY_NAME: "Sophia & James",
  COUPLE_DISPLAY_NAME_HTML: "SOPHIA &amp; JAMES",
  EVENT_DATE_DISPLAY: "SATURDAY, JULY 19 2026",
  EVENT_SCHEDULE_LINES: ["CEREMONY &bull; 4:00 PM"],
  VENUE_NAME_UPPER: "CHICAGO VENUE",
  VENUE_ADDRESS: "78 E Washington St",
  VENUE_DIRECTIONS_URL: "https://maps.example.com",
  REGISTRY_URL: "https://example.com",
  CONFIRM_IMAGE: "confirm.jpg",
};

for (const name of Object.keys(templates)) {
  try {
    const ctx = {
      config,
      error_message: "test error",
      form_data: {
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
        phone: "555-1234",
        attendance: "yes",
        party_size: 2,
        song_request: "Test song",
        guests: [{ first: "Guest", last: "One" }],
      },
      first_name: "Test",
      last_name: "User",
      admin_path: "admin-a7c3f9d2b81",
      csrf_token: "abc123",
      rsvps: [
        {
          id: 1,
          created_at: "Sep 4, 2026",
          first_name: "Test",
          last_name: "User",
          email: "test@example.com",
          phone: "555-1234",
          attendance: "yes",
          party_size: 2,
          guests: [{ first: "Guest", last: "One" }],
          song_request: "Song",
        },
      ],
      total_rsvps: 1,
      total_yes: 1,
      total_no: 0,
      total_guests: 2,
      total_no_guests: 0,
      error: null,
    };
    const result = env.render(name, ctx);
    console.log(`✓ ${name}: ${result.length} bytes`);
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}
