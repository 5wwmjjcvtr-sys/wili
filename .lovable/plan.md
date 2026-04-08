

# Stärkere optische Trennung zwischen Stationen in der Favoritenansicht

Aktuell sind die Stationsblöcke nur durch `space-y-3` getrennt — zu wenig visueller Unterschied zwischen "neue Station" und "neuer Favorit innerhalb derselben Station".

## Änderung

**Datei: `src/components/FavoritesView.tsx`**

Zwischen den Stationsblöcken einen `Separator` oder eine dickere visuelle Trennung einfügen:

- Statt nur `space-y-3` auf dem äußeren Container: `space-y-5` oder `space-y-6` verwenden
- Zwischen den Stationsblöcken (ab dem zweiten) eine horizontale Linie (`<Separator />` oder `<hr>`) mit etwas Abstand einfügen
- Optional: Stationsname etwas größer/prominenter gestalten (z.B. `text-base` statt `text-sm`)

Konkret: Im `stationEntries.map(...)` vor jedem Block ab Index > 0 einen `Separator` rendern. Die bestehende `Separator`-Komponente aus `src/components/ui/separator.tsx` wird verwendet.

