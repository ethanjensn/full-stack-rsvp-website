"""Event-specific configuration for the wedding website.

This is the ONLY file that contains personally identifiable information.
Swap this file (and the images in static/assets/) to rebrand the site
for a different event or for the public portfolio version.
"""

# Couple
PARTNER_ONE_FIRST_NAME = "Sophia"
PARTNER_TWO_FIRST_NAME = "James"
COUPLE_DISPLAY_NAME = "Sophia & James"
COUPLE_DISPLAY_NAME_UPPER = "SOPHIA & JAMES"
COUPLE_DISPLAY_NAME_HTML = "SOPHIA &amp; JAMES"

# Event schedule
EVENT_DATE_DISPLAY = "SATURDAY, JULY 19 2026"
EVENT_SCHEDULE_LINES = [
    "CEREMONY &bull; 4:00 PM",
    "COCKTAIL HOUR &amp; DINNER TO FOLLOW",
    "RECEPTION UNTIL 10:00 PM",
]

# Venue
VENUE_NAME = "Chicago Venue"
VENUE_NAME_UPPER = "CHICAGO VENUE"
VENUE_ADDRESS = "78 E Washington St, Chicago, IL 60602"
VENUE_DIRECTIONS_URL = (
    "https://www.google.com/maps/dir/?api=1"
    "&destination=78+E+Washington+St,+Chicago,+IL+60602"
)

# Registry
REGISTRY_URL = "https://www.amazon.com"

# Calendar event (Google Calendar + iCalendar)
CALENDAR_TITLE = "Sophia & James's Wedding"
CALENDAR_DESCRIPTION = "Ceremony at 4pm. Cocktails and Dinner to follow. Music until 10pm."
CALENDAR_LOCATION = f"{VENUE_NAME}, {VENUE_ADDRESS}"
# 4pm CDT = 9pm UTC, 10pm CDT = 3am UTC next day
CALENDAR_START_UTC = "20260719T210000Z"
CALENDAR_END_UTC = "20260720T030000Z"
CALENDAR_ICS_UID = "sophia-james-wedding-2026@wedding-website"
CALENDAR_ICS_PRODID = "-//Sophia & James Wedding//EN"

# Images (filenames within static/assets/)
HERO_IMAGE = "hero.jpg"
RSVP_HERO_IMAGE = "rsvp-hero.jpg"
CONFIRM_IMAGE = "confirm.jpg"
