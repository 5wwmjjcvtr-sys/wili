import { SearchResult } from '@/types/station';

const HALTESTELLEN_CSV = 'https://data.wien.gv.at/csv/wienerlinien-ogd-haltestellen.csv';
const STEIGE_CSV = 'https://data.wien.gv.at/csv/wienerlinien-ogd-steige.csv';

let cachedStops: SearchResult[] | null = null;
let loadPromise: Promise<SearchResult[]> | null = null;

// DIVA -> RBL numbers mapping
let rblMap: Map<string, string[]> | null = null;
let rblPromise: Promise<Map<string, string[]>> | null = null;

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, '');
}

function parseCSV(text: string): SearchResult[] {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  const divaIdx = header.findIndex(h => h === 'DIVA');
  const nameIdx = header.findIndex(h => h === 'NAME');
  const dIdx = divaIdx >= 0 ? divaIdx : 1;
  const nIdx = nameIdx >= 0 ? nameIdx : 2;

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/"/g, ''));
    const diva = cols[dIdx];
    const name = cols[nIdx];
    if (!diva || !name || seen.has(diva)) continue;
    seen.add(diva);
    results.push({ stopId: diva, name });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function loadStops(): Promise<SearchResult[]> {
  if (cachedStops) return cachedStops;
  if (loadPromise) return loadPromise;

  loadPromise = fetch(HALTESTELLEN_CSV)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load stops: ${res.status}`);
      return res.text();
    })
    .then(text => {
      cachedStops = parseCSV(text);
      return cachedStops;
    })
    .catch(err => {
      console.error('stops-loader fetch failed:', err);
      loadPromise = null;
      throw err;
    });

  return loadPromise;
}

export async function loadRblMapping(): Promise<Map<string, string[]>> {
  if (rblMap) return rblMap;
  if (rblPromise) return rblPromise;

  rblPromise = (async () => {
    const [halteRes, steigeRes] = await Promise.all([
      fetch(HALTESTELLEN_CSV),
      fetch(STEIGE_CSV),
    ]);
    if (!halteRes.ok) throw new Error(`Haltestellen CSV: ${halteRes.status}`);
    if (!steigeRes.ok) throw new Error(`Steige CSV: ${steigeRes.status}`);

    const [halteText, steigeText] = await Promise.all([halteRes.text(), steigeRes.text()]);

    // HALTESTELLEN_ID -> DIVA
    const haltIdToDiva = new Map<string, string>();
    const halteLines = halteText.split('\n');
    const halteHeader = halteLines[0].split(';').map(h => h.trim().replace(/"/g, ''));
    const hIdIdx = halteHeader.findIndex(h => h === 'HALTESTELLEN_ID');
    const divaIdx = halteHeader.findIndex(h => h === 'DIVA');
    for (let i = 1; i < halteLines.length; i++) {
      const cols = halteLines[i].split(';').map(c => c.trim().replace(/"/g, ''));
      const hId = cols[hIdIdx >= 0 ? hIdIdx : 0];
      const diva = cols[divaIdx >= 0 ? divaIdx : 2];
      if (hId && diva) haltIdToDiva.set(hId, diva);
    }

    // DIVA -> RBL[]
    const result = new Map<string, string[]>();
    const steigeLines = steigeText.split('\n');
    const steigeHeader = steigeLines[0].split(';').map(h => h.trim().replace(/"/g, ''));
    const fkHaltIdx = steigeHeader.findIndex(h => h === 'FK_HALTESTELLEN_ID');
    const rblIdx = steigeHeader.findIndex(h => h === 'RBL_NUMMER');

    const seenRbl = new Set<string>();
    for (let i = 1; i < steigeLines.length; i++) {
      const cols = steigeLines[i].split(';').map(c => c.trim().replace(/"/g, ''));
      const fkHalt = cols[fkHaltIdx >= 0 ? fkHaltIdx : 2];
      const rbl = cols[rblIdx >= 0 ? rblIdx : 5];
      if (!fkHalt || !rbl) continue;
      const diva = haltIdToDiva.get(fkHalt);
      if (!diva) continue;
      const key = `${diva}_${rbl}`;
      if (seenRbl.has(key)) continue;
      seenRbl.add(key);
      if (!result.has(diva)) result.set(diva, []);
      result.get(diva)!.push(rbl);
    }

    rblMap = result;
    return result;
  })().catch(err => {
    console.error('stops-loader fetch failed:', err);
    rblPromise = null;
    throw err;
  });

  return rblPromise;
}

export function searchStops(stops: SearchResult[], query: string): SearchResult[] {
  if (!query || query.length < 2) return [];

  const normalizedQuery = normalize(query);
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

  const scored = stops
    .map(stop => {
      const normalizedName = normalize(stop.name);
      const allMatch = queryWords.every(w => normalizedName.includes(w));
      if (!allMatch) return null;

      let score = 0;
      if (normalizedName === normalizedQuery) score = 100;
      else if (normalizedName.startsWith(normalizedQuery)) score = 80;
      else if (normalizedName.startsWith(queryWords[0])) score = 60;
      else score = 40;

      return { stop, score };
    })
    .filter(Boolean) as { stop: SearchResult; score: number }[];

  return scored
    .sort((a, b) => b.score - a.score || a.stop.name.localeCompare(b.stop.name, 'de'))
    .slice(0, 20)
    .map(s => s.stop);
}
