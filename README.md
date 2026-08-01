# Fai della Paganella con il passeggino

Guida di viaggio a pagina singola per il soggiorno del 25–30 agosto 2026 a Fai della Paganella (TN), base Hotel Arcobaleno. Nessun framework, nessun build: `index.html` + `style.css` + `app.js` + `data/luoghi.json` + `data/servizi.json`.

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

Tutti i luoghi sono in `data/luoghi.json`. Ogni voce ha, tra gli altri campi, `giorno_suggerito` (1–6, dove 1 = 25 agosto) usato come assegnazione iniziale — l'utente può poi spostare i luoghi tra i giorni dall'interfaccia, e la scelta resta salvata nel browser (`localStorage`), non nel file. Il campo `immagine` (quando presente) punta a un file Wikimedia Commons con `autore`, `licenza` e `pagina_fonte` per l'attribuzione mostrata sotto la foto.

Farmacia, supermercato, ristoranti/bar vicino all'hotel e i numeri utili sono in `data/servizi.json`.

La checklist bagaglio e le note su quota/meteo sono contenuti statici dentro `index.html`/`app.js`: per modificarle si edita direttamente il codice, non serve toccare i JSON.

Dopo una modifica ai file basta fare commit e push: GitHub Pages ripubblica automaticamente in un paio di minuti.
