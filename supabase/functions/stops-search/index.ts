import { corsHeaders } from '@supabase/supabase-js/cors'

const CSV_URL = 'https://data.wien.gv.at/csv/wienerlinien-ogd-haltestellen.csv';

let cachedStops: { stopId: string; name: string; normalized: string }[] | null = null;

function normalize(str: string): string {
  return str.toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, '');
}

async function loadStops() {
  if (cachedStops) return cachedStops;
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n');
  const header = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  const divaIdx = header.findIndex(h => h === 'DIVA');
  const nameIdx = header.findIndex(h => h === 'NAME');
  const dIdx = divaIdx >= 0 ? divaIdx : 1;
  const nIdx = nameIdx >= 0 ? nameIdx : 2;
  const seen = new Set<string>();
  const results: { stopId: string; name: string; normalized: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/"/g, ''));
    const diva = cols[dIdx]; const name = cols[nIdx];
    if (!diva || !name || seen.has(diva)) continue;
    seen.add(diva);
    results.push({ stopId: diva, name, normalized: normalize(name) });
  }
  cachedStops = results;
  return cachedStops;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { q } = await req.json();
    if (!q || typeof q !== 'string' || q.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stops = await loadStops();
    const normalizedQuery = normalize(q);
    const words = normalizedQuery.split(/\s+/).filter(Boolean);

    const matches = stops
      .filter(s => words.every(w => s.normalized.includes(w)))
      .slice(0, 20)
      .map(({ stopId, name }) => ({ stopId, name }));

    return new Response(JSON.stringify({ results: matches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
