import { supabase } from '@/integrations/supabase/client';
import { ScheduleBounds, StationView } from '@/types/station';

interface ScheduleBoundsEntry {
  lineName: string;
  towards: string;
  firstDeparture: string;
  lastDeparture: string;
}

export async function fetchScheduleBounds(stopId: string): Promise<ScheduleBoundsEntry[]> {
  try {
    const { data, error } = await supabase.functions.invoke('schedule-bounds', {
      body: { stopId },
    });
    if (error) throw error;
    return data?.bounds ?? [];
  } catch {
    return [];
  }
}

/**
 * Fuzzy-match schedule bounds entries to directions in a StationView.
 * Modifies the stationView in place by adding scheduleBounds to matching directions.
 */
export function mergeScheduleBounds(
  stationView: StationView,
  bounds: ScheduleBoundsEntry[]
): StationView {
  // Build lookup: lineName -> towards (lowercase) -> bounds
  const lookup = new Map<string, Map<string, { first: string; last: string }>>();
  for (const b of bounds) {
    if (!lookup.has(b.lineName)) lookup.set(b.lineName, new Map());
    lookup.get(b.lineName)!.set(b.towards.toLowerCase(), {
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

        // Try exact match first
        const dirTowards = dir.towards.toLowerCase();
        let match = lineEntries.get(dirTowards);

        // Fuzzy: check if any GTFS headsign contains or is contained by the direction towards
        if (!match) {
          for (const [key, val] of lineEntries) {
            if (key.includes(dirTowards) || dirTowards.includes(key)) {
              match = val;
              break;
            }
          }
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
