# Fai della Paganella con il passeggino

Guida di viaggio a Fai della Paganella (TN), base Hotel Arcobaleno, per il soggiorno del 25–30 agosto 2026. Nessun framework, nessun build: `index.html` + `style.css` + `app.js` + i file in `data/`.

È una piccola app a schede (Oggi · Luoghi · Giorni · Mangiare · Info) con navigazione fissa in basso: il "routing" tra schede e il dettaglio di ogni luogo (`#luogo/<id>`, condivisibile come link diretto) sono gestiti via `location.hash` in `app.js`, senza librerie. Un countdown in testata cambia da solo prima/durante/dopo il soggiorno (25-30 agosto 2026).

La mappa interattiva usa [Leaflet](https://leafletjs.com/) con le tile di OpenStreetMap, caricati via CDN (`unpkg.com`) — l'unica dipendenza esterna del sito, richiede una connessione internet per il primo caricamento (non è installata via npm, nessun build step). Le foto dei luoghi vengono da Wikimedia Commons, con licenza e autore riportati sotto ogni immagine.

Un service worker (`sw.js`) mette in cache pagina, dati e mappa dopo la prima visita: una volta aperta almeno una volta con rete, la guida resta consultabile anche con poco segnale in montagna (i dati meteo restano quelli dell'ultimo aggiornamento disponibile). Se modifichi i file, aggiorna `CACHE_VERSIONE` in cima a `sw.js` per forzare la sostituzione della cache sui dispositivi che hanno già visitato il sito.

## Provarla in locale

Doppio clic su `index.html`. Se il browser blocca il caricamento di `data/luoghi.json` da file locale (succede con `file://` su alcuni browser), avvia un piccolo server nella cartella, ad esempio:

```bash
python -m http.server 8000
```

e apri `http://localhost:8000`.

## Pubblicare su GitHub Pages

1. **Crea il repository** su GitHub (pubblico, altrimenti GitHub Pages richiede un piano a pagamento). Nome suggerito: `fai-paganella-guida`.

2. **Inizializza git e fai il primo push**, dalla cartella `guida-fai-paganella`:

   ```bash
   git init
   git add .
   git commit -m "Prima versione della guida"
   git branch -M main
   git remote add origin https://github.com/<tuo-utente>/fai-paganella-guida.git
   git push -u origin main
   ```

3. **Attiva GitHub Pages**: sul repository, vai su **Settings → Pages**. In "Build and deployment" scegli **Source: Deploy from a branch**, poi **Branch: main** e cartella **/ (root)**. Salva.

4. **Aspetta un paio di minuti**: GitHub pubblica il sito e mostra l'URL finale in cima alla pagina Pages, del tipo:

   ```
   https://<tuo-utente>.github.io/fai-paganella-guida/
   ```

5. **Manda il link su WhatsApp**: incollalo in una chat, oppure apri il sito pubblicato e usa il pulsante "Condividi su WhatsApp" in alto, che apre già il messaggio pronto.

Il file `.nojekyll` nella root evita che GitHub Pages passi il sito attraverso Jekyll (non serve qui e potrebbe ignorare la cartella `data/`).

## Aggiornare i dati

- **`data/luoghi.json`** — i 27 luoghi. Oltre ai campi base: `giorno_suggerito` (1–6, assegnazione iniziale), `immagine` (Wikimedia Commons con `autore`/`licenza`/`pagina_fonte`), `punto_foto` (consiglio dove scattare), `parcheggio`, `servizi_bimbo` (fasciatoio/bagni/allattamento), `orari_struttura` (giorni di chiusura + fasce orarie, usato per il badge "aperto ora/chiude tra"), `prenotazione` (se obbligatoria, entro quando, come) e `costo_eur` (usato per il budget totale).
- **`data/servizi.json`** — farmacie e supermercati (array `servizi`), numeri utili, `prenotazioni` (collegate a un luogo via `luogo_id`), `guestCard`, `trasportiPubblici` e `viaggio` (andata/ritorno da Carrara).
- **`data/locali.json`** — ristoranti, pizzerie, bar, gelaterie e rifugi in quota.
- **`data/eventi.json`** — eventi del 25-30 agosto, ognuno con `giorno` (1-6).

L'assegnazione ai giorni, l'ordine delle tappe, la checklist, le prenotazioni fatte, gli orari di partenza e le note "visitato" restano salvate nel browser (`localStorage`), non nei file.

Dopo una modifica ai file basta fare commit e push: GitHub Pages ripubblica automaticamente in un paio di minuti. Se cambi `sw.js`, aggiorna `CACHE_VERSIONE` per forzare l'aggiornamento della cache su chi ha già visitato il sito.
