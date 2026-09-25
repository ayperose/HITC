# HITC, Inc.: design plan for the home hero

Tooling file, not deployed (listed in .vercelignore).

## Subject, audience, job
- **Subject:** Headstart Information Technology & Consultancy Inc. (HITC), Tuguegarao City, Cagayan. They build school systems (RFID ID gates, SMS alerts to parents, attendance, cashless canteens, fee and student-ledger systems, a school portal app, SMS announcements), and they print books.
- **Audience:** school owners, principals and administrators, and the parents who pay for and trust those systems.
- **Primary job of the hero:** say what HITC does in one screen (school systems that connect students, parents and the school office) and make the connection feel real: a student scans an ID, and a parent knows. Then hand off to Campus Connect, their main system right now.
- **Voice:** theirs. Plain, confident English, school-office friendly. Tagline "We Innovate Technologies" is their own (hitc.ph).

## Source facts (read 2026-09-25)
- Tagline "We Innovate Technologies": hitc.ph home page.
- "one of the Philippines leading IT firm specialized in developing and creating highly diversified automation products for government and private institutions": hitc.ph.
- Since 2006; HQ HITC Bldg., #154 Tuliao St., Caritan Norte, Tuguegarao City; (078) 377-1337; careers@hitc.ph; www.hitc.ph: their "We are hiring" poster (photos/hiring.jpg) and this site's footer and about page. hitc.ph still shows older contacts ((078) 377-1067, admin@hitc.ph); the newer poster wins.
- Turnstile System: "Students and staff tap their school ID to pass through... every entry and exit is recorded instantly." "Parents receive an automatic SMS or notification when their child enters or exits campus." (turnstile.html)
- Attendance Manager: "Parents receive an SMS the moment their child taps in or out — immediate notification, no app required on the parent's side." (attendance.html)
- eCash: "Each student has a digital wallet loaded by parents. Funds are spent by tapping an RFID ID at any campus terminal." Pays for canteen meals, books, school fees, photocopying and printing. (ecash.html)
- SFMS: enrollment, assessment, student ledger, billing, cashiering, accounting. (sfms.html)
- iAsk eLibrary: the campus portal app for students and parents: balances, canteen transactions, ledger, monthly attendance, questions. (iask.html)
- eBroadcasting: SMS announcements to students, teachers and parents, no app needed. (ebroadcasting.html)
- **They print books:** from Miles, 2026-09-25. Not yet stated anywhere on the site. The hero only says "we print books"; subjects and titles are not known, so none are shown.
- Robotics (Intelliteach, LEGO EV3) is being removed from the site (Miles, 2026-09-25), so the hero doesn't feature it.
- **Campus Connect** (Miles, 2026-09-25): "our main system right now is scanning the id and the parents can know the time in time out and tuition payments all the stuff about school. its a new system called campus connect." Download page (ebroad.dbsmanila.com/attapi/downloads/) offers an Android APK only, with no feature text.
- Campus Connect app screenshots (from Miles): a blue app bar "Campus Connect for DBS", an "Add ID Card" button and "Settings", "Showing the latest 30 updates", TIME OUT entries worded "[name] left the campus at Jul 25, 2026 9:02 AM", ANNOUNCEMENT posts to parents, and a Card Activation screen (ID Number, Request Activation Code, Activation Code, Activate). The App Store lists it as "Campus Connect for DBS".
- Deliberately not used: the client school's name and branding (DBS), and the real student's name in the screenshot. The site's example feed uses the placeholder "Maria dela Cruz" and generic sample entries; its tuition and announcement wording is illustrative, not copied from the app.
- Photos: white school uniforms, checked neck ribbons, ID cards on dark lanyards, green-and-white canteens with ID tap terminals (photos/ecash*.jpg). Navy-painted wooden school desks (photos/robot*.jpg).
- Inferred, not stated: the 7:02 AM time and the sample feed entries are illustrations of the documented features, not real records. The feed shows today's date (Asia/Manila) as the live element.

## Tokens
| name | hex | use |
|---|---|---|
| ink | `#0A0F1C` | the site's text color; the hero's night-navy base |
| desk | `#16244F` | navy-painted school desk from their classroom photos; the surface the book lies on |
| paper | `#F4F4F0` | the site's page color; the book's pages; the color the story fades to |
| hitc blue | `#1E6BFF` | the site accent and their logo blue; RFID reader glow, the SMS bubble |
| gold | `#F5A800` | the site's second color; the morning sun, highlights |
| school green | `#2E8B57` | canteen and school trim from their photos; used only inside the book's illustrations |

Type (the rest of the site stays as it is, so the hero uses the same families):
- **Barlow Condensed 900**: display, uppercase, tight. The hero headline and the headings printed in the book.
- **Space Grotesk**: body and UI.
- **Schoolbell**: handwriting like a note in a student's notebook, for doodle labels on the book and the captions only. Never for UI.

## Layout
```
nav       (unchanged, shared by every page)
HERO      pinned, night-navy. Copy on the left, the pop-up book center-right on a navy desk,
          a parent's phone in front of it, a stack of their books behind.
          Left page: home, a parent at the door, a sleepy student with an ID on a lanyard.
          Right page: the school gate, HITC's turnstile with its ID reader, the flag.
          Scroll: the student walks to school and scans in; a paper plane (the alert)
          flies out of the book to the phone; the phone lights with Campus Connect.
          The camera swoops over the phone and lands exactly where the section's phone sits.
CAMPUS    NEW. Paper. "Campus Connect": what parents see (time in and out, tuition,
CONNECT   school updates, adding a child's ID) beside an HTML phone that matches the 3D one.
STATS     unchanged, now after Campus Connect.
...       about, services, robotics, contact, footer unchanged.
```
Hero copy is left aligned. Only the handwritten labels float, pinned to things in the book.

## Hero story ("the 7 a.m. scan")
A pop-up book lies open on a navy classroom desk in the morning sun, with a parent's phone in front of it and a stack of the books they print behind.
1. **Arrive:** the pop-ups rise as the page loads (the one orchestrated moment). The book leans with the pointer.
   - Tap the student ("5 more minutes…") to wake her. She follows your pointer across the page, then goes back to the door.
   - Tap the reader ("scan your ID"): it pulses green, the turnstile turns, and a paper plane carries the alert to the parent's phone, which lights up with Campus Connect.
   - Tap the phone ("a parent's phone") to light it.
   - Tap the stack ("we print books"): the top cover lifts and settles.
2. **Scroll:** her parent waves her off; she walks to school and scans her ID ("one scan at the gate…"). The plane flies home and the phone lights ("…and a parent knows.").
3. **Hand-off:** the camera swoops from the book to the phone and settles over it at the exact size and place of the phone in the Campus Connect section. The rest of the view fades to paper around it, the book steps aside, and the section's own phone is already there.

## Principles
1. The boldness lives in the book. Everything after it stays the site's existing paper and ink.
2. Paper, not plastic. Every piece is a die-cut card with a white edge, lit by one warm sun, casting real shadows on the page.
3. Only true taps. Each label is a documented feature (ID gates, SMS to parents) or Miles's own words (we print books).
4. Min spec is a 2-core Ryzen 3 laptop: flat planes, one shadow light, pixel ratio capped, paused offscreen. Reduced motion means no scroll story and no ambient motion, but the pop-ups still stand and taps still work. Without WebGL there's a real photo fallback.

## Review against the generic defaults
- **Not near-black plus an acid accent:** the dark is the navy of their own school desks, and the accents are the site's existing blue and gold.
- **Not a cream-serif editorial page:** the type is the site's Barlow Condensed and Space Grotesk; the only new face is a school-notebook hand, used for labels.
- **No eyebrow above the headline:** I dropped the "Philippines' Leading IT Firm" chip. The facts moved into the lede.
- **No accent-colored word in the headline:** the gold "TECHNOLOGIES" became part of a single-color headline, because the hero's color lives in the book.
- **Changed during review:** the first draft put a robot at the center (their EV3 photos). Miles is removing robotics, so the cast became the systems parents actually feel: the ID, the gate, the SMS, the books.
