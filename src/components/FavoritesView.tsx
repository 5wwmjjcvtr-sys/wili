import { useState, useEffect, useCallback, useRef } from 'react';
import { useFavorites } from '@/providers/FavoritesContext';
import { useDataProvider } from '@/providers/ProviderContext';
import { Favorite, isShortTurn, getEffectiveDepCount } from '@/lib/favorites';
import { StationView, LineGroup, Direction } from '@/types/station';
import { DepartureRow } from './DepartureRow';
import { ShareLinks } from './ShareLinks';
import { Star, RefreshCw, Trash2, ChevronUp, ChevronDown, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchScheduleBounds, mergeScheduleBounds } from '@/lib/schedule-bounds';

const UBAHN_COLORS: Record<string, string> = {
  U1: '#ED1C24', U2: '#A666B0', U3: '#F58220',
  U4: '#00A651', U5: '#A6C73A', U6: '#A8743A',
};

export function FavoritesView() {
  const { favorites, prefs, removeFavorite, moveStation, moveItem } = useFavorites();
  const { provider } = useDataProvider();
  const [stationViews, setStationViews] = useState<Map<string, StationView>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const boundsCache = useRef<Map<string, any[]>>(new Map());

  const depCount = getEffectiveDepCount(prefs);

  const loadFavorites = useCallback(async () => {
    if (favorites.length === 0) return;
    setLoading(true);
    setError(null);

    // Group by stopId
    const stopIds = [...new Set(favorites.map(f => f.stopId))];

    try {
      const results = await Promise.all(
        stopIds.map(async (stopId) => {
          const view = await provider.getStationView(stopId);
          // Fetch schedule bounds if not cached
          if (!boundsCache.current.has(stopId)) {
            try {
              const bounds = await fetchScheduleBounds(stopId);
              boundsCache.current.set(stopId, bounds);
            } catch {}
          }
          const cached = boundsCache.current.get(stopId);
          const merged = cached ? mergeScheduleBounds(view, cached) : view;
          return [stopId, merged] as const;
        })
      );

      const newMap = new Map<string, StationView>();
      for (const [stopId, view] of results) {
        newMap.set(stopId, view);
      }
      setStationViews(newMap);
    } catch (e: any) {
      setError(e.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [favorites, provider]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  if (favorites.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-3">
        <Star className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm text-center">
          Noch keine Favoriten gesetzt. Wähle eine Station und tippe auf den Stern neben einer Richtung.
        </p>
      </div>
    );
  }

  // Group favorites by station, sorted by stationOrder then itemOrder
  const sortedFavorites = [...favorites].sort((a, b) => a.stationOrder - b.stationOrder || a.itemOrder - b.itemOrder);
  const groupedByStation = new Map<string, Favorite[]>();
  for (const fav of sortedFavorites) {
    const existing = groupedByStation.get(fav.stopId) || [];
    existing.push(fav);
    groupedByStation.set(fav.stopId, existing);
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground">{favorites.length} Favorit{favorites.length !== 1 ? 'en' : ''}</span>
        <Button variant="ghost" size="sm" onClick={loadFavorites} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="px-4 py-3">
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        </div>
      )}

      {loading && stationViews.size === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      <div className="px-4 py-3 space-y-3">
        {Array.from(groupedByStation.entries()).map(([stopId, favs]) => {
          const view = stationViews.get(stopId);
          const stationTitle = favs[0]?.stationTitle || view?.station?.title || stopId;

          return (
            <div key={stopId} className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{stationTitle}</h3>
              {favs.map(fav => {
                // Find matching direction in view
                const matchingDepartures = findMatchingDepartures(view, fav, depCount);
                const lineBadgeStyle = fav.transportType === 'metro' && UBAHN_COLORS[fav.lineName]
                  ? { backgroundColor: UBAHN_COLORS[fav.lineName] }
                  : undefined;
                const lineBadgeClass = fav.transportType === 'metro' && UBAHN_COLORS[fav.lineName]
                  ? 'text-xs font-bold text-white px-2 py-0.5 rounded'
                  : `text-xs font-bold text-primary-foreground px-2 py-0.5 rounded bg-[hsl(var(--wl-${fav.transportType}))]`;

                return (
                  <div key={fav.directionKey} className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
                      <span className={lineBadgeClass} style={lineBadgeStyle}>{fav.lineName}</span>
                      <span className="text-sm font-medium text-foreground truncate flex-1">
                        → {fav.canonicalToward}
                      </span>
                      <button
                        onClick={() => removeFavorite(fav.directionKey)}
                        className="p-1 rounded-full hover:bg-destructive/10 transition-colors"
                        aria-label="Favorit entfernen"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                    <div className="px-3 py-2.5">
                      {matchingDepartures.length > 0 ? (
                        <div className="space-y-1">
                          {matchingDepartures.map((dep, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <DepartureRow
                                departure={dep.departure}
                                isShortTurn={dep.isShort}
                              />
                              {dep.isShort && dep.towards && (
                                <span className="text-[10px] text-muted-foreground truncate">
                                  → {dep.towards}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : view ? (
                        <p className="text-xs text-muted-foreground">Keine Abfahrten</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Laden…</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <ShareLinks />
    </div>
  );
}

interface MatchedDeparture {
  departure: { countdown: number; timePlanned: string; timeReal?: string; isRealtime: boolean };
  isShort: boolean;
  towards?: string;
}

function findMatchingDepartures(
  view: StationView | undefined,
  fav: Favorite,
  depCount: number
): MatchedDeparture[] {
  if (!view) return [];

  const results: MatchedDeparture[] = [];

  for (const lg of view.lineGroups) {
    if (lg.name !== fav.lineName) continue;

    for (const dir of lg.directions) {
      // Match by directionId (Grundrichtung)
      if (dir.directionId !== fav.richtungsId) continue;

      const short = isShortTurn(dir.towards, fav.canonicalToward);

      for (const dep of dir.departures) {
        results.push({
          departure: dep,
          isShort: short,
          towards: short ? dir.towards : undefined,
        });
      }
    }
  }

  // Sort by countdown and limit
  results.sort((a, b) => a.departure.countdown - b.departure.countdown);
  return results.slice(0, depCount);
}
