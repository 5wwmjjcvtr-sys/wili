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

// Readable URL: ?fav=stopId:lineName:richtungsId:direction:canonicalToward:transportType:stationOrder:itemOrder[:platform]&...
export function toReadableUrl(container: FavoritesContainer, baseUrl: string): string {
  const url = new URL(baseUrl);
  for (const f of container.favorites) {
    const parts = [f.stopId, f.lineName, f.richtungsId, f.direction, f.canonicalToward, f.transportType, String(f.stationOrder), String(f.itemOrder)];
    if (f.platform) parts.push(f.platform);
    url.searchParams.append('fav', parts.join(':'));
  }
  // Only add non-default prefs
  if (container.prefs.depCount && container.prefs.depCount !== DEFAULTS.depCount) {
    url.searchParams.set('n', String(container.prefs.depCount));
  }
  if (container.prefs.mode && container.prefs.mode !== DEFAULTS.mode) {
    url.searchParams.set('m', container.prefs.mode);
  }
  if (container.prefs.refreshInterval !== undefined && container.prefs.refreshInterval !== DEFAULTS.refreshInterval) {
    url.searchParams.set('r', String(container.prefs.refreshInterval));
  }
  if (container.prefs.theme && container.prefs.theme !== DEFAULTS.theme) {
    url.searchParams.set('t', container.prefs.theme);
  }
  if (container.prefs.showFirstDep === false) {
    url.searchParams.set('sf', '0');
  }
  if (container.prefs.showLastDep === false) {
    url.searchParams.set('sl', '0');
  }
  if (container.prefs.showTime === false) {
    url.searchParams.set('st', '0');
  }
  if (container.prefs.showTimeDiff === false) {
    url.searchParams.set('sd', '0');
  }
  if (container.prefs.showCurrentTime === false) {
    url.searchParams.set('sct', '0');
  }
  if (container.prefs.showUpdatedAt === false) {
    url.searchParams.set('sua', '0');
  }
  return url.toString();
}

export function fromReadableUrl(url: URL): FavoritesContainer | null {
  const favParams = url.searchParams.getAll('fav');
  if (favParams.length === 0) return null;

  const favorites: Favorite[] = favParams.map((param, index) => {
    const parts = param.split(':');
    const [stopId, lineName, richtungsId, direction, canonicalToward, transportType, stationOrderStr, itemOrderStr, platform] = parts;
    return {
      stopId,
      stationTitle: '',
      lineName,
      transportType: (transportType || 'bus') as LineType,
      richtungsId,
      direction,
      directionKey: buildDirectionKey(stopId, lineName, richtungsId, direction),
      canonicalToward,
      platform: platform || undefined,
      allowShortTurns: true,
      stationOrder: parseInt(stationOrderStr, 10) || index,
      itemOrder: parseInt(itemOrderStr, 10) || index,
    };
  });

  const prefs: FavoritesPrefs = {};
  const n = url.searchParams.get('n');
  if (n) prefs.depCount = parseInt(n, 10);
  const m = url.searchParams.get('m');
  if (m === 'direct' || m === 'proxy') prefs.mode = m;
  const r = url.searchParams.get('r');
  if (r) prefs.refreshInterval = parseInt(r, 10);
  const t = url.searchParams.get('t');
  if (t === 'light' || t === 'dark' || t === 'system') prefs.theme = t;
  if (url.searchParams.get('sf') === '0') prefs.showFirstDep = false;
  if (url.searchParams.get('sl') === '0') prefs.showLastDep = false;
  if (url.searchParams.get('st') === '0') prefs.showTime = false;
  if (url.searchParams.get('sd') === '0') prefs.showTimeDiff = false;
  if (url.searchParams.get('sct') === '0') prefs.showCurrentTime = false;
  if (url.searchParams.get('sua') === '0') prefs.showUpdatedAt = false;

  return { v: 1, favorites, prefs };
}

// Encoded URL: ?d=<base64url>
export function toEncodedUrl(container: FavoritesContainer, baseUrl: string): string {
  const compact = {
    v: 1,
    f: container.favorites.map(f => ({
      s: f.stopId,
      l: f.lineName,
      r: f.richtungsId,
      d: f.direction,
      c: f.canonicalToward,
      t: f.transportType,
      o: f.stationOrder,
      i: f.itemOrder,
      ...(f.platform ? { p: f.platform } : {}),
    })),
    ...(Object.keys(container.prefs).length > 0 ? {
      p: {
        ...(container.prefs.depCount && container.prefs.depCount !== DEFAULTS.depCount ? { n: container.prefs.depCount } : {}),
        ...(container.prefs.mode && container.prefs.mode !== DEFAULTS.mode ? { m: container.prefs.mode } : {}),
        ...(container.prefs.refreshInterval !== undefined && container.prefs.refreshInterval !== DEFAULTS.refreshInterval ? { r: container.prefs.refreshInterval } : {}),
        ...(container.prefs.theme && container.prefs.theme !== DEFAULTS.theme ? { t: container.prefs.theme } : {}),
        ...(container.prefs.showFirstDep === false ? { sf: false } : {}),
        ...(container.prefs.showLastDep === false ? { sl: false } : {}),
        ...(container.prefs.showTime === false ? { st: false } : {}),
        ...(container.prefs.showTimeDiff === false ? { sd: false } : {}),
        ...(container.prefs.showCurrentTime === false ? { sct: false } : {}),
        ...(container.prefs.showUpdatedAt === false ? { sua: false } : {}),
      }
    } : {}),
  };

  // Remove empty prefs
  if (compact.p && Object.keys(compact.p).length === 0) delete (compact as any).p;

  const json = JSON.stringify(compact);
  const encoded = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = new URL(baseUrl);
  url.searchParams.set('d', encoded);
  return url.toString();
}

export function fromEncodedUrl(url: URL): FavoritesContainer | null {
  const d = url.searchParams.get('d');
  if (!d) return null;

  try {
    const padded = d.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const compact = JSON.parse(json);
    if (compact?.v !== 1) return null;

    const favorites: Favorite[] = (compact.f || []).map((f: any, index: number) => ({
      stopId: f.s,
      stationTitle: '',
      lineName: f.l,
      transportType: (f.t || 'bus') as LineType,
      richtungsId: f.r,
      direction: f.d,
      directionKey: buildDirectionKey(f.s, f.l, f.r, f.d),
      canonicalToward: f.c,
      platform: f.p || undefined,
      allowShortTurns: true,
      stationOrder: f.o ?? index,
      itemOrder: f.i ?? index,
    }));

    const prefs: FavoritesPrefs = {};
    if (compact.p?.n) prefs.depCount = compact.p.n;
    if (compact.p?.m) prefs.mode = compact.p.m;
    if (compact.p?.r) prefs.refreshInterval = compact.p.r;
    if (compact.p?.t) prefs.theme = compact.p.t;
    if (compact.p?.sf === false) prefs.showFirstDep = false;
    if (compact.p?.sl === false) prefs.showLastDep = false;
    if (compact.p?.st === false) prefs.showTime = false;
    if (compact.p?.sd === false) prefs.showTimeDiff = false;
    if (compact.p?.sct === false) prefs.showCurrentTime = false;
    if (compact.p?.sua === false) prefs.showUpdatedAt = false;

    return { v: 1, favorites, prefs };
  } catch {
    return null;
  }
}

// Parse URL with priority: encoded > readable > null
export function parseUrlFavorites(url: URL): FavoritesContainer | null {
  return fromEncodedUrl(url) ?? fromReadableUrl(url);
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
