# Tages-, Neuro- & Zyklus-Tracker

Installierbare, offline-fähige PWA für einen kleinen Anwenderkreis. Die laufenden Journal-Daten liegen lokal in IndexedDB. Zusätzlich kann die App verschlüsselte, versionierte Sicherungen im **Google-Drive-App-Datenordner (`appDataFolder`)** ablegen.

## Was jetzt abgesichert ist

- lokale Speicherung per IndexedDB
- verschlüsseltes Google-Drive-Backup (AES-256-GCM)
- Schlüsselableitung aus dem Backup-Passwort mit PBKDF2/SHA-256
- automatisches Cloud-Backup nach Änderungen, solange Drive verbunden ist
- manuelles „Jetzt sichern“
- mehrere Backup-Stände statt nur einer überschriebenen Datei
- Aufbewahrung nach dem Muster: aktuelle Sicherung + tägliche/wöchentliche/monatliche Stände
- Wiederherstellung auf demselben oder einem neuen Gerät
- „Zusammenführen“ oder „Lokale Daten ersetzen“
- JSON-Backup sowie CSV breit/lang bleiben zusätzlich vorhanden

**Wichtig:** Das Backup-Passwort ist für die Wiederherstellung auf einem neuen Gerät nötig. Wer es verliert, kann die verschlüsselte Drive-Datei nicht entschlüsseln. Wenn „Passwort nur auf diesem Gerät merken“ aktiv ist, wird es nur in der lokalen IndexedDB dieser App gespeichert. Es wird nicht in das Cloud-Backup geschrieben.

## Google Drive einmalig konfigurieren

Die App verwendet Googles OAuth-Webflow direkt im Browser und den minimalen Drive-Scope `drive.appdata`. Dafür ist kein eigener Backend-Server nötig.

1. In der **Google Cloud Console** ein Projekt anlegen.
2. **Google Drive API** für das Projekt aktivieren.
3. Unter **Google Auth Platform** den Zustimmungsbildschirm konfigurieren.
   - Für einen kleinen internen Google-Workspace-Test kann die Zielgruppe ggf. „Internal“ sein.
   - Bei „External“ die vorgesehenen Testnutzer hinzufügen bzw. die App später veröffentlichen.
4. Unter **Clients** einen OAuth-Client vom Typ **Web application** erstellen.
5. Unter **Authorized JavaScript origins** die GitHub-Pages-Origin eintragen, z. B.:
   - `https://DEINNAME.github.io`
6. Die erzeugte Client-ID in `src/config.js` eintragen:

```js
export const GOOGLE_CLIENT_ID = '1234567890-abc....apps.googleusercontent.com';
```

7. Committen und neu deployen.

Es wird ausschließlich der Scope verwendet:

```text
https://www.googleapis.com/auth/drive.appdata
```

Damit kann die App nur ihren eigenen, versteckten App-Datenbereich in Google Drive lesen und verwalten, nicht die übrigen Drive-Dateien des Nutzers.

## GitHub Pages veröffentlichen

1. Neues GitHub-Repository anlegen.
2. Den **Inhalt dieses Ordners** ins Repository kopieren und auf `main` pushen.
3. In GitHub unter **Settings → Pages → Build and deployment** als Source **GitHub Actions** auswählen.
4. Der mitgelieferte Workflow führt die Tests aus und deployed danach die App.
5. Pages-URL am Handy öffnen.
6. Android/Chrome: Menü → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.

Es gibt keinen Build-Schritt und keinen eigenen Server.

## Wiederherstellung nach verlorenem/zerstörtem Handy

1. PWA auf dem neuen Handy über dieselbe GitHub-Pages-Adresse erneut installieren.
2. „Google Drive verbinden“ auswählen und dasselbe Google-Konto verwenden.
3. Backup-Passwort eingeben.
4. „Sicherungen laden“.
5. Gewünschten Stand auswählen; die App zeigt Datum, Zahl der Einträge und Zeitraum.
6. **Lokale Daten ersetzen** bei einem leeren neuen Gerät oder **Zusammenführen**, wenn dort schon Daten vorhanden sind.
7. Danach kann normal weitergetrackt werden; neue Sicherungen werden wieder angelegt.

## Backup-Aufbewahrung

Nach neuen Sicherungen räumt die App ältere Versionen auf. Sie behält insbesondere den neuesten Stand sowie verdichtete tägliche, wöchentliche und monatliche Versionen. Das verhindert, dass ein versehentlich leerer oder beschädigter Datenbestand sofort sämtliche älteren Sicherungen verdrängt.

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

Neben der normalen Tracker-Funktion insbesondere testen:

- OAuth-Anmeldung auf Android und iOS
- Drive-Verbindung nach Ablauf eines Access Tokens
- Auto-Backup nach Speichern und Löschen
- Wiederherstellung auf einem zweiten Gerät
- falsches Backup-Passwort
- beschädigtes Backup
- Zusammenführen bei überschneidenden Datumswerten
- vollständiges Ersetzen lokaler Daten
- Offline-Eingabe und spätere Sicherung nach Wiederverbindung
- Versionsaufbewahrung nach vielen Backups
- Android/iOS Installation und Offline-Start
- Persistenz nach App-/Browser-/Geräteneustart
- rückwirkende Änderung/Löschung von ZT1
- rückwirkende Änderung/Löschung einer Ovulationsvermutung
- lange und unvollständige Zyklen
- fehlende Tageswerte
- CSV-Import in Excel/Power BI/R/Python

## Datenschutz-Hinweis

Die App verarbeitet potenziell sehr sensible Gesundheits- und Verhaltensdaten. Das Drive-Backup wird **vor dem Upload im Browser verschlüsselt**. Trotzdem sollten für einen echten Produktivbetrieb Datenschutzhinweise, Einwilligung, Verantwortlichkeiten und Support-/Löschprozesse für den vorgesehenen Nutzerkreis geklärt werden.

## Oberfläche & Speichern

- Dark Mode ist der Standard. Die primäre Interaktionsfarbe ist Mittelblau.
- Änderungen an Tagesfeldern werden nach ca. 0,9 Sekunden automatisch lokal in IndexedDB gespeichert.
- Ein schwebender blauer Haken unten rechts speichert den aktuellen Tag jederzeit sofort.
- Oben wird der lokale Speicherstatus angezeigt (`Ungespeicherte Änderungen`, `Speichere lokal`, `Lokal gespeichert`).
- Wenn Google Drive verbunden ist, wird daneben der Cloud-Status bzw. die Uhrzeit der letzten erfolgreichen Sicherung angezeigt.
- Drive-Sicherungen bleiben zeitversetzt und gebündelt, damit nicht jeder einzelne Slider-Schritt einen Upload auslöst.
