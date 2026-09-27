# VICTORIOUS CHILDREN SCHOOL — DESIGN SYSTEM

**Document:** `08_DESIGN_SYSTEM.md`  
**Version:** 1.0  
**Status:** Canonical UI implementation specification  
**Product:** Victorious Children School (VCS) Website + School Management System  
**School:** Victorious Children School, Ojodu, Lagos, Nigeria  
**Motto:** “Not to Equal, But to Excel”

---

## 1. PURPOSE

This document converts the VCS UI/UX Design Brief into an implementation-level visual system.

It is the **canonical visual specification** for the VCS product.

Its purpose is to ensure that the public website and authenticated portals look like one product; every page uses the same visual language; TRAE does not invent arbitrary colours, typography, spacing, components or layouts; new pages can be built without creating a new design for every screen; and accessibility, responsiveness and interaction states are designed into components.

The existing VCS website is the **reference experience**, not a page-by-page template to copy blindly.

Reference: `https://victoriouschildrenschoolojodu.lovable.app/`

The UI/UX Design Brief remains the primary visual contract. This document makes its rules more precise for implementation.

---

# 2. DESIGN NORTH STAR

The VCS digital experience must feel:

**Premium · Calm · Trustworthy · Human · Nigerian · Modern · Academic · Purposeful**

The interface should communicate:

- Excellence
- Trust
- Academic seriousness
- Warmth
- Discipline
- Faith
- Community
- Modern administration

The product must feel appropriate for parents/guardians, students, teachers and administrators.

The school serves children, but the interface must not become childish.

### Avoid

- generic school templates;
- generic SaaS dashboards;
- excessive rounded cards;
- excessive gradients;
- excessive animation;
- cartoon-like interfaces;
- random glassmorphism;
- random illustrations;
- emoji-driven UI;
- decorative UI with no purpose;
- inconsistent page-specific styles.

---

# 3. DESIGN AUTHORITY

When visual decisions conflict, use this order:

1. Explicit owner requirement
2. `03_UI_UX_DESIGN_BRIEF.md`
3. `08_DESIGN_SYSTEM.md`
4. Existing VCS visual language
5. Existing reusable components
6. General UX conventions

Do not silently override an explicit requirement.

If a requirement is not defined, make the smallest sensible design decision and document the new rule here if it becomes reusable.

---

# 4. BRAND COLOUR SYSTEM

The UI/UX brief defines the following canonical colours.

| Token | Hex | Primary use |
|---|---|---|
| `vcs-blue-900` | `#1A237E` | Primary brand, navigation, major headings |
| `vcs-gold-500` | `#C9A84C` | Premium accent, highlights, achievements |
| `vcs-red-600` | `#B22234` | Restrained emphasis, alerts, selected CTAs |
| `vcs-cream-100` | `#F8F4E8` | Warm backgrounds, editorial sections |
| `vcs-white` | `#FFFFFF` | Cards, surfaces, clean backgrounds |
| `vcs-ink-900` | `#1A1A2E` | Primary body text |

Do not use all six colours equally. The product should primarily feel blue/white/neutral, with gold and red used intentionally.

### Recommended supporting neutrals

These are implementation neutrals, not additional brand colours.

```text
neutral-50   #FAFAF9
neutral-100  #F5F5F4
neutral-200  #E7E5E4
neutral-300  #D6D3D1
neutral-400  #A8A29E
neutral-500  #78716C
neutral-600  #57534E
neutral-700  #44403C
neutral-800  #292524
neutral-900  #1C1917
```

Use neutrals for borders, secondary text, muted UI and supporting surfaces.

---

# 5. SEMANTIC COLOUR TOKENS

Components should consume semantic tokens rather than hard-coded colours.

```text
--color-brand-primary       #1A237E
--color-brand-accent        #C9A84C
--color-brand-emphasis      #B22234

--color-surface             #FFFFFF
--color-surface-muted       #F8F4E8
--color-surface-subtle      #FAFAF9

--color-text-primary        #1A1A2E
--color-text-secondary      #57534E
--color-text-muted          #78716C
--color-text-inverse        #FFFFFF

--color-border              #E7E5E4
--color-border-strong       #D6D3D1

--color-success             #166534
--color-warning             #A16207
--color-danger              #B22234
--color-info                #1A237E

--color-focus               #1A237E
```

Semantic status colours must not be confused with brand decoration.

---

# 6. COLOUR USAGE RULES

### Primary blue

Use for:

- main navigation;
- primary buttons;
- major headings where appropriate;
- links;
- active navigation;
- trusted/authoritative interface elements;
- selected controls.

### Gold

Use for:

- achievement highlights;
- premium details;
- small decorative accents;
- selected statistics;
- subtle section dividers;
- important but non-destructive emphasis.

Gold should remain restrained. Do not make large blocks of text gold.

### Red

Use for:

- destructive actions;
- errors;
- urgent alerts;
- selected emphasis;
- carefully chosen calls-to-action.

Do not make every CTA red.

### Cream

Use for:

- editorial sections;
- warm content areas;
- school story sections;
- selected public website backgrounds.

Do not use cream as the default background for every page.

### White

Use for:

- cards;
- forms;
- dashboards;
- clean content surfaces;
- primary public website sections.

---

# 7. TYPOGRAPHY SYSTEM

Typography must be accessible and highly readable.

The UI/UX brief requires:

- visually dominant “VICTORIOUS” treatment;
- strong uppercase school identity;
- italicised motto;
- readable body copy;
- no decorative font that harms accessibility.

## 7.1 Font roles

Use a restrained two-font system.

### Display / editorial font

**Cormorant Garamond**

Use for:

- selected hero headlines;
- editorial statement headings;
- major public storytelling moments;
- quotations;
- premium school-story sections.

Do not use it for dense dashboard interfaces.

### Interface / body font

**Inter**

Use for:

- navigation;
- body text;
- buttons;
- forms;
- tables;
- dashboard UI;
- metadata;
- numbers;
- labels.

If either font cannot be loaded reliably, fall back to:

```text
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Do not introduce additional font families without updating this document.

---

# 8. TYPE SCALE

Use the following desktop scale as the default.

```text
Display XL   72px / 1.02 / -0.035em / 600
Display      60px / 1.05 / -0.03em  / 600

H1           48px / 1.08 / -0.025em / 600
H2           40px / 1.12 / -0.02em  / 600
H3           32px / 1.18 / -0.015em / 600
H4           24px / 1.25 / -0.01em  / 600
H5           20px / 1.3  / -0.005em / 600

Body Large   18px / 1.65 / 0
Body         16px / 1.6  / 0
Body Small   14px / 1.5  / 0

Label        13px / 1.4  / 0.01em / 600
Caption      12px / 1.4  / 0.01em
Button       14px / 1.2  / 0.005em / 600
```

Do not use Display XL for ordinary page headings.

---

# 9. RESPONSIVE TYPE SCALE

At tablet widths:

```text
Display XL  56px
Display     48px
H1          40px
H2          34px
H3          28px
H4          22px
```

At mobile widths:

```text
Display XL  44px
Display     40px
H1          34px
H2          30px
H3          24px
H4          20px
Body        16px
```

Do not reduce body text below 16px for primary reading content.

---

# 10. SCHOOL WORDMARK

The canonical wordmark treatment is:

```text
VICTORIOUS
CHILDREN SCHOOL
OJODU • LAGOS

Not to Equal, But to Excel
```

Rules:

- “VICTORIOUS” is visually dominant.
- “CHILDREN SCHOOL” supports the primary word.
- “OJODU • LAGOS” establishes location.
- Motto is italicised.
- Keep adequate whitespace around the mark.
- Never distort the logo.
- Never apply arbitrary shadows, gradients or effects.
- Never recreate the logo as ordinary body text when an official logo asset exists.

---

# 11. SPACING SYSTEM

Use a 4px base spacing system.

```text
space-1    4px
space-2    8px
space-3    12px
space-4    16px
space-5    20px
space-6    24px
space-7    28px
space-8    32px
space-10   40px
space-12   48px
space-14   56px
space-16   64px
space-20   80px
space-24   96px
space-28   112px
space-32   128px
```

Do not invent arbitrary spacing values unless necessary. Prefer the spacing scale.

---

# 12. SECTION SPACING

Public website sections:

```text
Desktop: 96px–128px vertical
Tablet:  72px–96px vertical
Mobile:  56px–72px vertical
```

Dense dashboard sections:

```text
Desktop: 48px–64px
Tablet:  40px–56px
Mobile:  32px–48px
```

Use smaller spacing for related content and larger spacing between major narrative sections.

---

# 13. CONTAINER SYSTEM

Use a centred content container.

```text
Maximum width: 1280px
Wide content: 1200–1280px
Reading content: 680–760px
Dashboard content: 1200–1280px
```

Recommended horizontal padding:

```text
Desktop: 32px
Tablet: 24px
Mobile: 20px
```

For very small screens:

```text
Minimum horizontal padding: 16px
```

Never allow important content to touch the viewport edge.

---

# 14. RESPONSIVE BREAKPOINTS

Use these breakpoints consistently:

```text
xs:  0–639px
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```

Primary product targets:

### Mobile
Public website and quick parent/student tasks.

### Tablet
Teacher/staff operational use.

### Desktop
Administration and full website experience.

Do not simply shrink desktop layouts.

---

# 15. GRID SYSTEM

Use a 12-column grid for large screens.

```text
Desktop: 12 columns
Tablet:  8 columns
Mobile:  4 columns
```

Default gap:

```text
Desktop: 24px
Tablet: 20px
Mobile: 16px
```

Use CSS Grid for page-level layout and Flexbox for component-level alignment.

---

# 16. BORDER RADIUS

The visual language should be refined rather than excessively rounded.

```text
radius-sm:   6px
radius-md:  10px
radius-lg:  14px
radius-xl:  18px
radius-full: 9999px
```

Use `sm` for compact controls, `md` for inputs/buttons, `lg` for cards, `xl` only for prominent public sections/media, and `full` for pills/avatars/status indicators.

Avoid applying `rounded-full` to ordinary cards.

---

# 17. BORDERS

Default border:

```text
1px solid #E7E5E4
```

Strong border:

```text
1px solid #D6D3D1
```

Brand border:

```text
1px solid #1A237E
```

Do not outline every section.

Use borders to establish structure, not visual noise.

---

# 18. SHADOWS

Use restrained elevation.

```text
shadow-sm:
0 1px 2px rgba(0,0,0,0.05)

shadow-md:
0 6px 18px rgba(0,0,0,0.08)

shadow-lg:
0 14px 40px rgba(0,0,0,0.10)
```

Use shadows primarily for dropdowns, modals, floating navigation, elevated cards and important interactive surfaces.

Do not give every card a large shadow.

---

# 19. BUTTON SYSTEM

Buttons must communicate hierarchy clearly.

## Primary

Use VCS blue.

```text
Background: #1A237E
Text: #FFFFFF
Radius: 10px
Height: 44px minimum
Horizontal padding: 20px
Font: 14px / 600
```

Hover:

- slightly darker blue;
- subtle elevation;
- no dramatic animation.

## Secondary

```text
Background: transparent or white
Border: #1A237E
Text: #1A237E
```

## Gold accent

Use only for carefully selected premium/achievement actions. Do not make gold the default action colour.

## Destructive

Use VCS red for Delete, Reject and other irreversible operations.

Destructive actions must require confirmation when consequences are meaningful.

## Ghost

Use for tertiary actions, table actions and navigation-adjacent controls.

---

# 20. BUTTON RULES

Every button must have:

- visible label or accessible name;
- hover state;
- keyboard focus state;
- disabled state;
- loading state when asynchronous;
- appropriate icon alignment.

Do not place multiple competing primary buttons in the same small region.

Use one primary action and clear secondary actions.

---

# 21. ICON SYSTEM

Use one consistent icon library.

Recommended:

**Lucide**

Rules:

- default icon size: 18–20px;
- compact UI: 16px;
- prominent action: 20–24px;
- stroke-based icons;
- do not mix random icon families.

Icons must support the text rather than replace important labels.

Do not use emoji as UI icons.

---

# 22. CARDS

### Public card

```text
Background: white
Border: 1px #E7E5E4
Radius: 14px
Padding: 24px
```

### Dashboard card

```text
Background: white
Border: 1px #E7E5E4
Radius: 14px
Padding: 20–24px
```

### Feature card

May use cream background or subtle image treatment.

Avoid making every card visually identical.

---

# 23. CARD RULE

A card must answer:

**Why is this content grouped together?**

Do not place every paragraph inside a card.

Use open layouts for editorial/public storytelling when appropriate.

The VCS public website should retain its editorial character rather than becoming a grid of floating cards.

---

# 24. FORM SYSTEM

All forms must use:

- visible labels;
- required/optional indication;
- helpful descriptions;
- consistent input heights;
- validation;
- keyboard support;
- accessible error messages;
- success feedback.

Recommended control height:

```text
Large:   48px
Default: 44px
Compact: 36px
```

Default input:

```text
Border: #D6D3D1
Radius: 10px
Padding: 12px 14px
Font: 16px
```

Focused input:

```text
Border: #1A237E
Visible focus ring
```

Never rely only on placeholder text as the field label.

---

# 25. FORM LAYOUT

Prefer:

```text
Section heading
↓
Short explanation
↓
Related fields grouped together
↓
Actions
```

For complex forms:

- divide into logical sections;
- use a stepper;
- preserve entered values after ordinary validation errors;
- show progress;
- prevent accidental duplicate submission.

---

# 26. VALIDATION

Validation messages must explain:

- what is wrong;
- where it is wrong;
- how to fix it.

Never expose raw backend errors to ordinary users.

---

# 27. TABLE SYSTEM

Tables are primarily for administrative and academic operations.

Required features where relevant:

- search;
- filtering;
- sorting;
- pagination;
- row actions;
- status;
- selection;
- export where authorised.

Use strong header hierarchy.

Avoid excessive vertical borders.

Recommended:

```text
Header background: #FAFAF9
Header text: #57534E
Body text: #1A1A2E
Row border: #E7E5E4
Row hover: subtle neutral background
```

---

# 28. RESPONSIVE TABLES

Do not squeeze a desktop table onto mobile.

Choose deliberately between:

1. horizontal scrolling;
2. priority-column table;
3. stacked record cards;
4. expandable rows;
5. mobile-specific data presentation.

For complex financial/academic data, preserve data integrity and readability over forcing everything into a tiny screen.

---

# 29. STATUS BADGES

Use badges for concise status.

Examples:

- Active
- Pending
- Approved
- Draft
- Published
- Paid
- Partially Paid
- Overdue
- Present
- Absent
- Late
- Excused

Badges should use semantic colour, subtle background and readable text.

Do not use colour alone to communicate status.

---

# 30. DASHBOARD SYSTEM

All dashboards use a shared shell:

```text
Sidebar / Navigation
        ↓
Top header
        ↓
Page title + context
        ↓
Priority / attention area
        ↓
Primary operational content
        ↓
Recent activity / secondary content
```

Do not use the generic “4 colourful cards + random chart + large table” pattern.

---

# 31. ROLE DASHBOARD PRIORITIES

## Admin

Prioritise:

- school overview;
- students;
- teachers/staff;
- attendance;
- admissions;
- fees;
- payments;
- results awaiting approval;
- announcements;
- events;
- reports;
- audit activity.

## Teacher

Prioritise:

- assigned classes;
- timetable;
- attendance due;
- assignments to grade;
- results to complete;
- announcements;
- students.

## Student

Prioritise:

- timetable;
- assignments;
- published results;
- attendance;
- announcements;
- learning resources.

## Parent

Prioritise:

- child selector;
- child summary;
- attendance;
- results;
- fees;
- payments;
- assignments;
- events;
- announcements;
- receipts.

---

# 32. DASHBOARD QUESTION MODEL

Every dashboard should answer:

1. What requires my attention?
2. What happened recently?
3. What is due soon?
4. What can I do next?

A dashboard that does not answer these questions should be reconsidered.

---

# 33. SIDEBAR

Desktop sidebar:

- stable;
- clear hierarchy;
- role-specific;
- active route obvious;
- collapsible where appropriate.

Do not overload the sidebar with every possible action.

Use grouped navigation:

```text
Overview
Academic
Students
Finance
Communication
Reports
Administration
```

Only show groups relevant to the user's permissions.

---

# 34. TOP BAR

Top bar should contain only useful global controls:

- page/context;
- search where appropriate;
- notifications;
- profile/account;
- contextual action where appropriate.

Do not turn the top bar into a collection of unrelated buttons.

---

# 35. MOBILE/TABLET NAVIGATION

On smaller screens:

- use a clear menu/drawer;
- preserve important actions;
- maintain focus management;
- prevent background interaction while modal navigation is open;
- provide obvious close behaviour.

For teacher/tablet use, navigation must remain fast enough for repeated classroom tasks.

---

# 36. PUBLIC HOMEPAGE TEMPLATE

The homepage follows this conceptual structure:

```text
Header
↓
Hero
↓
Trust / statistics
↓
Why VCS
↓
Academic levels
↓
Admissions CTA
↓
News / events
↓
Activities / gallery
↓
Faith / community
↓
Visit/contact CTA
↓
Footer
```

This reflects the UI/UX brief and the current VCS visual reference.

The current reference site uses an editorial structure around ideas such as:

- “The Standard”
- “The Method”
- “The Character”
- parent commitments
- school news
- admissions

Preserve this type of narrative clarity while making content dynamic and truthful.

---

# 37. PUBLIC HERO TEMPLATE

Hero must communicate immediately:

- Victorious Children School;
- Ojodu • Lagos;
- motto;
- strong school imagery;
- primary action: Apply Now;
- supporting actions: Pay Fees, Check Results, Student Portal.

Recommended composition:

```text
Eyebrow
School name / display headline
Motto
Short supporting statement
Primary CTA + secondary action
Supporting image/media
```

Do not overcrowd the hero.

---

# 38. PUBLIC SECTION TEMPLATE

Each major section should follow:

```text
Eyebrow
Heading
Short explanatory paragraph
Content
Optional CTA
```

Not every section needs all five.

Editorial sections may intentionally break the pattern.

---

# 39. ADMISSIONS PAGE TEMPLATE

```text
Page header
↓
Why choose VCS / admission context
↓
Requirements
↓
Process
↓
Age/class guidance
↓
Application CTA
↓
FAQ
↓
Contact/visit
```

Application flow:

```text
Introduction
→ Guardian
→ Student
→ Academic
→ Documents
→ Review
→ Submit
→ Confirmation
```

Show progress throughout.

---

# 40. ACADEMICS PAGE TEMPLATE

```text
Page header
↓
Academic philosophy
↓
School levels
↓
Curriculum
↓
Teaching approach
↓
Assessment
↓
Learning resources / facilities
↓
CTA
```

Do not turn the academics page into a wall of text.

Use editorial hierarchy.

---

# 41. FEES/PAYMENTS PAGE TEMPLATE

Public payment entry:

```text
Page header
↓
Payment explanation
↓
Student identification
↓
Fee/payment purpose
↓
Amount
↓
Outstanding balance
↓
Payment method
↓
Paystack / bank transfer
↓
Confirmation
↓
Receipt
```

The interface must make payment state unmistakable.

Never imply a payment succeeded before the server verifies it.

---

# 42. RESULTS PAGE TEMPLATE

Public result checker:

```text
Student ID
Academic Session
Term
Secure verification
        ↓
Result summary
```

Do not expose unnecessary personal information.

Authenticated users may receive richer results according to permission.

---

# 43. NEWS TEMPLATE

News listing:

```text
Page header
↓
Featured story
↓
Category/filter
↓
News grid/list
↓
Pagination
```

News detail:

```text
Category
Date
Title
Hero image
Article
Related stories
CTA
```

Do not over-design news cards.

---

# 44. GALLERY TEMPLATE

Use strong image presentation.

Prefer:

- editorial grid;
- album grouping;
- meaningful captions;
- accessible lightbox;
- keyboard controls;
- optimised images.

Avoid endless masonry grids that destroy visual hierarchy.

---

# 45. CONTACT TEMPLATE

Include:

- address;
- phone;
- email;
- school hours where confirmed;
- visit CTA;
- contact form;
- map/location when appropriate.

Never invent contact details.

---

# 46. AUTHENTICATION TEMPLATE

Login should feel secure and calm.

```text
School identity
↓
Welcome / context
↓
Email/username
↓
Password
↓
Forgot password
↓
Sign in
↓
Helpful support text
```

Avoid unnecessary decorative content.

---

# 47. EMPTY STATES

Every major data-driven page must have an intentional empty state.

Structure:

```text
Icon/illustration where useful
Heading
Short explanation
Optional next action
```

Do not use fake records just to avoid empty states.

---

# 48. LOADING STATES

Prefer skeletons when the final layout is known.

Use:

- skeleton rows;
- skeleton cards;
- skeleton text blocks;
- button loading indicators;
- contextual progress.

Do not replace the whole application with a giant spinner.

Preserve layout dimensions to reduce CLS.

---

# 49. ERROR STATES

Use:

```text
What happened
↓
What the user can do
↓
Recovery action
```

Examples:

- Retry
- Go back
- Return to dashboard
- Contact school

Do not expose stack traces, SQL errors or technical internals.

---

# 50. TOASTS

Use toasts for lightweight feedback:

- saved;
- updated;
- copied;
- submitted.

Do not use toasts for critical information that must remain visible.

Critical payment/result/security states belong in the page content.

---

# 51. MODALS AND DIALOGS

Use dialogs for:

- confirmation;
- focused short forms;
- destructive actions;
- quick detail views.

Do not place long workflows inside tiny modals.

For complex workflows use a dedicated page or full-screen responsive sheet.

Dialog requirements:

- focus trap;
- Escape support;
- visible close;
- screen-reader label;
- background interaction blocked;
- return focus to triggering element.

---

# 52. NOTIFICATIONS

Notifications should have:

- category;
- title;
- concise message;
- timestamp;
- read/unread state;
- destination when relevant.

Do not make notifications visually aggressive.

---

# 53. MOTION SYSTEM

Motion must be subtle and purposeful.

Recommended durations:

```text
Fast:    120ms
Normal:  180ms
Slow:    280ms
```

Use:

```text
ease-out for entrances
ease-in for exits
ease-in-out for state transitions
```

Suitable motion:

- fade;
- slide;
- drawer;
- modal;
- hover;
- skeleton;
- small page transitions.

Avoid:

- bouncing;
- spinning decorative objects;
- large parallax effects;
- excessive scroll animation.

Respect `prefers-reduced-motion`.

When reduced motion is enabled, minimise transitions and remove non-essential animation.

---

# 54. ACCESSIBILITY STANDARD

Target WCAG 2.2 AA principles where practical.

Every component must consider:

- semantic HTML;
- keyboard access;
- visible focus;
- colour contrast;
- labels;
- accessible names;
- screen-reader announcements;
- error association;
- focus management;
- reduced motion;
- touch targets.

---

# 55. FOCUS STATES

Never remove browser focus indicators without replacing them.

Recommended:

```text
2px visible focus ring
2px offset
VCS blue or another sufficiently contrasting semantic focus colour
```

Focus must be visible against both light and dark surfaces.

---

# 56. TOUCH TARGETS

Interactive controls should generally have a minimum target of approximately:

```text
44 × 44px
```

Do not create tiny table controls that are difficult to operate on tablets.

---

# 57. CONTRAST

Text must remain readable against its background.

Do not use:

- light gold text on white;
- grey text with insufficient contrast;
- blue text on blue surfaces;
- decorative low-contrast text for important information.

Gold is an accent, not a default body-text colour.

---

# 58. KEYBOARD NAVIGATION

The complete interface must be usable without a mouse.

Test:

- Tab
- Shift+Tab
- Enter
- Space
- Escape
- Arrow keys where appropriate

Ensure logical focus order.

---

# 59. SCREEN READERS

Use:

- semantic headings;
- landmark regions;
- button semantics;
- labels;
- descriptive link names;
- live regions for important asynchronous status;
- appropriate table semantics.

Do not use `<div>` elements as buttons.

---

# 60. IMAGE ACCESSIBILITY

Every meaningful image requires useful alt text.

Decorative images should use empty alt text where appropriate.

Do not repeat adjacent text unnecessarily.

---

# 61. PERFORMANCE DESIGN RULES

Visual quality must not create a slow website.

Use:

- optimised images;
- responsive image sizes;
- lazy loading for below-the-fold media;
- stable image dimensions;
- efficient fonts;
- minimal client-side JavaScript;
- reusable components;
- code splitting where appropriate.

Avoid:

- huge unoptimised hero images;
- loading every gallery image immediately;
- unnecessary animation libraries;
- duplicate UI libraries;
- excessive third-party scripts.

---

# 62. SEO DESIGN RULES

Public pages should support:

- one clear H1;
- logical H2/H3 structure;
- descriptive title;
- meta description;
- canonical URL where appropriate;
- Open Graph metadata;
- meaningful image metadata;
- semantic links.

Do not create headings solely for visual styling.

---

# 63. DATA DENSITY

The public site should breathe.

The admin portal may be denser.

Use different density modes:

### Editorial
Large whitespace, imagery, narrative.

### Operational
Compact but readable.

### Data-heavy
Dense tables, filters and controls while maintaining clear hierarchy.

Do not force public website spacing into administrative tables.

---

# 64. TRUST-CENTRIC DESIGN

For high-trust actions:

### Admissions
Show progress and confirmation.

### Payments
Show amount, purpose and payment status.

### Results
Show session, term and verification context.

### Documents
Show access permissions and file context.

### Account/security
Show clear security feedback.

Users should never have to guess whether an important operation succeeded.

---

# 65. FAITH AND COMMUNITY VISUAL LANGUAGE

Faith content should be:

- tasteful;
- optional where appropriate;
- integrated with the school's identity;
- visually calm.

Do not make dashboards look like religious content feeds.

The public experience may include carefully selected scripture/faith messages, school values, community imagery and character-building content.

---

# 66. CONTENT RULES

Do not invent:

- statistics;
- student numbers;
- achievements;
- testimonials;
- fees;
- bank information;
- school policies;
- examination results;
- staff credentials.

If real data is unavailable, use a clearly marked placeholder in development or an appropriate empty state.

Do not make placeholder data look like verified school facts.

---

# 67. EXISTING VCS WEBSITE REFERENCE RULE

The current website establishes an important editorial tone.

Its visual/content pattern includes:

- strong school identity;
- Ojodu/Lagos context;
- prominent motto;
- school-life imagery;
- numbered narrative sections;
- parent commitments;
- news/events;
- admissions CTA;
- visit/contact CTA.

Preserve the **principles** of this experience.

Do not copy content or fabricate facts from it into the application.

Dynamic production content must come from the application's authoritative data.

---

# 68. PUBLIC WEBSITE PAGE MAP

Canonical public templates:

```text
/
 /about
 /academics
 /admissions
 /activities
 /news
 /news/[slug]
 /gallery
 /results
 /payments
 /contact
 /faq
 /login
```

The actual route structure must follow the existing project architecture.

Do not create duplicate routes merely to implement this visual system.

---

# 69. AUTHENTICATED PAGE MAP

## Admin

```text
/admin
/admin/students
/admin/staff
/admin/academics
/admin/attendance
/admin/results
/admin/fees
/admin/payments
/admin/communication
/admin/documents
/admin/reports
/admin/settings
```

## Teacher

```text
/teacher
/teacher/classes
/teacher/attendance
/teacher/results
/teacher/assignments
/teacher/lesson-notes
/teacher/students
/teacher/messages
```

## Student

```text
/student
/student/timetable
/student/results
/student/attendance
/student/assignments
/student/learning
/student/announcements
/student/profile
```

## Parent

```text
/parent
/parent/children
/parent/fees
/parent/payments
/parent/results
/parent/attendance
/parent/messages
/parent/announcements
/parent/profile
```

Actual implementation must respect the project's canonical route definitions.

---

# 70. COMPONENT NAMING

Prefer clear reusable names.

Examples:

```text
VcsButton
VcsCard
VcsBadge
VcsInput
VcsSelect
VcsModal
VcsTable
VcsEmptyState
VcsLoadingState
VcsPageHeader
VcsSectionHeader
VcsStatCard
VcsStatusBadge
VcsDataTable
VcsSidebar
VcsTopbar
```

If the existing project has an established component naming convention, preserve it rather than introducing a competing convention.

---

# 71. COMPONENT API PRINCIPLES

Components should be:

- predictable;
- composable;
- accessible;
- responsive;
- typed;
- reusable.

Avoid components with dozens of unrelated boolean props.

Prefer composable slots/variants where the framework architecture supports them.

---

# 72. DESIGN TOKENS IN CODE

Do not scatter raw hex values throughout Vue components.

Prefer central tokens.

Bad:

```css
color: #1A237E;
```

inside dozens of unrelated components.

Preferred:

```css
color: var(--color-brand-primary);
```

or the project's equivalent Tailwind token.

This ensures the design system remains maintainable.

---

# 73. NO ARBITRARY TAILWIND

Do not generate long arbitrary-value Tailwind strings for repeated design patterns.

If a value becomes a repeated design rule, promote it to a token/component.

Avoid arbitrary values when a canonical token already exists.

---

# 74. DARK MODE

Dark mode is **not a first-release requirement** unless explicitly enabled by the owner.

Do not implement a separate dark visual language casually.

If dark mode is later requested, extend this design system deliberately rather than automatically inverting colours.

---

# 75. PRINT / DOCUMENT PRESENTATION

Where report cards, receipts or official school documents are generated:

- use high readability;
- preserve school branding;
- avoid unnecessary decorative UI;
- maintain clear hierarchy;
- provide print-safe layouts;
- ensure important information remains visible.

---

# 76. VISUAL QA CHECKLIST

Every production page must pass:

### Brand
- [ ] Correct VCS colours
- [ ] Correct typography
- [ ] Correct wordmark treatment
- [ ] No random visual identity

### Layout
- [ ] Correct container width
- [ ] Consistent spacing
- [ ] Clear hierarchy
- [ ] No awkward overflow

### Components
- [ ] Correct button variants
- [ ] Correct form controls
- [ ] Correct cards
- [ ] Correct badges
- [ ] Correct table behaviour

### Responsive
- [ ] Desktop
- [ ] Laptop
- [ ] Tablet
- [ ] Mobile where applicable

### Accessibility
- [ ] Keyboard
- [ ] Focus
- [ ] Contrast
- [ ] Labels
- [ ] Semantic structure
- [ ] Screen-reader considerations
- [ ] Reduced motion

### States
- [ ] Loading
- [ ] Empty
- [ ] Error
- [ ] Success
- [ ] Disabled

### Performance
- [ ] Images optimised
- [ ] No unnecessary client JS
- [ ] No obvious layout shift
- [ ] No console errors

---

# 77. WORLD-CLASS DESIGN GATE

A page is not complete merely because it works.

It is complete when it passes all five dimensions:

## 1. Visual quality

Does it look deliberately designed?

## 2. UX quality

Can the user understand what to do without unnecessary thinking?

## 3. Accessibility

Can users with different abilities operate it?

## 4. Technical quality

Does it perform reliably without console/build errors?

## 5. Product consistency

Does it clearly belong to the VCS ecosystem?

If any answer is no, continue refinement.

---

# 78. TRAE IMPLEMENTATION RULES

When implementing this design system:

1. Read `03_UI_UX_DESIGN_BRIEF.md`.
2. Read `08_DESIGN_SYSTEM.md`.
3. Inspect existing components before creating new ones.
4. Reuse existing components when they already satisfy the design system.
5. Refactor inconsistent components rather than duplicating them.
6. Do not introduce arbitrary colours.
7. Do not introduce arbitrary fonts.
8. Do not introduce competing UI libraries without explicit approval.
9. Do not create page-specific design systems.
10. Do not break existing application functionality.
11. Test actual browser output.
12. Test responsive layouts.
13. Test accessibility.
14. Test loading, empty, error and success states.
15. Update this document when a new reusable design rule is deliberately introduced.

---

# 79. DESIGN IMPLEMENTATION LOOP

Use:

```text
Inspect
  ↓
Understand
  ↓
Reuse
  ↓
Implement
  ↓
Preview
  ↓
Test
  ↓
Compare with Design Brief
  ↓
Compare with Design System
  ↓
Refine
  ↓
Approve
```

Do not stop at compilation.

---

# 80. FINAL DESIGN PRINCIPLE

The goal is not:

> “Make every page beautiful.”

The goal is:

> “Create one coherent VCS digital experience in which every page feels intentionally designed for the person using it.”

The VCS website and School Management System should feel like one product.

The public website should inspire confidence.

The admissions experience should reduce friction.

The payment experience should create trust.

The academic experience should create clarity.

The dashboards should create operational focus.

The entire system should communicate the school's standard through the quality of its design.

**Not to Equal, But to Excel.**
