
# Wiener Linien Abfahrtsmonitor – PWA

## Übersicht
Eine minimalistische, mobil-optimierte PWA für Wiener-Linien-Abfahrten. Schnell, übersichtlich, mit Echtzeit-Daten und Störungsmeldungen.

## Datenquellen (Wiener Linien Open Data)
- **Haltestellenliste**: CSV von `data.wien.gv.at` (wird beim Start geladen und im Client gecacht für die Suche)
- **Abfahrten**: `https://www.wienerlinien.at/ogd_realtime/monitor?stopId=...&activateTrafficInfo=stoerungkurz`
- **Störungen**: `https://www.wienerlinien.at/ogd_realtime/trafficInfoList?relatedStop=...`
- Kein API-Key nötig

## Features (V1)

### 1. Stationssuche
- Suchfeld oben, Live-Filter bei Eingabe
- Haltestellenliste wird aus CSV geladen (Name + DIVA-Nummer)
- Fuzzy-Suche mit Tippfehler-Toleranz
- Nach Auswahl → sofort Abfahrtsansicht

### 2. Abfahrtsanzeige
- Gruppierung nach Linienart (U-Bahn → Bim → Bus → Nightline)
- Innerhalb: nach Linie sortiert, beide Richtungen getrennt dargestellt
- Pro Richtung: Linie, Ziel, Steig, nächste 3 Abfahrten, Niederflur-Icon
- **Echtzeit vs. Fahrplan** deutlich visuell markiert (z.B. grüner Punkt = Echtzeit, grauer Punkt = Fahrplan)

### 3. Störungsmeldungen
- Eigener Bereich unter der Statuszeile
- Lokale Störungen (aktuelle Station/Linien) + relevante Netzstörungen
- Lift-/Rolltreppenstörungen nur wenn aktuelle Station betroffen
- Details aufklappbar

### 4. Auto-Refresh
- Alle 30 Sekunden automatisch
- Statuszeile: "Aktualisiert: 14:32:10" + "Neu in 24 s" Countdown
- Nur Daten neu laden, nicht die ganze Seite

### 5. Direkt/Proxy-Umschalter (Testbetrieb)
- Toggle im Header sichtbar
- **Direktmodus**: Frontend ruft Wiener-Linien-API direkt auf
- **Proxy-Modus**: Frontend ruft Supabase Edge Functions auf, diese rufen die Wiener-Linien-API
- Zwei Edge Functions: `stops-search` und `station-view`
- Identisches Verhalten in beiden Modi

### 6. PWA
- Web App Manifest für Installation auf Home-Bildschirm
- App-artiges Verhalten (standalone display)
- Kein Offline-Support in V1
- Kein Service Worker (nur Manifest für Installierbarkeit)

## Architektur

### Provider-Abstraktion
```
interface StationViewProvider {
  searchStops(query: string): Promise<SearchResult[]>
  getStationView(stopId: string): Promise<StationView>
}
```
- `DirectProvider` → ruft WL-API direkt auf
- `ProxyProvider` → ruft Edge Functions auf
- Gemeinsames normalisiertes Datenmodell

### Internes Datenmodell
- `StationView`: mode, updatedAt, station, alerts[], lineGroups[]
- `LineGroup`: type (metro/tram/bus/nightline), line, directions[]
- `Direction`: towards, platform, departures[], isBarrierFree
- `Departure`: countdown, time, isRealtime

### Edge Functions (Proxy)
- `GET /stops-search?q=...` → Stationssuche
- `GET /station-view?stopId=...` → Komplette Stationsansicht mit Störungen

## UI-Aufbau (Mobile-First)
1. **Header**: App-Name "WL Monitor" + Direkt/Proxy Toggle
2. **Suchfeld**: Große Touch-Fläche, sofortige Filterung
3. **Statuszeile**: Aktualisierungszeitpunkt + Countdown
4. **Störungsbereich**: Warnungen mit aufklappbaren Details
5. **Abfahrtsblöcke**: Karten pro Linie mit Richtungsblöcken

## Fehlerverhalten
- Keine Treffer → klarer Hinweis
- API-Fehler → Fehlermeldung, letzte Daten bleiben sichtbar
- Kein Absturz, kein undefinierter Zustand

## Design
- Minimalistisch, hoher Kontrast, große Schrift
- Farben: U-Bahn-Linienfarben wo passend, sonst neutral
- Reduzierte Optik, Fokus auf Lesbarkeit
