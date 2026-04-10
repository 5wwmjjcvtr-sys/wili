import { LineType } from '@/types/station';

export interface Favorite {
  stopId: string;
  stationTitle: string;
  lineName: string;
  transportType: LineType;
  richtungsId: string;
  direction: string;
  directionKey: string; // e.g. "at:49:1234|U1|1|Leopoldau" (stopId-scoped)
  canonicalToward: string;
  platform?: string;
  allowShortTurns: boolean;
  stationOrder: number;
  itemOrder: number;
}

export interface FavoritesPrefs {
  depCount?: number; // default 3
  mode?: 'direct' | 'proxy'; // default 'direct'
  refreshInterval?: number; // default 30
  theme?: 'light' | 'dark' | 'system'; // default 'system'
  showFirstDep?: boolean; // default true
  showLastDep?: boolean; // default true
  showTime?: boolean; // default true
  showTimeDiff?: boolean; // default true
  showCurrentTime?: boolean; // default true
  showUpdatedAt?: boolean; // default true
}

export interface FavoritesContainer {
  v: 1;
  favorites: Favorite[];
  prefs: FavoritesPrefs;
}

const STORAGE_KEY = 'wl-favorites';
const DEFAULTS: Required<FavoritesPrefs> = { depCount: 3, mode: 'direct', refreshInterval: 30, theme: 'system', showFirstDep: true, showLastDep: true, showTime: true, showTimeDiff: true, showCurrentTime: true, showUpdatedAt: true };

// ─── LocalStorage ───

export function loadFromStorage(): FavoritesContainer {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.v === 1) {
        // Always rebuild directionKey so old favorites (without stopId) are migrated
        return {
          ...parsed,
          favorites: (parsed.favorites ?? []).map((f: Favorite) => ({
            ...f,
            directionKey: buildDirectionKey(f.stopId, f.lineName, f.richtungsId, f.direction),
          })),
        };
      }
    }
  } catch {}
  return { v: 1, favorites: [], prefs: {} };
}

export function saveToStorage(container: FavoritesContainer) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(container));
}

// ─── Direction key builder ───

// Format: "stopId|lineName|richtungsId|direction"  (station-scoped)
export function buildDirectionKey(stopId: string, lineName: string, richtungsId: string, direction: string): string {
  return `${stopId}|${lineName}|${richtungsId}|${direction}`;
}

// ─── URL Serialization ───

// ─── Transport-Type Kodierung (1 Zeichen) ────────────────────────────────────
const TYPE_ENC: Record<string, string> = { metro: 'm', tram: 't', bus: 'b', nightline: 'n' };
const TYPE_DEC: Record<string, LineType> = { m: 'metro', t: 'tram', b: 'bus', n: 'nightline' };

// ─── deflate-raw Komprimierung (CompressionStream, alle modernen Browser) ────
async function deflateBytes(input: Uint8Array): Promise<string> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(input);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return btoa(String.fromCharCode(...out)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function inflateBytes(b64: string): Promise<Uint8Array> {
  const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function buildPrefsCompact(prefs: FavoritesPrefs) {
  return {
    ...(prefs.depCount && prefs.depCount !== DEFAULTS.depCount ? { n: prefs.depCount } : {}),
    ...(prefs.mode && prefs.mode !== DEFAULTS.mode ? { m: prefs.mode } : {}),
    ...(prefs.refreshInterval !== undefined && prefs.refreshInterval !== DEFAULTS.refreshInterval ? { r: prefs.refreshInterval } : {}),
    ...(prefs.theme && prefs.theme !== DEFAULTS.theme ? { t: prefs.theme } : {}),
    ...(prefs.showFirstDep === false ? { sf: false } : {}),
    ...(prefs.showLastDep === false ? { sl: false } : {}),
    ...(prefs.showTime === false ? { st: false } : {}),
    ...(prefs.showTimeDiff === false ? { sd: false } : {}),
    ...(prefs.showCurrentTime === false ? { sct: false } : {}),
    ...(prefs.showUpdatedAt === false ? { sua: false } : {}),
  };
}

function parsePrefsCompact(p: any): FavoritesPrefs {
  const prefs: FavoritesPrefs = {};
  if (p?.n) prefs.depCount = p.n;
  if (p?.m) prefs.mode = p.m;
  if (p?.r !== undefined) prefs.refreshInterval = p.r;
  if (p?.t) prefs.theme = p.t;
  if (p?.sf === false) prefs.showFirstDep = false;
  if (p?.sl === false) prefs.showLastDep = false;
  if (p?.st === false) prefs.showTime = false;
  if (p?.sd === false) prefs.showTimeDiff = false;
  if (p?.sct === false) prefs.showCurrentTime = false;
  if (p?.sua === false) prefs.showUpdatedAt = false;
  return prefs;
}

// Encoded URL: ?d=<compressed-base64url>
// Format: {"f":[{s,l,r,c,t,d?,p?},...], "p"?:{prefs}}
export async function toEncodedUrl(container: FavoritesContainer, baseUrl: string): Promise<string> {
  const sorted = [...container.favorites].sort(
    (a, b) => a.stationOrder - b.stationOrder || a.itemOrder - b.itemOrder
  );

  const prefsCompact = buildPrefsCompact(container.prefs);
  const compact: any = {
    f: sorted.map(f => {
      const entry: any = {
        s: f.stopId,
        l: f.lineName,
        r: f.richtungsId,
        c: f.canonicalToward,
        t: TYPE_ENC[f.transportType] ?? f.transportType,
      };
      if (f.direction !== f.canonicalToward) entry.d = f.direction;
      if (f.platform) entry.p = f.platform;
      return entry;
    }),
  };
  if (Object.keys(prefsCompact).length > 0) compact.p = prefsCompact;

  const compressed = await deflateBytes(new TextEncoder().encode(JSON.stringify(compact)));
  const url = new URL(baseUrl);
  url.searchParams.set('d', compressed);
  return url.toString();
}

export async function fromEncodedUrl(url: URL): Promise<FavoritesContainer | null> {
  const d = url.searchParams.get('d');
  if (!d) return null;

  try {
    const bytes = await inflateBytes(d);
    const compact = JSON.parse(new TextDecoder().decode(bytes));
    if (!compact?.f) return null;

    const stationOrderMap = new Map<string, number>();
    const itemCountMap = new Map<string, number>();
    let nextStation = 0;

    const favorites: Favorite[] = (compact.f || []).map((f: any) => {
      if (!stationOrderMap.has(f.s)) {
        stationOrderMap.set(f.s, nextStation++);
        itemCountMap.set(f.s, 0);
      }
      const stationOrder = stationOrderMap.get(f.s)!;
      const itemOrder = itemCountMap.get(f.s)!;
      itemCountMap.set(f.s, itemOrder + 1);

      const direction = f.d ?? f.c;
      const transportType = (TYPE_DEC[f.t] ?? f.t ?? 'bus') as LineType;
      return {
        stopId: f.s,
        stationTitle: '',
        lineName: f.l,
        transportType,
        richtungsId: f.r,
        direction,
        directionKey: buildDirectionKey(f.s, f.l, f.r, direction),
        canonicalToward: f.c,
        platform: f.p || undefined,
        allowShortTurns: true,
        stationOrder,
        itemOrder,
      };
    });

    return { v: 1, favorites, prefs: parsePrefsCompact(compact.p) };
  } catch {
    return null;
  }
}

export async function parseUrlFavorites(url: URL): Promise<FavoritesContainer | null> {
  return fromEncodedUrl(url);
}

export function getEffectiveDepCount(prefs: FavoritesPrefs): number {
  return prefs.depCount ?? DEFAULTS.depCount;
}

export function getEffectiveMode(prefs: FavoritesPrefs): 'direct' | 'proxy' {
  return prefs.mode ?? DEFAULTS.mode;
}

export function getEffectiveRefreshInterval(prefs: FavoritesPrefs): number {
  return prefs.refreshInterval ?? DEFAULTS.refreshInterval;
}

export function getEffectiveTheme(prefs: FavoritesPrefs): 'light' | 'dark' | 'system' {
  return prefs.theme ?? DEFAULTS.theme;
}

// Check if a departure is a short turn (towards differs from canonical)
export function isShortTurn(towards: string, canonicalToward: string): boolean {
  if (!canonicalToward || !towards) return false;
  return towards.trim().toLowerCase() !== canonicalToward.trim().toLowerCase();
}
