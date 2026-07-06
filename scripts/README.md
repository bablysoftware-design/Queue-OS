# Queue OS — Business Importer

Reusable CSV/Excel importer for seeding businesses as unclaimed listings.

## Setup

Install the only required dependency:
```bash
npm install xlsx
```

Create a `.env` file in the project root:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  (service role key, not anon key)
```

## Usage

```bash
# Dry run first — see what would be inserted without writing anything
node scripts/import-businesses.js --file data/rawalpindi.xlsx --city Rawalpindi --dry-run

# Actual import
node scripts/import-businesses.js --file data/rawalpindi.xlsx --city Rawalpindi

# With country
node scripts/import-businesses.js --file data/dubai.xlsx --city Dubai --country UAE

# CSV works too
node scripts/import-businesses.js --file data/lahore.csv --city Lahore
```

## Expected Columns

Column names are **case-insensitive** and matched by keyword — exact names don't matter.

| Data | Accepted column names |
|---|---|
| **Business name** (required) | `Name`, `Business Name`, `Shop Name` |
| **Category** (required) | `Category`, `Type`, `Business Type` |
| Area | `Area`, `Neighbourhood`, `Locality`, `Sector` |
| Address | `Address`, `Location` |
| Phone | `Phone`, `WhatsApp`, `Contact`, `Mobile` |
| Description | `Description`, `About` |
| Opening hours | `Hours`, `Timing`, `Opening Hours` |

## Category Auto-Mapping

The importer automatically normalises varied category names into the system's canonical categories:

| Canonical | Matched keywords |
|---|---|
| `hospital` | hospital, cardiac, surgical, trauma, cancer… |
| `clinic` | clinic, medical center, maternity, obs/gyne… |
| `lab` | lab, diagnostic, pathology, radiology, imaging… |
| `dental` | dental, dentist, orthodontic… |
| `pharmacy` | pharmacy, chemist, drug store… |
| `skin` | skin, aesthetic, laser, plastic, cosmet… |
| `salon` | salon, barber, hair, spa… |
| `restaurant` | restaurant, cafe, food, bakery… |
| `workshop` | workshop, mechanic, repair, garage… |

## What gets created

Each imported business is created as:
- `is_claimed = false` — appears in directory, shows "Unclaim" badge
- `is_active = false` — not live until claimed and activated
- `owner_phone` — real phone if available, otherwise a unique placeholder
- `slug` — auto-generated from name + city

## Re-running is safe

The importer uses `Prefer: resolution=ignore-duplicates` — running the same file twice will skip already-inserted rows without errors.

## Adding a new city

```bash
node scripts/import-businesses.js --file data/karachi.xlsx --city Karachi
node scripts/import-businesses.js --file data/riyadh.xlsx --city Riyadh --country "Saudi Arabia"
node scripts/import-businesses.js --file data/london.xlsx --city London --country UK
```

That's it. No SQL files. No manual slug generation. No duplicate handling.
