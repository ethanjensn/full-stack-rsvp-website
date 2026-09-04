/**
 * Event-specific configuration for the wedding website.
 * This is a direct port of config.py.
 */

export const PARTNER_ONE_FIRST_NAME = "Sophia";
export const PARTNER_TWO_FIRST_NAME = "James";
export const COUPLE_DISPLAY_NAME = "Sophia & James";
export const COUPLE_DISPLAY_NAME_UPPER = "SOPHIA & JAMES";
export const COUPLE_DISPLAY_NAME_HTML = "SOPHIA &amp; JAMES";

export const EVENT_DATE_DISPLAY = "SATURDAY, JULY 19 2026";
export const EVENT_SCHEDULE_LINES = [
  "CEREMONY &bull; 4:00 PM",
  "COCKTAIL HOUR &amp; DINNER TO FOLLOW",
  "RECEPTION UNTIL 10:00 PM",
];

export const VENUE_NAME = "Chicago Venue";
export const VENUE_NAME_UPPER = "CHICAGO VENUE";
export const VENUE_ADDRESS = "78 E Washington St, Chicago, IL 60602";
export const VENUE_DIRECTIONS_URL =
  "https://www.google.com/maps/dir/?api=1" +
  "&destination=78+E+Washington+St,+Chicago,+IL+60602";

export const REGISTRY_URL = "https://www.amazon.com";

export const CALENDAR_TITLE = "Sophia & James's Wedding";
export const CALENDAR_DESCRIPTION =
  "Ceremony at 4pm. Cocktails and Dinner to follow. Music until 10pm.";
export const CALENDAR_LOCATION = `${VENUE_NAME}, ${VENUE_ADDRESS}`;
export const CALENDAR_START_UTC = "20260719T210000Z";
export const CALENDAR_END_UTC = "20260720T030000Z";
export const CALENDAR_ICS_UID = "sophia-james-wedding-2026@wedding-website";
export const CALENDAR_ICS_PRODID = "-//Sophia & James Wedding//EN";

export const HERO_IMAGE = "hero.jpg";
export const RSVP_HERO_IMAGE = "rsvp-hero.jpg";
export const CONFIRM_IMAGE = "confirm.jpg";

export const config = {
  PARTNER_ONE_FIRST_NAME,
  PARTNER_TWO_FIRST_NAME,
  COUPLE_DISPLAY_NAME,
  COUPLE_DISPLAY_NAME_UPPER,
  COUPLE_DISPLAY_NAME_HTML,
  EVENT_DATE_DISPLAY,
  EVENT_SCHEDULE_LINES,
  VENUE_NAME,
  VENUE_NAME_UPPER,
  VENUE_ADDRESS,
  VENUE_DIRECTIONS_URL,
  REGISTRY_URL,
  CALENDAR_TITLE,
  CALENDAR_DESCRIPTION,
  CALENDAR_LOCATION,
  CALENDAR_START_UTC,
  CALENDAR_END_UTC,
  CALENDAR_ICS_UID,
  CALENDAR_ICS_PRODID,
  HERO_IMAGE,
  RSVP_HERO_IMAGE,
  CONFIRM_IMAGE,
};
