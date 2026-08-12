// Defaults transcribed from the printed "CO-OP CHORE SCHEDULE & DUTIES" sheet.
// Used to seed an empty install and by the config page's "Load defaults".

const DEFAULT_DUTIES = [
  {
    duty_no: 1,
    name: "Kitchen Duty",
    description:
      "Daily put left-out food & wrappers in garbage or composter; every time the garbage bins are more than 50% full, change them (kitchen compost, garbage & recycling AND Butler's Pantry garbage bin); every other day sweep the floor & spot-mop with sponge mop, and wipe down all countertops (Kitchen, Pantry and Butler's Pantry).",
  },
  {
    duty_no: 2,
    name: "Parlour Duty",
    description:
      "Daily check for garbage and tidy cushions & layout; vacuum carpet & tile after each weekend; clean powder room toilet & sink with Ajax each Monday & Friday.",
  },
  {
    duty_no: 3,
    name: "Yard Duty",
    description:
      "Daily walk the property looking for problems & straighten traffic cones; always pick up solo cups & alcohol containers; cut the grass once (April to October); rake the leaves once (November); shovel the sidewalks as necessary including the public sidewalk (December-March).",
  },
  {
    duty_no: 4,
    name: "2nd Floor Bathroom & Shower",
    description:
      "Daily check for garbage on floors and counters; keep hand soap and toilet paper stocked; sponge-mop floor before & after each weekend (e.g. Monday & Friday); two times use Ajax to clean sinks, toilets, urinals & shower floors and sanitise counters.",
  },
  {
    duty_no: 5,
    name: "Dining Room Duty",
    description:
      "Daily check for garbage on floors and tables; daily straighten furniture; vacuum carpet & hardwood before each weekend; once, clean all ground-floor mirrors including powder room.",
  },
  {
    duty_no: 6,
    name: "Garbage Duty",
    description:
      "Every Monday & Friday empty every single garbage pail and recycling receptacle (including Kitchen & Butler's Pantry) into the outside garbage bins; manually separate recycling materials from garbage as required (3rd floor bathroom, 2nd floor bathroom, deck, powder room, lounge, laundry room, billiards room).",
  },
  {
    duty_no: 7,
    name: "3rd Floor Bathroom Duty",
    description:
      "Daily check for garbage on floors and counters; keep hand soap and toilet paper stocked; sponge-mop floor before & after each weekend (e.g. Monday & Friday); two times use Ajax to clean sinks, toilets, urinals & shower floors and sanitise counters.",
  },
  {
    duty_no: 8,
    name: "Jany Alumni Lounge Duty",
    description:
      "Daily check for garbage on floors and furniture; daily straighten furniture; vacuum carpet & hardwood before each weekend; once a week (twice) use mop & blue bucket (regular detergent, not Murphy Oil) to mop vestibule, foyer, powder room, kitchen & both pantries.",
  },
  {
    duty_no: 9,
    name: "Bar & Lounge Duty",
    description:
      "Daily check for garbage and tidy furniture; sweep and spot-mop with sponge-mop after each weekend including Billiards Room & Laundry Room.",
  },
  {
    duty_no: 10,
    name: "Hall Duty",
    description:
      "Two times (once a week) sweep then sponge-mop the third & second floor hallways and the Servant's Stairwell all the way to the Lounge landing in the basement.",
  },
];

// The beds the printed sheet lists, in its order — which is also the order the
// beds come out of House Config (room sort order, then bed). Used only to line
// DEFAULT_GRID's rows up with real bedrooms.
const DEFAULT_GRID_ROWS = [
  { room_code: "1A", bed: 1 },
  { room_code: "1A", bed: 2 },
  { room_code: "2A", bed: 1 },
  { room_code: "2A", bed: 2 },
  { room_code: "2B", bed: 1 },
  { room_code: "2C", bed: 1 },
  { room_code: "2D", bed: 1 },
  { room_code: "2E", bed: 1 },
  { room_code: "2E", bed: 2 },
  { room_code: "2F", bed: 1 },
  { room_code: "2G", bed: 1 },
  { room_code: "3A", bed: 1 },
  { room_code: "3B", bed: 1 },
  { room_code: "3C", bed: 1 },
  { room_code: "3C", bed: 2 },
  { room_code: "3D", bed: 1 },
  { room_code: "3D", bed: 2 },
  { room_code: "3E", bed: 1 },
  { room_code: "3F", bed: 1 },
  { room_code: "3G", bed: 1 },
];

const DEFAULT_CONFIG = {
  split_day: 16,
  manager_notes: [
    "GAMMA (House Manager) undertakes the following and does not assign them:",
    "• Mail Call: daily slip mail under each resident's bedroom door & do Mail Call for Townsmen during the Monday Chapter Meetings.",
    "• Garbage: take bins out Monday evening by midnight and take bins in Tuesday by midnight; may ask for assistance.",
    "• Captains: recruit & supervise one in-house member for each captaincy below.",
  ].join("\n"),
};

const DEFAULT_CAPTAINS = [
  { captain_key: "wifi", name: "WIFI Captain", description: "Knows how to reset the system.", sort_order: 10 },
  { captain_key: "aquarium", name: "Aquarium Captain", description: "Feeds the fish & keeps the aquarium clean.", sort_order: 20 },
  {
    captain_key: "chapter_room",
    name: "Chapter Room Captain",
    description: "Ideally the Theta; keeps the Chapter Room and Committee Room neat for chapter use.",
    sort_order: 30,
  },
  {
    captain_key: "kitchen_commissar",
    name: "Commissar of the Kitchen",
    description: "Cooks on Work Day & supervises Work Day kitchen deep-cleaning by two neophytes or pledges.",
    sort_order: 40,
  },
  {
    captain_key: "environmental",
    name: "Environmental Captain",
    description:
      "Encourages correct sorting of recycling items, use of the composter, and return of bottles and cans with refundable deposits.",
    sort_order: 50,
  },
];

// The printed schedule itself: one row per bed (in DEFAULT_GRID_ROWS order), 24
// columns running September 1st-half → August 2nd-half. `null` means that bed is
// off duty for that half of the month — each bed works one half-month a month,
// and each half-month covers all ten duties exactly once.
const DEFAULT_GRID = [
  [1, null, 2, null, 3, null, 4, null, 5, null, 6, null, null, 4, 8, null, 9, null, 10, null, 1, null, 2, null],
  [2, null, 3, null, 4, null, 5, null, 6, null, null, 4, 8, null, 9, null, 10, null, 1, null, 2, null, 3, null],
  [3, null, 4, null, 5, null, 6, null, null, 4, 8, null, 9, null, 10, null, 1, null, 2, null, 3, null, 4, null],
  [4, null, 5, null, 6, null, null, 4, 8, null, 9, null, 10, null, 1, null, 2, null, 3, null, 4, null, 5, null],
  [5, null, 6, null, null, 4, 8, null, 9, null, 10, null, 1, null, 2, null, 3, null, 4, null, 5, null, 6, null],
  [6, null, null, 4, 8, null, 9, null, 10, null, 1, null, 2, null, 3, null, 4, null, 5, null, 6, null, null, 4],
  [null, 4, 8, null, 9, null, 10, null, 1, null, 2, null, 3, null, 4, null, 5, null, 6, null, null, 4, 8, null],
  [8, null, 9, null, 10, null, 1, null, 2, null, 3, null, 4, null, 5, null, 6, null, null, 4, 8, null, 9, null],
  [9, null, 10, null, 1, null, 2, null, 3, null, 4, null, 5, null, 6, null, null, 4, 8, null, 9, null, 10, null],
  [10, null, 1, null, 2, null, 3, null, 4, null, 5, null, 6, null, null, 4, 8, null, 9, null, 10, null, 1, null],
  [null, 1, null, 2, null, 3, 7, null, null, 5, null, 6, null, 7, null, 8, null, 9, null, 10, null, 1, null, 2],
  [null, 2, null, 3, 7, null, null, 5, null, 6, null, 7, null, 8, null, 9, null, 10, null, 1, null, 2, null, 3],
  [null, 3, 7, null, null, 5, null, 6, null, 7, null, 8, null, 9, null, 10, null, 1, null, 2, null, 3, 7, null],
  [7, null, null, 5, null, 6, null, 7, null, 8, null, 9, null, 10, null, 1, null, 2, null, 3, 7, null, null, 5],
  [null, 5, null, 6, null, 7, null, 8, null, 9, null, 10, null, 1, null, 2, null, 3, 7, null, null, 5, null, 6],
  [null, 6, null, 7, null, 8, null, 9, null, 10, null, 1, null, 2, null, 3, 7, null, null, 5, null, 6, null, 7],
  [null, 7, null, 8, null, 9, null, 10, null, 1, null, 2, null, 3, 7, null, null, 5, null, 6, null, 7, null, 8],
  [null, 8, null, 9, null, 10, null, 1, null, 2, null, 3, 7, null, null, 5, null, 6, null, 7, null, 8, null, 9],
  [null, 9, null, 10, null, 1, null, 2, null, 3, 7, null, null, 5, null, 6, null, 7, null, 8, null, 9, null, 10],
  [null, 10, null, 1, null, 2, null, 3, 7, null, null, 5, null, 6, null, 7, null, 8, null, 9, null, 10, null, 1],
];

module.exports = { DEFAULT_DUTIES, DEFAULT_GRID_ROWS, DEFAULT_CONFIG, DEFAULT_CAPTAINS, DEFAULT_GRID };
