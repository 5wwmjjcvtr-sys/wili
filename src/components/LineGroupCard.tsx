import { LineGroup, LineType } from '@/types/station';
import { DepartureRow } from './DepartureRow';
import { Accessibility } from 'lucide-react';

interface Props {
  lineGroup: LineGroup;
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

export function LineGroupCard({ lineGroup }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Line header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <span className={`text-xs font-bold text-primary-foreground px-2 py-0.5 rounded ${LINE_TYPE_COLORS[lineGroup.type]}`}>
          {lineGroup.name}
        </span>
        <span className="text-xs text-muted-foreground">{LINE_TYPE_LABELS[lineGroup.type]}</span>
      </div>

      {/* Directions */}
      <div className="divide-y divide-border">
        {lineGroup.directions.map((dir) => (
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
          </div>
        ))}
      </div>
    </div>
  );
}
