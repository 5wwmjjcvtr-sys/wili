import { LineGroup, LineType, Direction } from '@/types/station';
import { DepartureRow } from './DepartureRow';
import { FavoritesStar } from './FavoritesStar';
import { Accessibility } from 'lucide-react';
import { buildDirectionKey, Favorite } from '@/lib/favorites';

interface Props {
  lineGroup: LineGroup;
  stationStopId?: string;
  stationTitle?: string;
}

const LINE_TYPE_LABELS: Record<LineType, string> = {
  metro: 'U-Bahn',
  tram: 'Bim',
  bus: 'Bus',
  nightline: 'Nightline',
};

const LINE_TYPE_COLORS: Record<LineType, string> = {
  metro: 'bg-[hsl(var(--wl-metro))]',
  tram: 'bg-[hsl(var(--wl-tram))]',
  bus: 'bg-[hsl(var(--wl-bus))]',
  nightline: 'bg-[hsl(var(--wl-nightline))]',
};

const UBAHN_COLORS: Record<string, string> = {
  U1: '#ED1C24',
  U2: '#A666B0',
  U3: '#F58220',
  U4: '#00A651',
  U5: '#A6C73A',
  U6: '#A8743A',
};

function getLineBadgeStyle(lineGroup: LineGroup): { className: string; style?: React.CSSProperties } {
  if (lineGroup.type === 'metro' && UBAHN_COLORS[lineGroup.name]) {
    return {
      className: 'text-xs font-bold text-white px-2 py-0.5 rounded',
      style: { backgroundColor: UBAHN_COLORS[lineGroup.name] },
    };
  }
  return {
    className: `text-xs font-bold text-primary-foreground px-2 py-0.5 rounded ${LINE_TYPE_COLORS[lineGroup.type]}`,
  };
}

function buildFavoriteFromDirection(
  lineGroup: LineGroup,
  dir: Direction,
  stopId: string,
  stationTitle: string
): Favorite {
  return {
    stopId,
    stationTitle,
    lineName: lineGroup.name,
    transportType: lineGroup.type,
    richtungsId: dir.directionId,
    direction: dir.towards,
    directionKey: buildDirectionKey(lineGroup.name, dir.directionId, dir.towards),
    canonicalToward: dir.towards,
    platform: dir.platform,
    allowShortTurns: true,
    stationOrder: 0,
    itemOrder: 0,
  };
}

export function LineGroupCard({ lineGroup, stationStopId, stationTitle }: Props) {
  const badgeStyle = getLineBadgeStyle(lineGroup);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Line header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <span className={badgeStyle.className} style={badgeStyle.style}>
          {lineGroup.name}
        </span>
        <span className="text-xs text-muted-foreground">{LINE_TYPE_LABELS[lineGroup.type]}</span>
      </div>

      {/* Directions */}
      <div className="divide-y divide-border">
        {lineGroup.directions.map((dir) => {
          const favorite = stationStopId
            ? buildFavoriteFromDirection(lineGroup, dir, stationStopId, stationTitle || '')
            : null;

          return (
            <div key={`${dir.directionId}_${dir.towards}`} className="px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium text-foreground truncate flex-1">
                  → {dir.towards}
                </span>
                {dir.platform && (
                  <span className="text-xs text-muted-foreground">Steig {dir.platform}</span>
                )}
                {dir.isBarrierFree && (
                  <Accessibility className="h-3.5 w-3.5 text-muted-foreground" aria-label="Barrierefrei" />
                )}
                {favorite && <FavoritesStar favorite={favorite} />}
              </div>
              {dir.departures.length > 0 ? (
                <div className="space-y-1">
                  {dir.departures.map((dep, i) => (
                    <DepartureRow key={i} departure={dep} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Keine Abfahrten</p>
              )}
              {dir.scheduleBounds && (
                <div className="flex gap-4 mt-1.5 pt-1.5 border-t border-border/50 text-xs text-muted-foreground">
                  <span>Erste Fahrt: <span className="font-mono">{dir.scheduleBounds.firstDeparturePlanned || '–'}</span></span>
                  <span>Letzte Fahrt: <span className="font-mono">{dir.scheduleBounds.lastDeparturePlanned || '–'}</span></span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
