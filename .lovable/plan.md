
# Favoriten-System

## Architektur

### 1. Datenmodell & Serialisierung (`src/lib/favorites.ts`)
- `Favorite` Interface mit stopId, stationTitle, lineName, transportType, richtungsId, direction, directionKey, canonicalToward, platform, allowShortTurns
- Versionierter Container `{ v: 1, favorites: [...], prefs: { depCount?, mode? } }`
- localStorage CRUD (save/load/add/remove)
- URL-Serialisierung: lesbare Variante (Query-Params) + kodierte Variante (JSON→Base64URL)
- URL-Deserialisierung mit Priorität: kodiert > lesbar > localStorage
- Standardwert-Logik: depCount=3, mode=direct werden bei Linkgenerierung weggelassen

### 2. React Context (`src/providers/FavoritesContext.tsx`)
- State: favorites[], prefs, isFavorite(), toggleFavorite(), generateReadableUrl(), generateEncodedUrl()
- URL-Parsing beim App-Start

### 3. UI-Änderungen
- **Stern-Button** in `LineGroupCard` pro Richtungsblock
- **Kurzführungs-Badge** in `DepartureRow` ("Kurz" Badge wenn towards ≠ canonicalToward)
- **Favoritenansicht** als Tab/Ansicht: nur favorisierte Richtungsblöcke, gruppiert nach Station
- **Link-Generierung UI**: beide Varianten anzeigen mit Copy-Buttons

### 4. Favoritenansicht-Logik
- Alle benötigten stopIds sammeln
- API-Aufrufe gruppiert pro Station
- Clientseitig nach directionKey filtern
- depCount Abfahrten anzeigen
- Kurzführungen markieren

## Dateien
- `src/lib/favorites.ts` (neu)
- `src/providers/FavoritesContext.tsx` (neu)
- `src/components/FavoritesStar.tsx` (neu)
- `src/components/FavoritesView.tsx` (neu)
- `src/components/ShareLinks.tsx` (neu)
- `src/components/LineGroupCard.tsx` (ändern - Stern einfügen)
- `src/components/DepartureRow.tsx` (ändern - Kurz-Badge)
- `src/pages/Index.tsx` (ändern - Favoritenansicht + URL-Parsing)
- `src/types/station.ts` (ändern - Departure.towards Feld)
