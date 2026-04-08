import { Departure } from '@/types/station';
import { Badge } from '@/components/ui/badge';
import { Accessibility } from 'lucide-react';

interface Props {
  departure: Departure;
  isShortTurn?: boolean;
  shortTurnTowards?: string;
}

export function DepartureRow({ departure, isShortTurn, shortTurnTowards }: Props) {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const displayTime = departure.isRealtime && departure.timeReal
    ? formatTime(departure.timeReal)
    : formatTime(departure.timePlanned);

  return (
    <div className="grid grid-cols-[0.75rem_0.875rem_3.25rem_5.5rem_minmax(0,1fr)] items-center gap-x-3 text-sm">
      <span
        className={`inline-block h-2 w-2 rounded-full shrink-0 ${
          departure.isRealtime
            ? 'bg-[hsl(var(--wl-realtime))]'
            : 'bg-[hsl(var(--wl-schedule))]'
        }`}
        title={departure.isRealtime ? 'Echtzeit' : 'Fahrplan'}
      />

      <span className="flex h-3 w-3 items-center justify-center">
        {departure.isBarrierFree && (
          <Accessibility className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Barrierefrei" />
        )}
      </span>

      <span className="font-mono font-semibold text-foreground text-right">
        {departure.countdown <= 0 ? 'jetzt' : `${departure.countdown}'`}
      </span>

      <span className="text-muted-foreground text-xs tabular-nums">
        {displayTime}
      </span>

      <div className="flex min-w-0 items-center gap-2">
        {isShortTurn && (
          <Badge variant="outline" className="h-5 shrink-0 border-[hsl(var(--wl-alert))] px-2 text-[10px] text-[hsl(var(--wl-alert))]">
            Kurz
          </Badge>
        )}
        {isShortTurn && shortTurnTowards && (
          <span className="truncate text-[10px] text-muted-foreground">→ {shortTurnTowards}</span>
        )}
      </div>
    </div>
  );
}
