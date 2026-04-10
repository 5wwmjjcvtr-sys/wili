import { Departure } from '@/types/station';
import { Badge } from '@/components/ui/badge';
import { Accessibility } from 'lucide-react';
import { useFavorites } from '@/providers/FavoritesContext';

interface Props {
  departure: Departure;
  isShortTurn?: boolean;
  shortTurnTowards?: string;
}

export function DepartureRow({ departure, isShortTurn, shortTurnTowards }: Props) {
  const { prefs } = useFavorites();
  const showTime = prefs.showTime !== false;
  const showTimeDiff = prefs.showTimeDiff !== false;
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

  const timeDiff = (() => {
    if (!departure.isRealtime || !departure.timeReal || !departure.timePlanned) return null;
    const diffSec = (new Date(departure.timeReal).getTime() - new Date(departure.timePlanned).getTime()) / 1000;
    if (Math.abs(diffSec) <= 30) return null;
    const diffMin = Math.round(Math.abs(diffSec) / 60);
    if (diffMin === 0) return null;
    return diffSec > 0
      ? { label: `-${diffMin}`, early: false }
      : { label: `+${diffMin}`, early: true };
  })();

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
        {departure.countdown <= 0
          ? <span className="animate-dance">*</span>
          : `${departure.countdown}'`}
      </span>

      <span className="text-muted-foreground text-xs tabular-nums">
        {showTime && displayTime}
        {showTimeDiff && timeDiff && (
          <span className={`ml-4 ${timeDiff.early ? 'text-green-500' : 'text-red-500'}`}>
            {timeDiff.label}
          </span>
        )}
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
