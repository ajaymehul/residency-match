// Dev-time generator for src/core/us-cities.json
//
// Builds an offline US cities dataset keyed by `normalize(city)|STATE` with
// { lat, lng } values, derived from the GeoNames gazetteer dumps
// (https://download.geonames.org/export/dump/ US.txt + PR.txt, CC BY 4.0).
//
// This script runs at build/dev time only. The generated JSON is bundled with
// the app so no network calls happen at runtime (Requirement 2.1).
//
// Usage:
//   node scripts/generate-us-cities.mjs /path/to/US.txt[,/path/to/PR.txt] [/path/to/Programs.xlsx]
//
// If Programs.xlsx is provided, the script reports coverage of the program
// cities against the generated dataset.
import { readFileSync, createReadStream, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import * as XLSX from 'xlsx';

const INPUTS = (process.argv[2] ?? '/tmp/geonames/US.txt,/tmp/geonames/PR.txt').split(',');
const PROGRAMS_XLSX = process.argv[3] ?? '';
const OUT = new URL('../src/core/us-cities.json', import.meta.url).pathname;

// Must match normalizeKey in src/core/geocoder.ts:
// lowercase, trim, collapse whitespace, strip periods; state uppercased.
const normalizeCity = (city) =>
  city.toLowerCase().trim().replace(/\./g, '').replace(/\s+/g, ' ');

// GeoNames feature codes for populated places, in priority order (lower = wins
// when two places share the same normalized key).
const FEATURE_PRIORITY = {
  PPLC: 0, // capital
  PPLA: 1, // seat of first-order admin division
  PPLA2: 2,
  PPLA3: 3,
  PPLA4: 4,
  PPL: 5, // populated place
  PPLX: 6, // section of populated place (neighborhoods etc.)
  PPLL: 7, // populated locality
  PPLS: 8,
  PPLW: 9,
  PPLH: 10,
  PPLQ: 11,
  PPLF: 12,
  PPLG: 13,
  STLMT: 14,
};
// Variant (respelled) keys rank below every direct-name key so a real place
// named e.g. "St Paul" always beats a respelling of "Saint Paul".
const VARIANT_PENALTY = 100;

// US state / territory admin1 codes present in GeoNames.
const STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR','VI','GU','AS','MP',
]);

const stripDiacritics = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u02bb\u02bc]/g, '');

// Expand a normalized city name into the spelling variants under which
// programs commonly reference it (St/Saint, Ft/Fort, Mt/Mount, hyphens,
// apostrophes, diacritics, leading "The").
function variantsOf(city) {
  const seen = new Set();
  const queue = [city];
  while (queue.length) {
    const name = queue.pop();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const candidates = [
      stripDiacritics(name),
      name.replace(/-/g, ' ').replace(/\s+/g, ' ').trim(),
      name.replace(/['\u2019]/g, ''),
      name.replace(/\u2019/g, "'"),
      name.replace(/'/g, '\u2019'),
      name.replace(/^the /, ''),
      name.replace(/\bsaint\b/g, 'st'),
      name.replace(/\bst\b/g, 'saint'),
      name.replace(/\bfort\b/g, 'ft'),
      name.replace(/\bft\b/g, 'fort'),
      name.replace(/\bmount\b/g, 'mt'),
      name.replace(/\bmt\b/g, 'mount'),
    ];
    for (const c of candidates) if (c && !seen.has(c)) queue.push(c);
  }
  return seen;
}

// Common name forms not present in the GeoNames name/asciiname columns.
// (Source-data quirks like "tripler amc|HI" belong in the geocoder's
// CITY_ALIASES table instead — these are genuine city name forms.)
const SUPPLEMENTAL = {
  'new york|NY': { lat: 40.71427, lng: -74.00597 }, // GeoNames only has "New York City"
  'commerce township|MI': { lat: 42.59114, lng: -83.49077 }, // official township name; GeoNames has "Commerce"
  'neptune|NJ': { lat: 40.22004, lng: -74.0331 }, // Neptune Township; GeoNames only has "Neptune City"
};

async function main() {
  const best = new Map(); // key -> { lat, lng, rank, population }

  let scanned = 0;
  for (const input of INPUTS) {
    const rl = createInterface({ input: createReadStream(input), crlfDelay: Infinity });
    for await (const line of rl) {
      scanned++;
      const cols = line.split('\t');
      // GeoNames columns: 1=name, 2=asciiname, 4=lat, 5=lng, 6=featureClass,
      // 7=featureCode, 8=countryCode, 10=admin1(state), 14=population
      if (cols[6] !== 'P') continue;
      const priority = FEATURE_PRIORITY[cols[7]];
      if (priority === undefined) continue;
      // PR.txt rows carry country code PR and empty admin1; map to state PR.
      const state = cols[8] === 'PR' ? 'PR' : cols[10];
      if (!STATES.has(state)) continue;
      const lat = Number(cols[4]);
      const lng = Number(cols[5]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const population = Number(cols[14]) || 0;

      const directNames = new Set(
        [cols[1], cols[2]].filter(Boolean).map(normalizeCity),
      );
      const allNames = new Set();
      for (const name of directNames) for (const v of variantsOf(name)) allNames.add(v);

      for (const name of allNames) {
        const rank = directNames.has(name) ? priority : priority + VARIANT_PENALTY;
        const key = `${name}|${state}`;
        const existing = best.get(key);
        // Prefer lower rank; break ties by population.
        if (
          !existing ||
          rank < existing.rank ||
          (rank === existing.rank && population > existing.population)
        ) {
          best.set(key, { lat, lng, rank, population });
        }
      }
    }
  }

  for (const [key, { lat, lng }] of Object.entries(SUPPLEMENTAL)) {
    if (!best.has(key)) best.set(key, { lat, lng, rank: -1, population: 0 });
  }

  const dataset = {};
  for (const key of [...best.keys()].sort()) {
    const { lat, lng } = best.get(key);
    dataset[key] = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
  }

  writeFileSync(OUT, JSON.stringify(dataset));
  console.log(`scanned ${scanned} GeoNames rows`);
  console.log(`wrote ${Object.keys(dataset).length} city entries to ${OUT}`);

  const states = new Set(Object.keys(dataset).map((k) => k.split('|')[1]));
  console.log(`states/territories covered (${states.size}): ${[...states].sort().join(' ')}`);

  if (PROGRAMS_XLSX && existsSync(PROGRAMS_XLSX)) {
    const wb = XLSX.read(readFileSync(PROGRAMS_XLSX));
    const sheets = [
      { name: 'Family Medicine', cityCol: 9, stateCol: 10 },
      { name: 'Internal Medicine', cityCol: 10, stateCol: 11 },
    ];
    const wanted = new Set();
    for (const { name, cityCol, stateCol } of sheets) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
      for (let i = 3; i < rows.length; i++) {
        const city = String(rows[i][cityCol] ?? '').trim();
        const state = String(rows[i][stateCol] ?? '').trim();
        if (city && state) wanted.add(`${normalizeCity(city)}|${state.toUpperCase()}`);
      }
    }
    const missing = [...wanted].filter((k) => !(k in dataset)).sort();
    console.log(`program city coverage: ${wanted.size - missing.length}/${wanted.size}`);
    if (missing.length) console.log('missing keys (CITY_ALIASES candidates):', missing.join(', '));
  }
}

main();
