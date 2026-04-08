

# Bearbeiten-Modus mit Pfeiltasten und Löschen

## Konzept
- Ein **"Bearbeiten"-Button** in der Favoritenansicht-Toolbar (neben Refresh)
- Im Bearbeiten-Modus erscheinen pro Favorit:
  - **Pfeil hoch / Pfeil runter** zum Umsortieren innerhalb einer Station (itemOrder)
  - **Pfeil hoch / Pfeil runter** am Stationsblock-Header zum Umsortieren der Stationen (stationOrder)
  - **Löschen-Button** (Trash-Icon) -- nur im Bearbeiten-Modus sichtbar
- Im Normalmodus: kein Trash-Icon, keine Pfeile -- nur die Abfahrtsdaten

## Änderungen

### 1. FavoritesContext erweitern (`src/providers/FavoritesContext.tsx`)
- Neue Funktionen `moveStation(stopId, direction: 'up'|'down')` und `moveItem(directionKey, direction: 'up'|'down')` hinzufügen
- `moveStation`: tauscht `stationOrder` zwischen zwei benachbarten Stationsgruppen
- `moveItem`: tauscht `itemOrder` zwischen zwei benachbarten Einträgen derselben Station

### 2. FavoritesView umbauen (`src/components/FavoritesView.tsx`)
- Neuer State `editMode: boolean` (default false)
- Toggle-Button "Bearbeiten" / "Fertig" in der Toolbar
- Im Bearbeiten-Modus:
  - Stationsblock-Header: Pfeil hoch/runter Buttons zum Verschieben der gesamten Station
  - Pro Richtungsfavorit: Pfeil hoch/runter + Trash-Button
  - Abfahrtsdaten werden ausgeblendet oder komprimiert
- Im Normalmodus:
  - Keine Pfeile, kein Trash -- nur Abfahrten wie bisher

### 3. Dateien
| Datei | Aktion |
|---|---|
| `src/providers/FavoritesContext.tsx` | `moveStation`, `moveItem` hinzufügen |
| `src/components/FavoritesView.tsx` | Bearbeiten-Modus mit Pfeilen + bedingtes Löschen |

