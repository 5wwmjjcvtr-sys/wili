import { SearchResult } from '@/types/station';

const CSV_URL = 'https://data.wien.gv.at/csv/wienerlinien-ogd-haltestellen.csv';

let cachedStops: SearchResult[] | null = null;
let loadPromise: Promise<SearchResult[]> | null = null;

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

  // Find column indices from header
  const header = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  const divaIdx = header.findIndex(h => h === 'DIVA');
  const nameIdx = header.findIndex(h => h === 'NAME');

  // Fallback indices if headers don't match exactly
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

  loadPromise = fetch(CSV_URL)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load stops: ${res.status}`);
      return res.text();
    })
    .then(text => {
      cachedStops = parseCSV(text);
      return cachedStops;
    })
    .catch(err => {
      loadPromise = null;
      throw err;
    });

  return loadPromise;
}

export function searchStops(stops: SearchResult[], query: string): SearchResult[] {
  if (!query || query.length < 2) return [];

  const normalizedQuery = normalize(query);
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

  const scored = stops
    .map(stop => {
      const normalizedName = normalize(stop.name);
      // All query words must match
      const allMatch = queryWords.every(w => normalizedName.includes(w));
      if (!allMatch) return null;

      // Score: exact match > starts with > contains
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
