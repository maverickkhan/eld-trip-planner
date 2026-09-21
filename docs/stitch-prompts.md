# Google Stitch prompts for the ELD Trip Planner UI

Paste **Prompt 0** first to set the project's design system, then one prompt per screen in the
same Stitch project so the theme carries over. Every value below is real output from the
running app (trip Chicago, IL → Joliet, IL → Dallas, TX, departing 2026-09-21 06:00 with 12 cycle
hours used; and Los Angeles, CA → Phoenix, AZ → New York, NY with 60 hours used).

---

## Prompt 0 — Project context & design system (paste first)

```
Design a desktop-first B2B web application called "ELD Trip Planner" for trucking dispatchers and property-carrying truck drivers in the United States. The user enters a current location, a pickup location, a drop-off location and the hours already used in their FMCSA 70-hour/8-day cycle. The app geocodes the stops, routes the trip, applies FMCSA Hours-of-Service rules (11-hour driving limit, 14-hour on-duty window, 30-minute break after 8 hours driving, 10-hour rest, 34-hour restart, fuel stop every 1,000 miles, 1 hour for pickup and 1 hour for drop-off) and produces: a route map with all planned stops, a stop-by-stop schedule, and one ELD daily log sheet per calendar day drawn as the traditional 24-hour duty-status grid. Accuracy and legibility of the log sheets matter most; this is compliance tooling, not a consumer app.

Audience and context: dispatchers on 1440×900 or larger desktop monitors, planning several trips a day; drivers occasionally open a shared trip permalink on a phone. Design desktop first, but every screen must collapse to a single column at 900px and below.

Visual direction: clean, professional, data-dense but highly legible logistics software. Light theme. No illustrations, mascots, gradients, or decorative shapes. Follow Material UI (MUI v6) component conventions so the design translates directly to React + Material UI: 8px spacing grid, 4px corner radius, Roboto (or Inter) typography using MUI scale (h5 for page/section titles, subtitle2 for card titles, body2 for table and form text, caption for helper text), outlined TextFields in size "small", contained primary Button and outlined secondary Button, Paper cards with a 1px neutral border and no drop shadow (elevation 0), dense Tables with a light grey header row, Chips for categorical status, Alerts for errors, Skeletons for loading, a slim top AppBar. Primary color: a trustworthy blue (about #1565C0). Neutral greys for surfaces and borders (#F8FAFC page background, #FFFFFF cards, #E5E7EB borders, #1F2937 text, #6B7280 secondary text).

Semantic color coding must stay consistent on every screen (map markers, table chips, legend):
- Driving = blue #2563EB
- Pickup = green #16A34A
- Drop-off = red #DC2626
- Fuel stop = amber #F59E0B
- 30-minute break = sky blue #0EA5E9
- 10-hour rest (sleeper berth) = violet #7C3AED
- 34-hour restart = near-black #111827
- Trip start / off duty padding = grey #6B7280

Global layout used by all screens: top AppBar 56px with the product name "ELD Trip Planner" left-aligned and the caption "Property-carrying driver · 70 hr / 8 day cycle" beside it. Below it a two-column layout with max width 1280px centered: a fixed 360px left column holding the trip input form and a "Recent trips" list, and a fluid right column holding the results. Time values are shown as H:MM (e.g. 17:32), dates as YYYY-MM-DD HH:MM (e.g. 2026-09-21 06:00), distances as "930.5 mi".
```

---

## Prompt 1 — Trip input form (initial state, route `/`)

```
Screen: "Plan a trip" — initial empty state of the ELD Trip Planner, desktop 1440×900, light theme, Material UI conventions (see project design system).

Layout: AppBar on top ("ELD Trip Planner" + caption "Property-carrying driver · 70 hr / 8 day cycle"). Two columns below: 360px left column, fluid right column.

LEFT COLUMN, card 1 — title "Trip details". A vertical form with five fields, each an outlined small MUI TextField with the label above or floating:
1. "Current location" — text, placeholder "City, State", value shown: "Chicago, IL"
2. "Pickup location" — text, placeholder "City, State", value shown: "Joliet, IL"
3. "Drop-off location" — text, placeholder "City, State", value shown: "Dallas, TX"
4. "Current cycle used (hrs, 0–70)" — numeric input with stepper, value "12". Helper text: "Hours already on duty in the last 8 days."
5. "Departure (local time)" — date-time picker field, value "2026-09-21 06:00". Helper text: "Optional. Defaults to now."
Below the fields a row with two buttons: primary contained "Plan trip" and outlined secondary "Fill example". Under the buttons a caption in secondary grey: "Geocoding + routing use free public services; planning takes a few seconds."

LEFT COLUMN, card 2 — title "Recent trips". A compact MUI List of previously planned trips, each a link row with a primary line and a secondary grey line:
- "#2 Los Angeles, CA → Phoenix, AZ → New York, NY" / "2,783.8 mi · 6 day(s) · 119:29"
- "#1 Chicago, IL → Joliet, IL → Dallas, TX" / "930.5 mi · 2 day(s) · 30:02"

RIGHT COLUMN — a single welcome card, title "Plan a trip", body text: "Enter the current, pickup and drop-off locations plus the hours already used in the 70-hour cycle. The planner geocodes the stops, routes the trip, and applies FMCSA hours-of-service rules to produce a stop-by-stop schedule and daily log sheets." Below the text, a small three-item horizontal summary of what the output contains, each with an icon: "Route map with stops", "Stop-by-stop schedule", "Daily ELD log sheets". Keep it restrained and informational, no hero imagery.

Also show a compact variant of this screen at 390px mobile width: the form card full width on top, the welcome card below, recent trips last.
```

---

## Prompt 2 — Loading / in-progress state

```
Screen: "Planning trip" loading state of the ELD Trip Planner, desktop 1440×900, light theme, Material UI conventions (see project design system). Same AppBar and two-column layout as the trip form screen.

LEFT COLUMN: the "Trip details" form from the previous screen with all five fields filled ("Chicago, IL", "Joliet, IL", "Dallas, TX", "12", "2026-09-21 06:00") and disabled (greyed, not editable). The primary button shows a small circular progress spinner and the label "Planning…"; the "Fill example" button is disabled. "Recent trips" card unchanged below.

RIGHT COLUMN: a status card at the top with a MUI LinearProgress bar (indeterminate) and the text "Planning trip… geocoding, routing and applying HOS rules." Under it a compact horizontal MUI Stepper with three steps showing progress: step 1 "Geocoding 3 locations" (completed, check icon), step 2 "Routing via OSRM" (active, spinner), step 3 "Applying HOS rules" (pending). Caption under the stepper: "Usually 3–6 seconds. Free public routing services are rate-limited."

Below the status card, skeleton placeholders (MUI Skeleton, rounded rectangles in light grey) shaped exactly like the upcoming results so the layout does not jump: a row of 6 small stat tiles, a 440px-tall map rectangle with a placeholder legend row under it, and a table skeleton with a header row and 8 body rows.
```

---

## Prompt 3 — Results: trip summary + route map (route `/trips/:id`)

```
Screen: trip results with route map, ELD Trip Planner, desktop 1440×900, light theme, Material UI conventions (see project design system). Same AppBar; left 360px column shows the filled "Trip details" form (values "Chicago, IL", "Joliet, IL", "Dallas, TX", "12", "2026-09-21 06:00", primary button "Plan trip" enabled) and the "Recent trips" list; right column shows the results.

RIGHT COLUMN, top: a small permalink row in secondary grey: "Permalink: http://localhost:5173/trips/1" with a copy-link icon button.

Card "Trip summary": subtitle line in secondary text with the geocoded place names joined by arrows: "Chicago, South Chicago Township, Cook County, Illinois, United States → Joliet, Will County, Illinois, United States → Dallas, Dallas County, Texas, United States". Below it a responsive grid of 12 stat tiles (uppercase caption label, bold value), in this order and with these exact values:
- TOTAL DISTANCE — 930.5 mi
- DRIVING TIME — 17:32
- TRIP DURATION — 30:02
- LOG DAYS — 2
- DEPARTS — 2026-09-21 06:00
- DELIVERED — 2026-09-22 12:02
- FUEL STOPS — 0
- 30-MIN BREAKS — 1
- 10-HR RESTS — 1
- 34-HR RESTARTS — 0
- CYCLE USED (START → END) — 12:00 → 31:32
- ROUTE LEGS — 44.5 mi + 885.9 mi

Card "Route & stops": a 440px-tall interactive street map (OpenStreetMap style, muted greys and greens) showing the driving route from Chicago south-west through Illinois and Missouri, past Joplin, down through Oklahoma to Dallas, drawn as a 4px blue (#2563EB) polyline. Circular markers with white 2px outlines along the route:
- Trip start at Chicago — grey #6B7280, radius 7
- Pickup at Joliet, IL — green #16A34A, radius 10
- 30-minute break at odometer 474.4 mi near Rolla, Missouri — sky blue #0EA5E9, radius 7
- 10-hour rest at odometer 579.1 mi near Joplin, Missouri — violet #7C3AED, radius 7
- Drop-off at Dallas, TX — red #DC2626, radius 10
Standard zoom +/- controls top-left and a small "Leaflet | © OpenStreetMap contributors" attribution bottom-right. One marker popup is open on the 10-hour rest marker, showing: bold "10-hr rest", then "10-hour rest (sleeper berth)", then "2026-09-21 18:30 → 2026-09-22 04:30 (10:00)", then "Odometer: 579.1 mi".
Under the map a legend row of colored dots with labels: Pickup, Drop-off, Fuel stop, 30-min break, 10-hr rest, 34-hr restart.

Below the map card, show the top edge of the next card "Stop-by-stop schedule" to indicate the page continues (the schedule and log sheets are separate prompts). Optionally propose MUI Tabs "Map · Schedule · Log sheets" above the results with "Map" selected, while keeping the summary card always visible above the tabs.
```

---

## Prompt 4 — Stop-by-stop schedule (itinerary)

```
Screen: "Stop-by-stop schedule" card of the ELD Trip Planner results page, desktop 1440×900, light theme, Material UI conventions (see project design system). Show it in the right results column under the trip summary (the left column is the filled trip form). Design it as a dense MUI Table (compact rows, light grey header, zebra striping optional) with these eight columns: #, Start, End, Duration, Status, Activity, Odometer, Leg. The Activity column shows a small filled Chip colored by event type followed by a text label. Use exactly these eight rows:

1 | 2026-09-21 06:00 | 2026-09-21 07:03 | 1:03 | Driving | [blue chip "Driving"] Driving (to pickup) | 0 mi → 44.5 mi | to pickup
2 | 2026-09-21 07:03 | 2026-09-21 08:03 | 1:00 | On Duty (not driving) | [green chip "Pickup"] Pickup (loading) | 44.5 mi | to pickup
3 | 2026-09-21 08:03 | 2026-09-21 16:03 | 8:00 | Driving | [blue chip "Driving"] Driving (to dropoff) | 44.5 mi → 474.4 mi | to dropoff
4 | 2026-09-21 16:03 | 2026-09-21 16:33 | 0:30 | Off Duty | [sky-blue chip "30-min break"] 30-minute break | 474.4 mi | —
5 | 2026-09-21 16:33 | 2026-09-21 18:30 | 1:57 | Driving | [blue chip "Driving"] Driving (to dropoff) | 474.4 mi → 579.1 mi | to dropoff
6 | 2026-09-21 18:30 | 2026-09-22 04:30 | 10:00 | Sleeper Berth | [violet chip "10-hr rest"] 10-hour rest (sleeper berth) | 579.1 mi | —
7 | 2026-09-22 04:30 | 2026-09-22 11:02 | 6:32 | Driving | [blue chip "Driving"] Driving (to dropoff) | 579.1 mi → 930.5 mi | to dropoff
8 | 2026-09-22 11:02 | 2026-09-22 12:02 | 1:00 | On Duty (not driving) | [red chip "Drop-off"] Drop-off (unloading) | 930.5 mi | to dropoff

Add a thin day divider row between rows 6 and 7 labelled "Day 2 — 2026-09-22" to make the midnight crossing obvious. Above the table, a right-aligned toolbar with a "Day: All ▾" filter and an "Export CSV" outlined button (optional). Also design a second variant of the same data as a vertical timeline (left rail with colored dots per event type, time on the left, activity and odometer on the right) suitable for the 390px mobile layout.

Chip color rules: Driving blue #2563EB, Pickup green #16A34A, Drop-off red #DC2626, Fuel stop amber #F59E0B, 30-min break sky blue #0EA5E9, 10-hr rest violet #7C3AED, 34-hr restart near-black #111827.
```

---

## Prompt 5 — Daily log sheet (ELD 24-hour grid) — most important screen

```
Screen: "Daily log sheets" section of the ELD Trip Planner results page, desktop 1440×900, light theme, Material UI conventions (see project design system). This must closely resemble a real FMCSA paper "Driver's Daily Log" / ELD printout: black hairline grid on white, one sheet per calendar day, each sheet a full-width card in the right results column. Section title above the cards: "Daily log sheets (2)".

Each sheet card has three parts.

PART 1 — header strip, a single row of label/value pairs in small text (bold labels):
Date: 2026-09-21 | Day: 1 of 2 | Miles driven today: 579.1 mi | From: Chicago, IL | To: Dallas, TX | Driver type: Property-carrying, 70 hr / 8 day
Optionally add a tiny "DRIVER'S DAILY LOG (24 hours)" title in small caps at the top-left of the card.

PART 2 — the 24-hour duty-status grid, the centerpiece:
- A rectangular grid with 4 horizontal rows, labelled on the left in bold small text, top to bottom: "Off Duty", "Sleeper Berth", "Driving", "On Duty (not driving)".
- 24 equal hour columns across the full width. Hour labels along the top edge: "M" (midnight) at the far left, then 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, then "N" (noon) at the center, then 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, then "M" at the far right. The midnight and noon vertical lines are slightly heavier than the other hour lines.
- Inside every hour cell, three short vertical tick marks rising from the bottom edge of each row at :15, :30 and :45 (the :30 tick slightly taller), exactly like a paper log.
- A "Total" column on the right edge of the grid with a bold H:MM value per row. For this sheet: Off Duty 6:30, Sleeper Berth 5:30, Driving 11:00, On Duty (not driving) 1:00 (they add up to 24:00).
- The duty-status line: one continuous thick (3px) blue #1D4ED8 line that runs horizontally along a row for the duration of that status and steps vertically at each status change. Draw exactly this sequence for Day 1:
  • Off Duty from 00:00 (M) to 06:00
  • step down to Driving from 06:00 to 07:03
  • step down to On Duty (not driving) from 07:03 to 08:03 (pickup)
  • step up to Driving from 08:03 to 16:03
  • step up to Off Duty from 16:03 to 16:33 (30-minute break)
  • step down to Driving from 16:33 to 18:30
  • step up to Sleeper Berth from 18:30 to 24:00 (M, right edge)
Grid lines are #111 hairlines; row separators solid; the sheet background is pure white even if the page is light grey.

PART 3 — "Remarks" heading followed by a numbered list in small text, one line per duty-status change (time range · activity · odometer · coordinates):
1. 06:00–07:03 · Driving (to pickup) (0 mi → 44.5 mi) · 41.876, -87.624
2. 07:03–08:03 · Pickup (loading) @ 44.5 mi · 41.526, -88.084
3. 08:03–16:03 · Driving (to dropoff) (44.5 mi → 474.4 mi) · 41.526, -88.084
4. 16:03–16:33 · 30-minute break @ 474.4 mi · 37.560, -92.787
5. 16:33–18:30 · Driving (to dropoff) (474.4 mi → 579.1 mi) · 37.560, -92.787
6. 18:30–24:00 · 10-hour rest (sleeper berth) @ 579.1 mi · 37.070, -94.403

Directly below, a second sheet card for Day 2 with header: Date: 2026-09-22 | Day: 2 of 2 | Miles driven today: 351.3 mi | From: Chicago, IL | To: Dallas, TX | Driver type: Property-carrying, 70 hr / 8 day. Totals column: Off Duty 11:58, Sleeper Berth 4:30, Driving 6:32, On Duty (not driving) 1:00. Duty line: Sleeper Berth 00:00–04:30, step down to Driving 04:30–11:02, step down to On Duty (not driving) 11:02–12:02, step up to Off Duty 12:02–24:00. Remarks: "1. 00:00–04:30 · 10-hour rest (sleeper berth) @ 579.1 mi · 37.070, -94.403", "2. 04:30–11:02 · Driving (to dropoff) (579.1 mi → 930.5 mi) · 37.070, -94.403", "3. 11:02–12:02 · Drop-off (unloading) @ 930.5 mi · 32.776, -96.797".

Add a small toolbar above the sheets with a "Print / PDF" outlined button and a day selector (chips "Day 1", "Day 2"). The grid must remain legible when printed in black and white, so rely on line weight and position, not color, to convey the duty line; color is only an accent.

Also design an "all off duty" variant of a sheet (from a 6-day trip that includes a 34-hour restart): header "Date: 2026-09-22 | Day: 2 of 6 | Miles driven today: 0 mi", totals Off Duty 24:00 and 0:00 for the other three rows, the duty line running flat along the Off Duty row from the left edge to the right edge, and under Remarks the single grey line "Off duty all day." with one remark "1. 00:00–24:00 · 34-hour cycle restart @ 497.8 mi · 34.328, -110.815".
```

---

## Prompt 6 — Error & empty states

```
Screen set: error and empty states of the ELD Trip Planner, desktop 1440×900 (plus one 390px mobile variant), light theme, Material UI conventions (see project design system). Same AppBar and two-column layout. Design these five states as separate frames:

1. Validation error (client/400): the "Trip details" form with "Current cycle used (hrs, 0–70)" containing "80"; the field is in MUI error state (red outline) with helper text "Ensure this value is less than or equal to 70.0." An inline MUI Alert (severity error, outlined) above the buttons reads: "current cycle used hours: Ensure this value is less than or equal to 70.0." The right column still shows the "Plan a trip" welcome card.

2. Location not found (422 geocoding_failed): the form filled with "Chicago, IL", "Nowhereville", "Dallas, TX", "12"; the "Pickup location" field in error state; Alert text: "Could not find a location matching 'Nowhereville'." with a caption suggestion below: "Try “City, State” or a full street address."

3. No route (422 routing_failed): Alert text: "Could not build a driving route between these locations (NoRoute)." Suggest checking that all three locations are reachable by road in the continental US.

4. Service unavailable (502 upstream_unavailable): Alert severity warning with text "Routing service is unavailable. Please retry." and a contained "Retry" button inside the alert action slot. Secondary caption: "The free OSRM / Nominatim public servers are rate-limited; wait a few seconds and try again."

5. Trip not found (404 on /trips/999): right column shows an empty-state card with a muted map-pin icon, title "Trip not found", body "No Trip matches the given query.", and a contained button "Plan a new trip". Left column shows the empty form (fields blank, placeholders "City, State").

Also include two small inline empty states: (a) the "Recent trips" card showing a single grey caption "Recent trips unavailable: Could not reach the API (Failed to fetch)"; (b) a generic "Page not found." card for unknown routes.

Alerts follow MUI Alert styling: icon left, message text, optional action button right; error red for 4xx, warning amber for 5xx/network. Keep the layout identical to the healthy screens so users are never disoriented.
```

---

## Optional Prompt 7 — Mobile results (driver opening a permalink)

```
Screen: mobile 390×844 view of the ELD Trip Planner results page (route /trips/1), light theme, Material UI conventions (see project design system). Single column. Top AppBar "ELD Trip Planner" with a back arrow. The trip form is collapsed into an expandable accordion header "Trip details — Chicago, IL → Joliet, IL → Dallas, TX · 12 hrs used" (collapsed). Below: a horizontally scrollable strip of stat tiles (930.5 mi · 17:32 driving · 30:02 total · 2 log days · 1 rest · 1 break), then MUI Tabs "Map · Schedule · Logs". Show the "Logs" tab selected: the Day 1 log sheet card (header Date 2026-09-21, Day 1 of 2, 579.1 mi) with the 24-hour grid rendered full-width and horizontally scrollable so the hour columns stay readable, totals Off Duty 6:30 / Sleeper Berth 5:30 / Driving 11:00 / On Duty 1:00, the stepped duty line (Off Duty 00:00–06:00, Driving 06:00–07:03, On Duty 07:03–08:03, Driving 08:03–16:03, Off Duty 16:03–16:33, Driving 16:33–18:30, Sleeper Berth 18:30–24:00), and the numbered Remarks list beneath. A sticky bottom bar with "Day 1 · Day 2" chips.
```
