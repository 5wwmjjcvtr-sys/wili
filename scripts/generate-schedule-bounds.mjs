/**
 * Generiert public/schedule-bounds.json aus dem WL GTFS-Feed.
 * Wird automatisch als prebuild-Schritt ausgeführt (npm run build).
 *
 * Ausgabeformat: { "DIVA": [{ lineName, towards, firstDeparture, lastDeparture }] }
 */

import { writeFile, readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import unzipper from 'unzipper';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '..', 'public', 'schedule-bounds.json');
const GTFS_URL = 'https://www.wienerlinien.at/ogd_realtime/doku/ogd/gtfs/gtfs.zip';
const HALTESTELLEN_CSV = 'https://data.wien.gv.at/csv/wienerlinien-ogd-haltestellen.csv';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function normName(s) {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Minimaler CSV-Parser (kommasepariert, quoted fields)
function parseCSVRow(line) {
  const result = [];
  let inQuote = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Formatiert GTFS-Zeit (z.B. "24:35:00" → "00:35") – Werte >24h werden auf nächsten Tag umgerechnet
function fmtTime(t) {
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10) % 24;
  return `${String(hour).padStart(2, '0')}:${m}`;
}

// Öffnet eine Datei aus dem ZIP-Buffer und gibt ein readline-Interface zurück
async function openZipEntry(zipDir, entryName) {
  const entry = zipDir.files.find(f => f.path === entryName);
  if (!entry) throw new Error(`${entryName} nicht im ZIP gefunden`);
  const stream = entry.stream();
  return createInterface({ input: stream, crlfDelay: Infinity });
}

// ─── Hauptlogik ───────────────────────────────────────────────────────────────

async function main() {
  // Prüfen ob heute schon generiert wurde (Skip bei lokalem Dev)
  try {
    const existing = JSON.parse(await readFile(OUTPUT, 'utf8'));
    if (existing.__generatedAt) {
      const genDate = existing.__generatedAt.slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      if (genDate === today) {
        console.log(`schedule-bounds.json ist aktuell (${genDate}), überspringe Download.`);
        return;
      }
    }
  } catch {
    // Datei existiert nicht oder ist ungültig – neu generieren
  }

  // 1. Haltestellen-CSV laden → name → DIVA Mapping
  console.log('Lade Haltestellen-CSV...');
  const halteRes = await fetch(HALTESTELLEN_CSV);
  if (!halteRes.ok) throw new Error(`Haltestellen-CSV Fehler: ${halteRes.status}`);
  const halteText = await halteRes.text();

  const nameToDiva = new Map();
  const idToDiva = new Map();
  const halteLines = halteText.split('\n');
  const halteHeader = halteLines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  const divaIdx = halteHeader.findIndex(h => h === 'DIVA');
  const nameIdx = halteHeader.findIndex(h => h === 'NAME');
  const hIdIdx = halteHeader.findIndex(h => h === 'HALTESTELLEN_ID');
  for (let i = 1; i < halteLines.length; i++) {
    const cols = halteLines[i].split(';').map(c => c.trim().replace(/"/g, ''));
    const diva = cols[divaIdx];
    const name = cols[nameIdx];
    const hId = cols[hIdIdx];
    if (diva && name) nameToDiva.set(normName(name), diva);
    if (diva && hId) idToDiva.set(hId, diva);
  }
  console.log(`${nameToDiva.size} Haltestellen geladen.`);

  // 2. GTFS-ZIP laden
  console.log('Lade WL GTFS-ZIP (ca. 55 MB)...');
  const gtfsRes = await fetch(GTFS_URL);
  if (!gtfsRes.ok) throw new Error(`GTFS-Download Fehler: ${gtfsRes.status}`);
  const gtfsBuffer = Buffer.from(await gtfsRes.arrayBuffer());
  console.log(`GTFS geladen: ${(gtfsBuffer.length / 1024 / 1024).toFixed(1)} MB`);

  const zipDir = await unzipper.Open.buffer(gtfsBuffer);

  // 3. stops.txt → stop_id / parent_station → DIVA Mapping
  console.log('Parse stops.txt...');
  const stopIdToDiva = new Map(); // stop_id → DIVA
  {
    const rl = await openZipEntry(zipDir, 'stops.txt');
    let header = null;
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (!header) { header = parseCSVRow(line); continue; }
      const row = parseCSVRow(line);
      const get = col => row[header.indexOf(col)] ?? '';
      const stopId = get('stop_id');
      const stopName = get('stop_name');
      const stopCode = get('stop_code');
      const parentStation = get('parent_station') || stopId;

      // Strategie 1: stop_id direkt als DIVA (oder HALTESTELLEN_ID)
      let diva = idToDiva.get(stopId) ?? idToDiva.get(parentStation);
      // Strategie 2: stop_code als DIVA
      if (!diva && stopCode) diva = idToDiva.get(stopCode);
      // Strategie 3: Name-Matching
      if (!diva) diva = nameToDiva.get(normName(stopName));

      if (diva) stopIdToDiva.set(stopId, diva);
    }
  }
  console.log(`${stopIdToDiva.size} Stops gemappt.`);

  // 4. routes.txt → route_id → Linienname
  console.log('Parse routes.txt...');
  const routeIdToName = new Map();
  {
    const rl = await openZipEntry(zipDir, 'routes.txt');
    let header = null;
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (!header) { header = parseCSVRow(line); continue; }
      const row = parseCSVRow(line);
      const get = col => row[header.indexOf(col)] ?? '';
      routeIdToName.set(get('route_id'), get('route_short_name'));
    }
  }

  // 5. calendar.txt → Werktags-Service-IDs
  console.log('Parse calendar.txt...');
  const weekdayServices = new Set();
  {
    const rl = await openZipEntry(zipDir, 'calendar.txt');
    let header = null;
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (!header) { header = parseCSVRow(line); continue; }
      const row = parseCSVRow(line);
      const get = col => row[header.indexOf(col)] ?? '';
      const isWeekday = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        .some(d => get(d) === '1');
      if (isWeekday) weekdayServices.add(get('service_id'));
    }
  }
  console.log(`${weekdayServices.size} Werktags-Services gefunden.`);

  // 6. trips.txt → trip_id → { routeName, headsign }
  console.log('Parse trips.txt...');
  const tripInfo = new Map();
  {
    const rl = await openZipEntry(zipDir, 'trips.txt');
    let header = null;
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (!header) { header = parseCSVRow(line); continue; }
      const row = parseCSVRow(line);
      const get = col => row[header.indexOf(col)] ?? '';
      const serviceId = get('service_id');
      if (!weekdayServices.has(serviceId)) continue;
      tripInfo.set(get('trip_id'), {
        routeName: routeIdToName.get(get('route_id')) ?? '',
        headsign: get('trip_headsign'),
      });
    }
  }
  console.log(`${tripInfo.size} Werktags-Fahrten geladen.`);

  // 7. stop_times.txt streaming → erste/letzte Abfahrt je (DIVA, Linie, Richtung)
  console.log('Parse stop_times.txt (groß, bitte warten)...');
  const bounds = new Map(); // "diva|routeName|headsign" → { diva, routeName, headsign, first, last }
  {
    const rl = await openZipEntry(zipDir, 'stop_times.txt');
    let header = null;
    let count = 0;
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (!header) { header = parseCSVRow(line); continue; }
      const row = parseCSVRow(line);
      const get = col => row[header.indexOf(col)] ?? '';

      const tripId = get('trip_id');
      const trip = tripInfo.get(tripId);
      if (!trip) continue;

      const stopId = get('stop_id');
      const diva = stopIdToDiva.get(stopId);
      if (!diva) continue;

      const depTime = get('departure_time');
      if (!depTime) continue;

      const key = `${diva}|${trip.routeName}|${trip.headsign}`;
      const ex = bounds.get(key);
      if (!ex) {
        bounds.set(key, { diva, routeName: trip.routeName, headsign: trip.headsign, first: depTime, last: depTime });
      } else {
        if (depTime < ex.first) ex.first = depTime;
        if (depTime > ex.last) ex.last = depTime;
      }

      if (++count % 2_000_000 === 0) console.log(`  ${count.toLocaleString()} Zeilen verarbeitet...`);
    }
    console.log(`  ${count.toLocaleString()} Zeilen gesamt.`);
  }

  // 8. Ausgabe-JSON aufbauen
  const output = { __generatedAt: new Date().toISOString() };
  for (const { diva, routeName, headsign, first, last } of bounds.values()) {
    if (!output[diva]) output[diva] = [];
    output[diva].push({
      lineName: routeName,
      towards: headsign,
      firstDeparture: fmtTime(first),
      lastDeparture: fmtTime(last),
    });
  }

  const stopCount = Object.keys(output).length - 1; // -1 für __generatedAt
  await writeFile(OUTPUT, JSON.stringify(output));
  console.log(`✓ schedule-bounds.json generiert: ${stopCount} Haltestellen.`);
}

main().catch(err => {
  console.error('Fehler beim Generieren:', err.message);
  process.exit(1);
});
