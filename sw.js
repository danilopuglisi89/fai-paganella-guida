"use strict";

var CACHE_VERSIONE = "fai-paganella-v4";
var CACHE_RUNTIME = "fai-paganella-runtime-v4";

var RISORSE_PRECACHE = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "data/luoghi.json",
  "data/servizi.json",
  "data/locali.json",
  "data/eventi.json"
];

self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(CACHE_VERSIONE).then(function (cache) {
      return cache.addAll(RISORSE_PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nomi) {
      return Promise.all(
        nomi
          .filter(function (nome) { return nome !== CACHE_VERSIONE && nome !== CACHE_RUNTIME; })
          .map(function (nome) { return caches.delete(nome); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isRisorsaDati(url) {
  return url.pathname.indexOf("/data/") !== -1 && url.pathname.endsWith(".json");
}

self.addEventListener("fetch", function (evento) {
  var richiesta = evento.request;
  if (richiesta.method !== "GET") return;

  var url = new URL(richiesta.url);
  var stessaOrigine = url.origin === self.location.origin;

  // Dati JSON: prova la rete per restare aggiornati, altrimenti usa la cache.
  if (stessaOrigine && isRisorsaDati(url)) {
    evento.respondWith(
      fetch(richiesta).then(function (risposta) {
        var copia = risposta.clone();
        caches.open(CACHE_VERSIONE).then(function (cache) { cache.put(richiesta, copia); });
        return risposta;
      }).catch(function () {
        return caches.match(richiesta);
      })
    );
    return;
  }

  // Pagina e asset dello stesso sito: cache-first, aggiorna in background.
  if (stessaOrigine) {
    evento.respondWith(
      caches.match(richiesta).then(function (risposta) {
        var recupero = fetch(richiesta).then(function (fresca) {
          var copia = fresca.clone();
          caches.open(CACHE_VERSIONE).then(function (cache) { cache.put(richiesta, copia); });
          return fresca;
        }).catch(function () { return risposta; });
        return risposta || recupero;
      })
    );
    return;
  }

  // Risorse esterne (mappa, font, foto): stale-while-revalidate, per funzionare
  // offline dopo la prima visita senza bloccare mai il caricamento.
  evento.respondWith(
    caches.open(CACHE_RUNTIME).then(function (cache) {
      return cache.match(richiesta).then(function (risposta) {
        var recupero = fetch(richiesta).then(function (fresca) {
          cache.put(richiesta, fresca.clone());
          return fresca;
        }).catch(function () { return risposta; });
        return risposta || recupero;
      });
    })
  );
});
