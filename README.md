# Tages-, Neuro- & Zyklus-Tracker

Installierbare, offline-fähige PWA für einen kleinen Anwenderkreis. Laufende Journal-Daten liegen lokal in IndexedDB. Zusätzlich kann die App verschlüsselte, versionierte Sicherungen in einem eigenen Google-Drive-Ordner **„Neuro Cycle Tracker Backups“** ablegen.

## Was abgesichert ist

- lokale Speicherung per IndexedDB
- automatische lokale Speicherung nach Änderungen
- verschlüsseltes Google-Drive-Backup mit AES-256-GCM
- Schlüsselableitung aus dem Backup-Passwort mit PBKDF2/SHA-256
- Drive-Zugriff mit dem engen OAuth-Scope `drive.file`
- sichtbarer eigener Backup-Ordner in Google Drive
- automatisches Cloud-Backup nach Änderungen, solange Drive verbunden ist
- manuelles „Jetzt sichern“
- mehrere Backup-Stände statt nur einer überschriebenen Datei
- Aufbewahrung: aktuelle Sicherung plus tägliche/wöchentliche/monatliche Stände
- Wiederherstellung auf demselben oder einem neuen Gerät
- „Zusammenführen“ oder „Lokale Daten ersetzen“
- JSON-Backup sowie CSV breit/lang zusätzlich vorhanden

**Wichtig:** Das Backup-Passwort ist für die Wiederherstellung auf einem neuen Gerät nötig. Wer es verliert, kann die verschlüsselten Drive-Dateien nicht entschlüsseln. Wenn „Passwort nur auf diesem Gerät merken“ aktiv ist, liegt das Passwort nur lokal in IndexedDB. Es wird nicht in das Cloud-Backup geschrieben.

## Google Drive einmalig konfigurieren

1. In der Google Cloud Console ein Projekt anlegen.
2. **Google Drive API** aktivieren.
3. Unter **Google Auth Platform** den OAuth-Zustimmungsbildschirm konfigurieren.
4. Bei Status **Test** die vorgesehenen Testnutzer hinzufügen.
5. OAuth-Client vom Typ **Web application** erstellen.
6. Unter **Authorized JavaScript origins** für dieses Repository eintragen:

```text
https://mephistaaa.github.io
```

7. Unter **Data access / Bereiche** den Scope verwenden:

```text
https://www.googleapis.com/auth/drive.file
```

8. Die erzeugte Client-ID in `src/config.js` eintragen:

```js
export const GOOGLE_CLIENT_ID = '1234567890-abc....apps.googleusercontent.com';
```

**Kein Client Secret in die PWA oder in GitHub eintragen.** Die Client-ID ist öffentlich und darf im Frontend stehen.

### Warum `drive.file`?

Die App darf damit Dateien und Ordner verwalten, die sie selbst erstellt bzw. die ihr explizit freigegeben wurden. Sie erhält keinen pauschalen Zugriff auf alle Dateien des Google-Drive-Kontos. Beim ersten Backup legt sie automatisch den Ordner **Neuro Cycle Tracker Backups** an.

## GitHub Pages veröffentlichen

1. Den Inhalt dieses Ordners in das Repository auf `main` hochladen.
2. Unter **Settings → Pages → Build and deployment** als Source **GitHub Actions** auswählen.
3. Der Workflow `.github/workflows/deploy.yml` führt Tests aus und deployed danach die App.
4. Live-URL für dieses Repository:

```text
https://mephistaaa.github.io/neuro-cycle-tracker/
```

5. Android/Chrome: Menü → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.

## Google Drive in der App verwenden

1. Im Bereich **Daten & Backup** ein Backup-Passwort mit mindestens 8 Zeichen festlegen.
2. Das Passwort zusätzlich außerhalb des Handys sicher verwahren.
3. **Drive verbinden** wählen und mit einem eingetragenen Google-Testkonto anmelden.
4. **Jetzt sichern** für den ersten Test verwenden.
5. Danach zeigt der Status die letzte erfolgreiche Sicherung an.
6. Solange die App geöffnet und Drive verbunden ist, werden Änderungen zeitversetzt gebündelt automatisch gesichert.

Hinweis: Der OAuth-Zugriffstoken ist bewusst nur kurzfristig gültig und wird nicht als dauerhaftes Geheimnis gespeichert. Nach einer abgelaufenen Google-Sitzung kann ein erneutes **Drive verbinden** nötig sein.

## Wiederherstellung nach verlorenem/zerstörtem Handy

1. PWA auf dem neuen Handy über dieselbe GitHub-Pages-Adresse erneut installieren.
2. **Drive verbinden** und dasselbe Google-Konto verwenden.
3. Dasselbe Backup-Passwort eingeben.
4. **Sicherungen laden**.
5. Gewünschten Stand auswählen. Die App zeigt Datum, Anzahl der Einträge und Zeitraum.
6. Bei einem leeren neuen Gerät **Lokale Daten ersetzen** wählen; bei bereits vorhandenen Daten ggf. **Zusammenführen**.
7. Danach kann normal weitergetrackt werden.

## Backup-Aufbewahrung

Nach neuen Sicherungen räumt die App ältere Versionen auf. Sie behält den neuesten Stand sowie verdichtete tägliche, wöchentliche und monatliche Sicherungen. Ein versehentlich leerer oder beschädigter Datenbestand verdrängt dadurch nicht sofort alle älteren Stände.

## Oberfläche & Speichern

- Dark Mode als Standard
- Mittelblau als primäre Interaktionsfarbe
- Änderungen werden nach ca. 0,9 Sekunden lokal gespeichert
- schwebender blauer Haken unten rechts für sofortiges Speichern
- Status oben für lokale Speicherung und Drive-Sicherung
- Drive-Sicherungen werden gebündelt, damit nicht jeder Slider-Schritt einzeln hochgeladen wird
- schwebende Lupe oberhalb des Speicher-Hakens für die Schnellsuche in der App
- Suche nach Bereichen und Einträgen (z. B. „Emotionen“, „Alkohol“, „Trigger“, „Zyklus“) mit direktem Sprung und kurzer Hervorhebung des Treffers

## Lokal testen

Service Worker und ES-Module benötigen HTTP statt `file://`:

```bash
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

Automatische Tests:

```bash
npm test
```

## Testplan für den Pilotbetrieb

- Google OAuth auf Android und iOS
- Erstellung des Drive-Ordners beim ersten Backup
- erster manueller Cloud-Backup-Lauf
- automatisches Backup nach Speichern und Löschen
- Verhalten nach Ablauf des Access Tokens
- Wiederherstellung auf einem zweiten Gerät
- falsches Backup-Passwort
- beschädigtes Backup
- Zusammenführen bei überschneidenden Datumswerten
- vollständiges Ersetzen lokaler Daten
- Offline-Eingabe und spätere Sicherung nach Wiederverbindung
- Versionsaufbewahrung nach vielen Backups
- PWA-Installation und Offline-Start
- Persistenz nach App-/Browser-/Geräteneustart
- rückwirkende Änderung/Löschung von ZT1
- rückwirkende Änderung/Löschung einer Ovulationsvermutung
- lange und unvollständige Zyklen
- fehlende Tageswerte
- CSV-Import in Excel/Power BI/R/Python

## Datenschutz

Die App verarbeitet potenziell sehr sensible Gesundheits- und Verhaltensdaten. Journal-Daten werden nicht in GitHub gespeichert. Cloud-Backups werden vor dem Upload im Browser verschlüsselt. Für einen echten Produktivbetrieb mit weiteren Personen sollten Datenschutzhinweise, Einwilligung, Verantwortlichkeiten, Löschung und Support organisatorisch geklärt werden.
