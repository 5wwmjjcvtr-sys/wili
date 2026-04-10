import { supabase } from '@/integrations/supabase/client';
import { ScheduleBounds, StationView } from '@/types/station';

interface ScheduleBoundsEntry {
  lineName: string;
  towards: string;
  firstDeparture: string;
  lastDeparture: string;
}

const moduleCache = new Map<string, ScheduleBoundsEntry[]>();

export async function fetchScheduleBounds(stopId: string): Promise<ScheduleBoundsEntry[]> {
  if (moduleCache.has(stopId)) return moduleCache.get(stopId)!;
  try {
    const { data, error } = await supabase.functions.invoke('schedule-bounds', {
      body: { stopId },
    });
    if (error) throw error;
    const result: ScheduleBoundsEntry[] = data?.bounds ?? [];
    moduleCache.set(stopId, result);
    return result;
  } catch {
    return [];
  }
}

/**
 * Fuzzy-match schedule bounds entries to directions in a StationView.
 * Modifies the stationView in place by adding scheduleBounds to matching directions.
 */
/** Normalize a headsign for comparison: lowercase, strip "wien " prefix, trim */
function norm(s: string): string {
  return s.toLowerCase().replace(/^wien\s+/, '').trim();
}

/**
 * Fuzzy-match schedule bounds entries to directions in a StationView.
 * Modifies the stationView in place by adding scheduleBounds to matching directions.
 */
export function mergeScheduleBounds(
  stationView: StationView,
  bounds: ScheduleBoundsEntry[]
): StationView {
  // Build lookup: lineName -> normalized towards -> bounds
  const lookup = new Map<string, Map<string, { first: string; last: string }>>();
  for (const b of bounds) {
    if (!lookup.has(b.lineName)) lookup.set(b.lineName, new Map());
    lookup.get(b.lineName)!.set(norm(b.towards), {
      first: b.firstDeparture,
      last: b.lastDeparture,
    });
  }

  return {
    ...stationView,
    lineGroups: stationView.lineGroups.map((lg) => ({
      ...lg,
      directions: lg.directions.map((dir) => {
        const lineEntries = lookup.get(lg.name);
        if (!lineEntries) return dir;

        const dirNorm = norm(dir.towards);

        // 1. Exact match (after normalization)
        let match = lineEntries.get(dirNorm);

        // 2. Substring match (either direction)
        if (!match) {
          for (const [key, val] of lineEntries) {
            if (key.includes(dirNorm) || dirNorm.includes(key)) {
              match = val;
              break;
            }
          }
        }

        // 3. Word overlap: pick best match by shared word count
        if (!match) {
          const dirWords = new Set(dirNorm.split(/[\s/,.-]+/).filter(Boolean));
          let bestScore = 0;
          for (const [key, val] of lineEntries) {
            const keyWords = key.split(/[\s/,.-]+/).filter(Boolean);
            const overlap = keyWords.filter(w => dirWords.has(w)).length;
            if (overlap > bestScore) {
              bestScore = overlap;
              match = val;
            }
          }
          // Require at least 1 word overlap
          if (bestScore === 0) match = undefined;
        }

        if (match) {
          return {
            ...dir,
            scheduleBounds: {
              firstDeparturePlanned: match.first,
              lastDeparturePlanned: match.last,
            },
          };
        }
        return dir;
      }),
    })),
  };
}
