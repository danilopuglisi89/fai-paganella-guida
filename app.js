(function () {
  "use strict";

  document.documentElement.classList.add("js-attivo");

  var STORAGE_GIORNI = "faiPaganella:giorni";
  var STORAGE_CHECKLIST = "faiPaganella:checklist";
  var STORAGE_ORDINE = "faiPaganella:ordine";
  var STORAGE_VISITATI = "faiPaganella:visitati";
  var STORAGE_PRENOTAZIONI = "faiPaganella:prenotazioniFatte";
  var STORAGE_PARTENZE = "faiPaganella:orariPartenza";

  var CHECKLIST_ITEMS = [
    "Termometro",
    "Cambio completo per 3 volte al giorno",
    "Pannolini e salviette",
    "Crema anti-arrossamento",
    "Cappellino da sole e copertina leggera",
    "Giacca a vento leggera (per la sera in quota)",
    "Marsupio o fascia porta-bebè (indispensabile per San Romedio e Rio Sass)",
    "Passeggino da trekking, se disponibile",
    "Ombrellino parasole per il passeggino",
    "Crema solare pediatrica",
    "Borsa frigo per latte o pappe",
    "Ciuccio di scorta",
    "Libretto pediatrico e tessera sanitaria",
    "Farmaci da banco indicati dal pediatra (febbre, ecc.)"
  ];

  var COLORE_PASSEGGINO = { ok: "#2E7D4F", parziale: "#E8B03A", no: "#B23A2E" };
  var GIORNI_DATE = {
    1: "Martedì 25 agosto",
    2: "Mercoledì 26 agosto",
    3: "Giovedì 27 agosto",
    4: "Venerdì 28 agosto",
    5: "Sabato 29 agosto",
    6: "Domenica 30 agosto"
  };
  var GIORNI_DATA_ISO = {
    1: [2026, 8, 25], 2: [2026, 8, 26], 3: [2026, 8, 27],
    4: [2026, 8, 28], 5: [2026, 8, 29], 6: [2026, 8, 30]
  };
  var GIORNI_ORDINE = [1, 2, 3, 4, 5, 6];
  var GIORNI_SETTIMANA_JS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

  var CATEGORIE_LABEL = {
    natura: "Natura", lago: "Lago", impianti: "Impianti", paese: "Paese",
    citta: "Città", museo: "Museo", mangiare: "Mangiare", bimbo: "Bimbo"
  };

  var PASSEGGINO_LABEL = { ok: "Passeggino ok", parziale: "Passeggino parziale", no: "Serve il marsupio" };
  var PASSEGGINO_ICONA = { ok: "🟢", parziale: "🟡", no: "🔴" };

  var ICONE_CATEGORIA = {
    natura: "🌲", lago: "🏞", impianti: "🚡", paese: "🏘",
    citta: "🏛", museo: "🖼", mangiare: "🍽", bimbo: "🎈"
  };

  var TIPO_LOCALE_ICONA = { ristorante: "🍽", pizzeria: "🍕", bar: "☕", gelateria: "🍦", rifugio: "🏔" };
  var TIPO_LOCALE_LABEL = { ristorante: "Ristorante", pizzeria: "Pizzeria", bar: "Bar", gelateria: "Gelateria", rifugio: "Rifugio" };

  var stato = {
    luoghi: [],
    base: null,
    servizi: [],
    numeriUtili: [],
    locali: [],
    eventi: [],
    eventiNota: "",
    prenotazioni: [],
    guestCard: null,
    trasportiPubblici: null,
    viaggio: null,
    filtri: { passeggino: false, senzaAuto: false, coperto: false, breve: false, categoria: null, ricerca: "" },
    filtriLocali: { tipo: null },
    assegnazioni: {},
    ordinePerGiorno: {},
    meteoGiornoPioggia: {},
    meteoPerGiorno: {},
    visitati: {},
    prenotazioniFatte: {},
    partenzePerGiorno: {},
    mappaGenerale: null,
    stratoMarkerGenerale: null,
    mappeGiorno: {}
  };

  // ---------- Persistenza ----------
  function caricaJson(chiave, fallback) {
    try {
      return JSON.parse(localStorage.getItem(chiave) || JSON.stringify(fallback));
    } catch (e) {
      return fallback;
    }
  }
  function salvaJson(chiave, valore) {
    localStorage.setItem(chiave, JSON.stringify(valore));
  }

  function caricaAssegnazioni(luoghi) {
    var salvate = caricaJson(STORAGE_GIORNI, {});
    var assegnazioni = {};
    luoghi.forEach(function (l) {
      if (Object.prototype.hasOwnProperty.call(salvate, l.id)) {
        assegnazioni[l.id] = salvate[l.id];
      } else {
        assegnazioni[l.id] = l.giorno_suggerito || null;
      }
    });
    return assegnazioni;
  }
  function salvaAssegnazioni() { salvaJson(STORAGE_GIORNI, stato.assegnazioni); }

  function luoghiDelGiorno(g) {
    var assegnati = stato.luoghi.filter(function (l) { return stato.assegnazioni[l.id] === g; });
    var mappaId = {};
    assegnati.forEach(function (l) { mappaId[l.id] = l; });
    var risultato = [];
    (stato.ordinePerGiorno[g] || []).forEach(function (id) {
      if (mappaId[id]) { risultato.push(mappaId[id]); delete mappaId[id]; }
    });
    assegnati.forEach(function (l) { if (mappaId[l.id]) risultato.push(l); });
    return risultato;
  }

  function aggiornaOrdineDopoSpostamento(id, vecchioGiorno, nuovoGiorno) {
    if (vecchioGiorno && stato.ordinePerGiorno[vecchioGiorno]) {
      stato.ordinePerGiorno[vecchioGiorno] = stato.ordinePerGiorno[vecchioGiorno].filter(function (x) { return x !== id; });
    }
    if (nuovoGiorno) {
      if (!stato.ordinePerGiorno[nuovoGiorno]) stato.ordinePerGiorno[nuovoGiorno] = [];
      if (stato.ordinePerGiorno[nuovoGiorno].indexOf(id) === -1) stato.ordinePerGiorno[nuovoGiorno].push(id);
    }
    salvaJson(STORAGE_ORDINE, stato.ordinePerGiorno);
  }

  function spostaOrdineGiorno(g, id, direzione) {
    var lista = luoghiDelGiorno(g).map(function (l) { return l.id; });
    var idx = lista.indexOf(id);
    var nuovoIdx = idx + direzione;
    if (idx === -1 || nuovoIdx < 0 || nuovoIdx >= lista.length) return;
    var tmp = lista[idx]; lista[idx] = lista[nuovoIdx]; lista[nuovoIdx] = tmp;
    stato.ordinePerGiorno[g] = lista;
    salvaJson(STORAGE_ORDINE, stato.ordinePerGiorno);
    renderGiorni();
  }

  // ---------- Utility ----------
  function formatMinuti(min) {
    if (min == null) return "n/d";
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60);
    var m = min % 60;
    return h + "h" + (m ? " " + m + "min" : "");
  }

  function formatOra(minutiDaMezzanotte) {
    var h = Math.floor(minutiDaMezzanotte / 60) % 24;
    var m = minutiDaMezzanotte % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function parseOra(hhmm) {
    var parti = hhmm.split(":");
    return parseInt(parti[0], 10) * 60 + parseInt(parti[1], 10);
  }

  function urlMaps(luogo) {
    var query = encodeURIComponent(luogo.lat + "," + luogo.lng);
    var url = "https://www.google.com/maps/search/?api=1&query=" + query;
    if (luogo.place_id) url += "&query_place_id=" + encodeURIComponent(luogo.place_id);
    return url;
  }

  function urlDirezioni(luogo) {
    var mezzo = luogo.mezzo && luogo.mezzo.indexOf("piedi") !== -1 && luogo.mezzo.indexOf("auto") === -1 ? "walking" : "driving";
    var origin = "Hotel Arcobaleno Fai della Paganella";
    var url = "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(origin) +
      "&destination=" + encodeURIComponent(luogo.lat + "," + luogo.lng) +
      "&travelmode=" + mezzo;
    if (luogo.place_id) url += "&destination_place_id=" + encodeURIComponent(luogo.place_id);
    return url;
  }

  function calcolaGiornoOggi() {
    var oggi = new Date();
    var y = oggi.getFullYear(), m = oggi.getMonth() + 1, d = oggi.getDate();
    for (var g in GIORNI_DATA_ISO) {
      var iso = GIORNI_DATA_ISO[g];
      if (iso[0] === y && iso[1] === m && iso[2] === d) return parseInt(g, 10);
    }
    return null;
  }

  // Calcola lo stato apertura di un luogo in base a orari_struttura e all'ora reale corrente.
  function statoApertura(orariStruttura) {
    if (!orariStruttura) return null;
    if (orariStruttura.sempre_aperto) return { stato: "aperto", testo: "Sempre aperto" };

    var ora = new Date();
    var giornoSettimana = ora.getDay();
    var minutiOra = ora.getHours() * 60 + ora.getMinutes();

    if (orariStruttura.giorni_chiusura && orariStruttura.giorni_chiusura.indexOf(giornoSettimana) !== -1) {
      return { stato: "chiuso", testo: "Chiuso oggi" };
    }

    var fasce = orariStruttura.fasce || [];
    if (fasce.length === 0) return null;

    for (var i = 0; i < fasce.length; i++) {
      var inizio = parseOra(fasce[i][0]);
      var fine = parseOra(fasce[i][1]);
      if (minutiOra >= inizio && minutiOra <= fine) {
        if (fine - minutiOra <= 30) {
          return { stato: "chiude-a-breve", testo: "Chiude tra " + (fine - minutiOra) + " min" };
        }
        return { stato: "aperto", testo: "Aperto ora, chiude alle " + fasce[i][1] };
      }
    }

    var primaFascia = fasce[0];
    if (minutiOra < parseOra(primaFascia[0])) {
      return { stato: "chiuso", testo: "Apre alle " + primaFascia[0] };
    }
    return { stato: "chiuso", testo: "Chiuso ora" };
  }

  // ---------- Card luogo ----------
  function creaCard(luogo) {
    var art = document.createElement("article");
    art.className = "card";
    art.dataset.id = luogo.id;

    var vis = stato.visitati[luogo.id];
    if (vis && vis.visitato) art.classList.add("card--visitato");

    if (luogo.immagine && luogo.immagine.url) {
      var figura = document.createElement("figure");
      figura.className = "card__figura";
      var img = document.createElement("img");
      img.src = luogo.immagine.url;
      img.alt = luogo.nome;
      img.loading = "lazy";
      figura.appendChild(img);
      if (luogo.immagine.autore) {
        var credito = document.createElement("figcaption");
        credito.className = "card__credito";
        var testoCredito = "Foto: " + luogo.immagine.autore + (luogo.immagine.licenza ? " (" + luogo.immagine.licenza + ")" : "");
        if (luogo.immagine.pagina_fonte) {
          var linkCredito = document.createElement("a");
          linkCredito.href = luogo.immagine.pagina_fonte;
          linkCredito.target = "_blank";
          linkCredito.rel = "noopener";
          linkCredito.textContent = testoCredito;
          credito.appendChild(linkCredito);
        } else {
          credito.textContent = testoCredito;
        }
        figura.appendChild(credito);
      }
      art.appendChild(figura);
    } else {
      var segnaposto = document.createElement("div");
      segnaposto.className = "card__figura card__figura--segnaposto";
      segnaposto.textContent = ICONE_CATEGORIA[luogo.categoria] || "📍";
      art.appendChild(segnaposto);
    }

    var zona = document.createElement("p");
    zona.className = "card__zona";
    zona.textContent = luogo.zona + " · " + (CATEGORIE_LABEL[luogo.categoria] || luogo.categoria);
    art.appendChild(zona);

    var nome = document.createElement("h3");
    nome.className = "card__nome";
    nome.textContent = luogo.nome;
    art.appendChild(nome);

    var desc = document.createElement("p");
    desc.className = "card__descrizione";
    desc.textContent = luogo.descrizione;
    art.appendChild(desc);

    var badgeRiga = document.createElement("div");
    badgeRiga.className = "card__badge-riga";

    var badge = document.createElement("span");
    badge.className = "badge-passeggino " + luogo.passeggino;
    badge.textContent = PASSEGGINO_ICONA[luogo.passeggino] + " " + PASSEGGINO_LABEL[luogo.passeggino];
    badgeRiga.appendChild(badge);

    var apertura = statoApertura(luogo.orari_struttura);
    if (apertura) {
      var badgeApertura = document.createElement("span");
      badgeApertura.className = "badge-apertura badge-apertura--" + apertura.stato;
      badgeApertura.textContent = apertura.testo;
      badgeRiga.appendChild(badgeApertura);
    }

    if (luogo.prenotazione && luogo.prenotazione.obbligatoria) {
      var badgePren = document.createElement("span");
      badgePren.className = "badge-prenotazione";
      badgePren.textContent = "📅 Prenotazione obbligatoria";
      badgeRiga.appendChild(badgePren);
    }

    art.appendChild(badgeRiga);

    if (luogo.passeggino_nota) {
      var nota = document.createElement("p");
      nota.className = "card__nota-passeggino";
      nota.textContent = luogo.passeggino_nota;
      art.appendChild(nota);
    }

    var dati = document.createElement("div");
    dati.className = "card__dati";
    dati.innerHTML =
      "<span>⏱ " + formatMinuti(luogo.durata_minuti) + " sul posto</span>" +
      "<span>🚗 " + formatMinuti(luogo.tempo_viaggio_minuti) + " di viaggio</span>" +
      "<span>💰 " + (luogo.costo || "da verificare") + "</span>";
    art.appendChild(dati);

    if (luogo.servizi_bimbo) {
      var sb = luogo.servizi_bimbo;
      var righeBimbo = [];
      if (sb.fasciatoio === true) righeBimbo.push("🚼 Fasciatoio");
      else if (sb.fasciatoio === false) righeBimbo.push("🚼 Fasciatoio non risulta");
      if (sb.bagni === true) righeBimbo.push("🚻 Bagni");
      else if (sb.bagni === false) righeBimbo.push("🚻 Bagni pubblici assenti");
      if (righeBimbo.length) {
        var bimboRiga = document.createElement("p");
        bimboRiga.className = "card__servizi-bimbo";
        bimboRiga.textContent = righeBimbo.join(" · ");
        art.appendChild(bimboRiga);
        if (sb.allattamento) {
          var allatt = document.createElement("p");
          allatt.className = "card__nota-passeggino";
          allatt.textContent = "🍼 " + sb.allattamento;
          art.appendChild(allatt);
        }
      }
    }

    if (luogo.parcheggio && luogo.parcheggio.testo) {
      var parcheggioP = document.createElement("p");
      parcheggioP.className = "card__parcheggio";
      parcheggioP.innerHTML = "<strong>🅿️ Parcheggio:</strong> " + luogo.parcheggio.testo;
      art.appendChild(parcheggioP);
    }

    var extraBits = [];
    if (luogo.orari) extraBits.push("Orari: " + luogo.orari);
    else extraBits.push("Orari: da verificare");
    if (luogo.coperto) extraBits.push("al coperto");
    if (luogo.sito) {
      var extra = document.createElement("p");
      extra.className = "card__extra";
      extra.textContent = extraBits.join(" · ") + " · ";
      var a = document.createElement("a");
      a.href = luogo.sito;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "sito ufficiale";
      extra.appendChild(a);
      art.appendChild(extra);
    } else {
      var extra2 = document.createElement("p");
      extra2.className = "card__extra";
      extra2.textContent = extraBits.join(" · ");
      art.appendChild(extra2);
    }

    if (luogo.punto_foto) {
      var puntoFoto = document.createElement("p");
      puntoFoto.className = "card__punto-foto";
      puntoFoto.innerHTML = "<strong>📷 Dove scattare:</strong> " + luogo.punto_foto;
      art.appendChild(puntoFoto);
    }

    var azioni = document.createElement("div");
    azioni.className = "card__azioni";
    var btnMaps = document.createElement("a");
    btnMaps.className = "btn btn-card";
    btnMaps.href = urlMaps(luogo);
    btnMaps.target = "_blank";
    btnMaps.rel = "noopener";
    btnMaps.textContent = "Apri su Maps";
    var btnDir = document.createElement("a");
    btnDir.className = "btn btn-card";
    btnDir.href = urlDirezioni(luogo);
    btnDir.target = "_blank";
    btnDir.rel = "noopener";
    btnDir.textContent = "Come arrivare";
    azioni.appendChild(btnMaps);
    azioni.appendChild(btnDir);
    art.appendChild(azioni);

    var visitatoBox = document.createElement("div");
    visitatoBox.className = "card__visitato";
    var checkboxVis = document.createElement("input");
    checkboxVis.type = "checkbox";
    var idCheck = "visitato-" + luogo.id;
    checkboxVis.id = idCheck;
    checkboxVis.checked = !!(vis && vis.visitato);
    var labelVis = document.createElement("label");
    labelVis.htmlFor = idCheck;
    labelVis.textContent = "Visitato";
    var noteVis = document.createElement("input");
    noteVis.type = "text";
    noteVis.className = "card__nota-libera";
    noteVis.placeholder = "Nota libera (es. tornare al tramonto)…";
    noteVis.value = (vis && vis.nota) || "";

    checkboxVis.addEventListener("change", function () {
      var attuale = stato.visitati[luogo.id] || {};
      attuale.visitato = checkboxVis.checked;
      stato.visitati[luogo.id] = attuale;
      salvaJson(STORAGE_VISITATI, stato.visitati);
      renderLuoghi();
    });
    noteVis.addEventListener("change", function () {
      var attuale = stato.visitati[luogo.id] || {};
      attuale.nota = noteVis.value;
      stato.visitati[luogo.id] = attuale;
      salvaJson(STORAGE_VISITATI, stato.visitati);
    });

    visitatoBox.appendChild(checkboxVis);
    visitatoBox.appendChild(labelVis);
    visitatoBox.appendChild(noteVis);
    art.appendChild(visitatoBox);

    return art;
  }

  function luogoPassaFiltri(luogo) {
    var f = stato.filtri;
    if (f.passeggino && luogo.passeggino !== "ok") return false;
    if (f.senzaAuto) {
      var okMezzo = luogo.mezzo.indexOf("piedi") !== -1 || luogo.mezzo.indexOf("navetta") !== -1;
      if (!okMezzo) return false;
    }
    if (f.coperto && !luogo.coperto) return false;
    if (f.breve && !(luogo.tempo_viaggio_minuti != null && luogo.tempo_viaggio_minuti < 30)) return false;
    if (f.categoria && luogo.categoria !== f.categoria) return false;
    if (f.ricerca) {
      var testo = (luogo.nome + " " + luogo.zona).toLowerCase();
      if (testo.indexOf(f.ricerca) === -1) return false;
    }
    return true;
  }

  function renderLuoghi() {
    var griglia = document.getElementById("griglia-luoghi");
    griglia.innerHTML = "";
    var visibili = stato.luoghi.filter(luogoPassaFiltri);

    visibili.sort(function (a, b) {
      var visA = stato.visitati[a.id] && stato.visitati[a.id].visitato ? 1 : 0;
      var visB = stato.visitati[b.id] && stato.visitati[b.id].visitato ? 1 : 0;
      return visA - visB;
    });

    if (visibili.length === 0) {
      var vuoto = document.createElement("p");
      vuoto.className = "lista-vuota";
      vuoto.textContent = "Nessun luogo corrisponde ai filtri scelti. Prova a toglierne qualcuno.";
      griglia.appendChild(vuoto);
    } else {
      visibili.forEach(function (l) { griglia.appendChild(creaCard(l)); });
    }

    var contatore = document.getElementById("filtri-contatore");
    contatore.textContent = visibili.length + " luoghi su " + stato.luoghi.length;

    aggiornaMappaGenerale(visibili);
  }

  function aggiornaChipCategoria(container) {
    var chips = container.querySelectorAll("[data-categoria]");
    chips.forEach(function (chip) {
      var attivo = stato.filtri.categoria === chip.dataset.categoria;
      chip.setAttribute("aria-pressed", attivo ? "true" : "false");
    });
  }

  function inizializzaFiltri() {
    var campoRicerca = document.getElementById("ricerca-luoghi");
    if (campoRicerca) {
      campoRicerca.addEventListener("input", function () {
        stato.filtri.ricerca = campoRicerca.value.trim().toLowerCase();
        renderLuoghi();
      });
    }

    var riga1 = document.getElementById("filtri-principali");
    riga1.querySelectorAll("[data-filtro]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var chiave = chip.dataset.filtro;
        stato.filtri[chiave] = !stato.filtri[chiave];
        chip.setAttribute("aria-pressed", stato.filtri[chiave] ? "true" : "false");
        renderLuoghi();
      });
    });

    var rigaCat = document.getElementById("filtri-categorie");
    Object.keys(CATEGORIE_LABEL).forEach(function (cat) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.categoria = cat;
      chip.setAttribute("aria-pressed", "false");
      chip.textContent = CATEGORIE_LABEL[cat];
      chip.addEventListener("click", function () {
        stato.filtri.categoria = stato.filtri.categoria === cat ? null : cat;
        aggiornaChipCategoria(rigaCat);
        renderLuoghi();
      });
      rigaCat.appendChild(chip);
    });
  }

  // ---------- Mappa ----------
  function creaIconaMarker(colore, opzioni) {
    opzioni = opzioni || {};
    var dimensione = opzioni.grande ? 26 : 18;
    var simbolo = opzioni.simbolo || "";
    var html = '<span class="mappa__pin" style="background:' + colore + ';width:' + dimensione + 'px;height:' + dimensione + 'px;">' + simbolo + '</span>';
    return L.divIcon({
      className: "mappa__pin-wrapper", html: html,
      iconSize: [dimensione, dimensione], iconAnchor: [dimensione / 2, dimensione / 2], popupAnchor: [0, -dimensione / 2]
    });
  }
  function iconaHotel() { return creaIconaMarker("#12312A", { grande: true, simbolo: "🏨" }); }

  function popupHtmlLuogo(luogo) {
    return '<div class="mappa__popup">' +
      '<strong>' + luogo.nome + '</strong><br>' +
      '<span>' + PASSEGGINO_ICONA[luogo.passeggino] + ' ' + PASSEGGINO_LABEL[luogo.passeggino] + '</span><br>' +
      '<a href="' + urlMaps(luogo) + '" target="_blank" rel="noopener">Apri su Maps</a> · ' +
      '<a href="' + urlDirezioni(luogo) + '" target="_blank" rel="noopener">Come arrivare</a>' +
      '</div>';
  }

  function inizializzaMappaGenerale() {
    if (typeof L === "undefined") return;
    var el = document.getElementById("mappa-generale");
    if (!el) return;
    var mappa = L.map(el, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> collaboratori'
    }).addTo(mappa);
    stato.mappaGenerale = mappa;
    stato.stratoMarkerGenerale = L.layerGroup().addTo(mappa);
  }

  function aggiornaMappaGenerale(luoghi) {
    if (!stato.mappaGenerale) return;
    stato.stratoMarkerGenerale.clearLayers();
    var puntiPerBounds = [];
    if (stato.base) {
      var hotelMarker = L.marker([stato.base.lat, stato.base.lng], { icon: iconaHotel() });
      hotelMarker.bindPopup('<div class="mappa__popup"><strong>' + stato.base.nome + '</strong><br>Base del soggiorno</div>');
      stato.stratoMarkerGenerale.addLayer(hotelMarker);
      puntiPerBounds.push([stato.base.lat, stato.base.lng]);
    }
    luoghi.forEach(function (l) {
      var marker = L.marker([l.lat, l.lng], { icon: creaIconaMarker(COLORE_PASSEGGINO[l.passeggino]) });
      marker.bindPopup(popupHtmlLuogo(l));
      stato.stratoMarkerGenerale.addLayer(marker);
      puntiPerBounds.push([l.lat, l.lng]);
    });
    if (puntiPerBounds.length > 0) {
      stato.mappaGenerale.fitBounds(puntiPerBounds, { padding: [24, 24], maxZoom: 13 });
    }
  }

  function creaMappaGiorno(contenitoreGiorno, idMappa, luoghiGiorno) {
    if (typeof L === "undefined") return;
    if (stato.mappeGiorno[idMappa]) { stato.mappeGiorno[idMappa].remove(); delete stato.mappeGiorno[idMappa]; }
    if (luoghiGiorno.length === 0) return;

    var div = document.createElement("div");
    div.className = "mappa mappa--giorno";
    div.id = idMappa;
    contenitoreGiorno.appendChild(div);

    var mappa = L.map(div, { scrollWheelZoom: false, zoomControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(mappa);

    var punti = [], percorso = [];
    if (stato.base) {
      L.marker([stato.base.lat, stato.base.lng], { icon: iconaHotel() }).bindPopup('<div class="mappa__popup"><strong>' + stato.base.nome + '</strong></div>').addTo(mappa);
      punti.push([stato.base.lat, stato.base.lng]);
      percorso.push([stato.base.lat, stato.base.lng]);
    }
    luoghiGiorno.forEach(function (l) {
      L.marker([l.lat, l.lng], { icon: creaIconaMarker(COLORE_PASSEGGINO[l.passeggino]) }).bindPopup(popupHtmlLuogo(l)).addTo(mappa);
      punti.push([l.lat, l.lng]);
      percorso.push([l.lat, l.lng]);
    });
    if (percorso.length > 1) L.polyline(percorso, { color: "#22409A", weight: 2, dashArray: "6 6", opacity: .7 }).addTo(mappa);

    mappa.fitBounds(punti, { padding: [20, 20], maxZoom: 14 });
    stato.mappeGiorno[idMappa] = mappa;
  }

  // ---------- Giorni ----------
  function creaSelectGiorno(luogo) {
    var select = document.createElement("select");
    select.setAttribute("aria-label", "Sposta " + luogo.nome + " in un altro giorno");

    var optNessuno = document.createElement("option");
    optNessuno.value = "";
    optNessuno.textContent = "Non assegnato";
    select.appendChild(optNessuno);

    GIORNI_ORDINE.forEach(function (g) {
      var opt = document.createElement("option");
      opt.value = String(g);
      opt.textContent = GIORNI_DATE[g];
      select.appendChild(opt);
    });

    var attuale = stato.assegnazioni[luogo.id];
    select.value = attuale ? String(attuale) : "";

    select.addEventListener("change", function () {
      var vecchioGiorno = stato.assegnazioni[luogo.id];
      var nuovoGiorno = select.value ? parseInt(select.value, 10) : null;
      stato.assegnazioni[luogo.id] = nuovoGiorno;
      salvaAssegnazioni();
      aggiornaOrdineDopoSpostamento(luogo.id, vecchioGiorno, nuovoGiorno);
      renderGiorni();
      aggiornaBudget();
    });

    return select;
  }

  function creaInputPartenza(g) {
    var wrapper = document.createElement("label");
    wrapper.className = "giorno__partenza";
    wrapper.textContent = "Partenza dall'hotel: ";
    var input = document.createElement("input");
    input.type = "time";
    input.value = stato.partenzePerGiorno[g] || "09:30";
    input.addEventListener("change", function () {
      stato.partenzePerGiorno[g] = input.value;
      salvaJson(STORAGE_PARTENZE, stato.partenzePerGiorno);
      renderGiorni();
    });
    wrapper.appendChild(input);
    return wrapper;
  }

  function renderGiorni() {
    var contenitore = document.getElementById("giorni-lista");
    contenitore.innerHTML = "";

    GIORNI_ORDINE.forEach(function (g) {
      var luoghiGiorno = luoghiDelGiorno(g);

      var box = document.createElement("div");
      box.className = "giorno";
      if (stato.meteoGiornoPioggia[g]) box.classList.add("giorno--pioggia");

      var intest = document.createElement("div");
      intest.className = "giorno__intestazione";

      var titolo = document.createElement("h3");
      titolo.className = "giorno__titolo";
      titolo.textContent = GIORNI_DATE[g];
      intest.appendChild(titolo);

      var meteoGiorno = stato.meteoPerGiorno[g];
      if (meteoGiorno) {
        var chipMeteo = document.createElement("span");
        chipMeteo.className = "giorno__meteo-chip";
        chipMeteo.textContent = meteoGiorno.icona + " " + meteoGiorno.min + "°/" + meteoGiorno.max + "°" + (meteoGiorno.storico ? " (media)" : "");
        intest.appendChild(chipMeteo);
      }

      var totaleMin = luoghiGiorno.reduce(function (s, l) { return s + (l.tempo_viaggio_minuti || 0); }, 0);
      var durataMin = luoghiGiorno.reduce(function (s, l) { return s + (l.durata_minuti || 0); }, 0);
      var totale = document.createElement("span");
      totale.className = "giorno__totale";
      totale.textContent = formatMinuti(totaleMin) + " di viaggio totali";
      intest.appendChild(totale);

      box.appendChild(intest);

      if (stato.meteoGiornoPioggia[g]) {
        var avviso = document.createElement("p");
        avviso.className = "giorno__avviso-pioggia";
        avviso.textContent = "☔ Pioggia probabile: valuta le alternative al coperto.";
        box.appendChild(avviso);
      }

      var fuoriCasaMin = totaleMin + durataMin;
      if (fuoriCasaMin > 360) {
        var avvisoRitmo = document.createElement("p");
        avvisoRitmo.className = "giorno__avviso-ritmo";
        avvisoRitmo.textContent = "👶 Giornata lunga: " + formatMinuti(fuoriCasaMin) + " fuori dall'hotel. Con un neonato di 4 mesi valuta di alleggerirla o di inserire una pausa a metà.";
        box.appendChild(avvisoRitmo);
      }
      luoghiGiorno.forEach(function (l) {
        if (l.durata_minuti && l.durata_minuti > 180) {
          var avvisoTappa = document.createElement("p");
          avvisoTappa.className = "giorno__avviso-ritmo";
          avvisoTappa.textContent = "👶 \"" + l.nome + "\" dura circa " + formatMinuti(l.durata_minuti) + " sul posto: pensa a una pausa poppata/nanna a metà.";
          box.appendChild(avvisoTappa);
        }
      });

      if (luoghiGiorno.length === 0) {
        var vuoto = document.createElement("p");
        vuoto.className = "giorno--vuoto";
        vuoto.textContent = "Nessun luogo assegnato.";
        box.appendChild(vuoto);
      } else {
        box.appendChild(creaInputPartenza(g));

        var orarioCorrente = parseOra(stato.partenzePerGiorno[g] || "09:30");

        luoghiGiorno.forEach(function (l, indice) {
          orarioCorrente += (l.tempo_viaggio_minuti || 0);
          var orarioArrivo = orarioCorrente;
          orarioCorrente += (l.durata_minuti || 0);

          var voce = document.createElement("div");
          voce.className = "giorno__voce";

          var info = document.createElement("div");
          var nomeEl = document.createElement("div");
          nomeEl.className = "giorno__voce-nome";
          nomeEl.textContent = (indice + 1) + ". " + l.nome + (l.coperto ? " ☂" : "");
          var metaEl = document.createElement("div");
          metaEl.className = "giorno__voce-meta";
          metaEl.textContent = formatOra(orarioArrivo) + " circa · " + formatMinuti(l.tempo_viaggio_minuti) + " di viaggio · " + PASSEGGINO_ICONA[l.passeggino];
          info.appendChild(nomeEl);
          info.appendChild(metaEl);
          voce.appendChild(info);

          var azioniVoce = document.createElement("div");
          azioniVoce.className = "giorno__voce-azioni";

          var riordina = document.createElement("div");
          riordina.className = "giorno__voce-riordina";
          var btnSu = document.createElement("button");
          btnSu.type = "button";
          btnSu.textContent = "▲";
          btnSu.setAttribute("aria-label", "Sposta su " + l.nome);
          btnSu.disabled = indice === 0;
          btnSu.addEventListener("click", function () { spostaOrdineGiorno(g, l.id, -1); });
          var btnGiu = document.createElement("button");
          btnGiu.type = "button";
          btnGiu.textContent = "▼";
          btnGiu.setAttribute("aria-label", "Sposta giù " + l.nome);
          btnGiu.disabled = indice === luoghiGiorno.length - 1;
          btnGiu.addEventListener("click", function () { spostaOrdineGiorno(g, l.id, 1); });
          riordina.appendChild(btnSu);
          riordina.appendChild(btnGiu);
          azioniVoce.appendChild(riordina);

          azioniVoce.appendChild(creaSelectGiorno(l));
          voce.appendChild(azioniVoce);
          box.appendChild(voce);
        });

        var rientro = document.createElement("p");
        rientro.className = "giorno__rientro";
        rientro.textContent = "Rientro stimato in hotel intorno alle " + formatOra(orarioCorrente + (luoghiGiorno[luoghiGiorno.length - 1].tempo_viaggio_minuti || 0)) + " (orari indicativi, si spostano coi ritmi del bimbo).";
        box.appendChild(rientro);
      }

      contenitore.appendChild(box);
      creaMappaGiorno(box, "mappa-giorno-" + g, luoghiGiorno);
    });

    var giornoOggi = calcolaGiornoOggi();
    if (giornoOggi) renderOggi();
  }

  function aggiornaBudget() {
    var el = document.getElementById("budget-totale");
    if (!el) return;
    var totale = 0;
    var mancanti = 0;
    stato.luoghi.forEach(function (l) {
      if (stato.assegnazioni[l.id]) {
        if (l.costo_eur != null) totale += l.costo_eur;
        else mancanti++;
      }
    });
    var testo = "Spesa stimata per le tappe assegnate ai giorni (2 adulti, biglietti e impianti, escluso parcheggio e cibo): circa " + totale + " €.";
    if (mancanti > 0) testo += " " + mancanti + " tappa/e con prezzo da verificare non incluse nel totale.";
    el.textContent = testo;
  }

  // ---------- Meteo ----------
  var METEO_LAT = 46.1746;
  var METEO_LNG = 11.0657;
  var DATA_INIZIO = "2026-08-25";
  var DATA_FINE = "2026-08-30";

  var WEATHER_ICONE = {
    0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️", 45: "🌫", 48: "🌫",
    51: "🌦", 53: "🌦", 55: "🌦", 61: "🌧", 63: "🌧", 65: "🌧",
    71: "🌨", 73: "🌨", 75: "🌨", 80: "🌦", 81: "🌧", 82: "⛈",
    95: "⛈", 96: "⛈", 99: "⛈"
  };
  function iconaMeteo(codice) { return WEATHER_ICONE[codice] || "🌡"; }

  function formatDataBreve(iso) {
    var d = new Date(iso + "T00:00:00");
    return GIORNI_SETTIMANA_JS[d.getDay()] + " " + d.getDate() + "/08";
  }

  function mappaGiornoDaData(iso) {
    var mappaData = { "2026-08-25": 1, "2026-08-26": 2, "2026-08-27": 3, "2026-08-28": 4, "2026-08-29": 5, "2026-08-30": 6 };
    return mappaData[iso];
  }

  function renderMeteoPrevisione(dati) {
    var container = document.getElementById("meteo-contenuto");
    container.innerHTML = "";

    var etichetta = document.createElement("p");
    etichetta.className = "meteo__etichetta";
    var oggi = new Date().toISOString().slice(0, 10);
    etichetta.textContent = "Previsione aggiornata al " + formatDataBreve(oggi);
    container.appendChild(etichetta);

    var griglia = document.createElement("div");
    griglia.className = "meteo__griglia";

    dati.daily.time.forEach(function (data, i) {
      var pioggiaProb = dati.daily.precipitation_probability_max[i];
      var giornoNum = mappaGiornoDaData(data);
      if (giornoNum && pioggiaProb != null && pioggiaProb >= 50) stato.meteoGiornoPioggia[giornoNum] = true;
      if (giornoNum) {
        stato.meteoPerGiorno[giornoNum] = {
          min: Math.round(dati.daily.temperature_2m_min[i]),
          max: Math.round(dati.daily.temperature_2m_max[i]),
          icona: iconaMeteo(dati.daily.weather_code[i]),
          storico: false
        };
      }
      var box = document.createElement("div");
      box.className = "meteo__giorno";
      box.innerHTML =
        '<div class="meteo__giorno-data">' + formatDataBreve(data) + '</div>' +
        '<div class="meteo__giorno-icona">' + iconaMeteo(dati.daily.weather_code[i]) + '</div>' +
        '<div class="meteo__giorno-temp">' + Math.round(dati.daily.temperature_2m_min[i]) + '° / ' + Math.round(dati.daily.temperature_2m_max[i]) + '°</div>' +
        '<div class="meteo__giorno-pioggia">💧 ' + (pioggiaProb != null ? pioggiaProb + '%' : 'n/d') + '</div>';
      griglia.appendChild(box);
    });

    container.appendChild(griglia);
    renderGiorni();
    renderOggi();
  }

  function renderMeteoStorico(dati) {
    var container = document.getElementById("meteo-contenuto");
    container.innerHTML = "";

    var etichetta = document.createElement("p");
    etichetta.className = "meteo__etichetta";
    etichetta.textContent = "Media degli ultimi 10 anni, non è una previsione";
    container.appendChild(etichetta);

    var notaRicontrolla = document.createElement("p");
    notaRicontrolla.className = "meteo__nota-ricontrolla";
    notaRicontrolla.textContent = "La previsione reale è disponibile solo da circa 16 giorni prima della partenza: ricontrolla questa pagina più vicino al 25 agosto per vederla al posto della media.";
    container.appendChild(notaRicontrolla);

    var griglia = document.createElement("div");
    griglia.className = "meteo__griglia";

    var giorniTarget = ["08-25", "08-26", "08-27", "08-28", "08-29", "08-30"];
    var perGiorno = {};
    giorniTarget.forEach(function (g) { perGiorno[g] = { max: [], min: [], pioggia: [] }; });

    dati.daily.time.forEach(function (data, i) {
      var mmgg = data.slice(5);
      if (perGiorno[mmgg]) {
        var max = dati.daily.temperature_2m_max[i];
        var min = dati.daily.temperature_2m_min[i];
        var prec = dati.daily.precipitation_sum[i];
        if (max != null) perGiorno[mmgg].max.push(max);
        if (min != null) perGiorno[mmgg].min.push(min);
        if (prec != null) perGiorno[mmgg].pioggia.push(prec > 1 ? 1 : 0);
      }
    });

    function media(arr) {
      if (!arr.length) return null;
      return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
    }

    giorniTarget.forEach(function (mmgg, idx) {
      var g = perGiorno[mmgg];
      var mediaMax = media(g.max);
      var mediaMin = media(g.min);
      var probPioggia = media(g.pioggia);
      var giornoNum = idx + 1;
      if (probPioggia != null && probPioggia >= 0.5) stato.meteoGiornoPioggia[giornoNum] = true;
      stato.meteoPerGiorno[giornoNum] = {
        min: mediaMin != null ? Math.round(mediaMin) : "n/d",
        max: mediaMax != null ? Math.round(mediaMax) : "n/d",
        icona: "📊", storico: true
      };

      var box = document.createElement("div");
      box.className = "meteo__giorno";
      box.innerHTML =
        '<div class="meteo__giorno-data">' + GIORNI_DATE[giornoNum].split(" ")[1] + ' ' + mmgg.replace("08-", "") + '/08</div>' +
        '<div class="meteo__giorno-icona">📊</div>' +
        '<div class="meteo__giorno-temp">' + (mediaMin != null ? Math.round(mediaMin) : "n/d") + '° / ' + (mediaMax != null ? Math.round(mediaMax) : "n/d") + '°</div>' +
        '<div class="meteo__giorno-pioggia">💧 ' + (probPioggia != null ? Math.round(probPioggia * 100) + '%' : 'n/d') + '</div>';
      griglia.appendChild(box);
    });

    container.appendChild(griglia);
    renderGiorni();
    renderOggi();
  }

  function renderMeteoErrore(msg) {
    var container = document.getElementById("meteo-contenuto");
    container.innerHTML = "";
    var p = document.createElement("p");
    p.className = "meteo__errore";
    p.textContent = msg;
    container.appendChild(p);
  }

  function caricaMeteo() {
    var urlPrevisione = "https://api.open-meteo.com/v1/forecast?latitude=" + METEO_LAT + "&longitude=" + METEO_LNG +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code" +
      "&timezone=Europe%2FRome&start_date=" + DATA_INIZIO + "&end_date=" + DATA_FINE;

    fetch(urlPrevisione)
      .then(function (r) { return r.json(); })
      .then(function (dati) {
        if (dati.daily && dati.daily.time && dati.daily.time.length > 0 &&
          dati.daily.temperature_2m_max.some(function (v) { return v != null; })) {
          renderMeteoPrevisione(dati);
        } else {
          caricaMeteoStorico();
        }
      })
      .catch(function () { caricaMeteoStorico(); });
  }

  function caricaMeteoStorico() {
    var annoCorrente = new Date().getFullYear();
    var startArchivio = (annoCorrente - 10) + "-08-25";
    var endArchivio = (annoCorrente - 1) + "-08-30";

    var url = "https://archive-api.open-meteo.com/v1/archive?latitude=" + METEO_LAT + "&longitude=" + METEO_LNG +
      "&start_date=" + startArchivio + "&end_date=" + endArchivio +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FRome";

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (dati) {
        if (dati.daily && dati.daily.time) renderMeteoStorico(dati);
        else renderMeteoErrore("Non è stato possibile caricare i dati meteo storici. Riprova più tardi.");
      })
      .catch(function () { renderMeteoErrore("Non è stato possibile contattare il servizio meteo. Controlla la connessione e riprova."); });
  }

  // ---------- Servizi vicino hotel (farmacia/supermercato) ----------
  var TIPO_SERVIZIO_ICONA = { farmacia: "💊", supermercato: "🛒" };
  var TIPO_SERVIZIO_LABEL = { farmacia: "Farmacia", supermercato: "Supermercato" };
  var ZONE_ORDINE_SERVIZI = ["Fai della Paganella", "Andalo", "Molveno", "Spormaggiore", "Mezzolombardo", "Mezzocorona"];

  function creaCardServizio(s) {
    var card = document.createElement("article");
    card.className = "card card--servizio";

    var tipo = document.createElement("p");
    tipo.className = "card__zona";
    tipo.textContent = (TIPO_SERVIZIO_ICONA[s.tipo] || "📍") + " " + (TIPO_SERVIZIO_LABEL[s.tipo] || s.tipo);
    card.appendChild(tipo);

    var nome = document.createElement("h3");
    nome.className = "card__nome";
    nome.textContent = s.nome;
    card.appendChild(nome);

    var indirizzo = document.createElement("p");
    indirizzo.className = "card__descrizione";
    indirizzo.textContent = s.indirizzo;
    card.appendChild(indirizzo);

    var dati = document.createElement("div");
    dati.className = "card__dati";
    dati.innerHTML = "<span>🕒 " + (s.orari || "orari da verificare") + "</span>" + (s.telefono ? "<span>📞 " + s.telefono + "</span>" : "");
    card.appendChild(dati);

    if (s.note) {
      var nota = document.createElement("p");
      nota.className = "card__nota-passeggino";
      nota.textContent = s.note;
      card.appendChild(nota);
    }

    var azioni = document.createElement("div");
    azioni.className = "card__azioni";
    var btnMaps = document.createElement("a");
    btnMaps.className = "btn btn-card";
    btnMaps.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.indirizzo);
    btnMaps.target = "_blank";
    btnMaps.rel = "noopener";
    btnMaps.textContent = "Apri su Maps";
    azioni.appendChild(btnMaps);
    if (s.telefono) {
      var btnTel = document.createElement("a");
      btnTel.className = "btn btn-card";
      btnTel.href = "tel:" + s.telefono;
      btnTel.textContent = "Chiama";
      azioni.appendChild(btnTel);
    }
    card.appendChild(azioni);
    return card;
  }

  function renderServizi() {
    var contenitore = document.getElementById("griglia-servizi");
    if (!contenitore) return;
    contenitore.innerHTML = "";

    var zoneUsate = ZONE_ORDINE_SERVIZI.filter(function (zona) {
      return stato.servizi.some(function (s) { return s.zona === zona; });
    });

    zoneUsate.forEach(function (zona) {
      var gruppo = document.createElement("div");
      gruppo.className = "servizi-zona";
      var titoloZona = document.createElement("h3");
      titoloZona.className = "servizi-zona__titolo";
      titoloZona.textContent = zona;
      gruppo.appendChild(titoloZona);

      var griglia = document.createElement("div");
      griglia.className = "griglia-servizi";
      stato.servizi.filter(function (s) { return s.zona === zona; }).forEach(function (s) {
        griglia.appendChild(creaCardServizio(s));
      });
      gruppo.appendChild(griglia);
      contenitore.appendChild(gruppo);
    });
  }

  // ---------- Dove mangiare (locali) ----------
  function creaCardLocale(loc) {
    var card = document.createElement("article");
    card.className = "card card--servizio";

    var tipo = document.createElement("p");
    tipo.className = "card__zona";
    tipo.textContent = (TIPO_LOCALE_ICONA[loc.tipo] || "📍") + " " + (TIPO_LOCALE_LABEL[loc.tipo] || loc.tipo) + " · " + loc.zona;
    card.appendChild(tipo);

    var nome = document.createElement("h3");
    nome.className = "card__nome";
    nome.textContent = loc.nome;
    card.appendChild(nome);

    if (loc.indirizzo) {
      var indirizzo = document.createElement("p");
      indirizzo.className = "card__descrizione";
      indirizzo.textContent = loc.indirizzo;
      card.appendChild(indirizzo);
    }

    var dati = document.createElement("div");
    dati.className = "card__dati";
    dati.innerHTML = "<span>🕒 " + (loc.orari || "orari da verificare") + "</span>" + (loc.telefono ? "<span>📞 " + loc.telefono + "</span>" : "");
    card.appendChild(dati);

    if (loc.family) {
      var fam = document.createElement("p");
      fam.className = "card__servizi-bimbo";
      fam.textContent = "👶 " + loc.family;
      card.appendChild(fam);
    }
    if (loc.note) {
      var nota = document.createElement("p");
      nota.className = "card__nota-passeggino";
      nota.textContent = loc.note;
      card.appendChild(nota);
    }

    var azioni = document.createElement("div");
    azioni.className = "card__azioni";
    if (loc.indirizzo) {
      var btnMaps = document.createElement("a");
      btnMaps.className = "btn btn-card";
      btnMaps.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(loc.indirizzo);
      btnMaps.target = "_blank";
      btnMaps.rel = "noopener";
      btnMaps.textContent = "Apri su Maps";
      azioni.appendChild(btnMaps);
    }
    if (loc.telefono) {
      var btnTel = document.createElement("a");
      btnTel.className = "btn btn-card";
      btnTel.href = "tel:" + loc.telefono;
      btnTel.textContent = "Chiama";
      azioni.appendChild(btnTel);
    }
    card.appendChild(azioni);
    return card;
  }

  function renderLocali() {
    var chips = document.getElementById("filtri-locali");
    var griglia = document.getElementById("griglia-locali");
    if (!griglia) return;

    if (chips && chips.children.length === 0) {
      var tipiPresenti = [];
      stato.locali.forEach(function (l) { if (tipiPresenti.indexOf(l.tipo) === -1) tipiPresenti.push(l.tipo); });
      tipiPresenti.forEach(function (tipo) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.dataset.tipo = tipo;
        chip.setAttribute("aria-pressed", "false");
        chip.textContent = (TIPO_LOCALE_ICONA[tipo] || "") + " " + (TIPO_LOCALE_LABEL[tipo] || tipo);
        chip.addEventListener("click", function () {
          stato.filtriLocali.tipo = stato.filtriLocali.tipo === tipo ? null : tipo;
          chips.querySelectorAll("[data-tipo]").forEach(function (c) {
            c.setAttribute("aria-pressed", c.dataset.tipo === stato.filtriLocali.tipo ? "true" : "false");
          });
          renderLocali();
        });
        chips.appendChild(chip);
      });
    }

    griglia.innerHTML = "";
    var visibili = stato.locali.filter(function (l) {
      return !stato.filtriLocali.tipo || l.tipo === stato.filtriLocali.tipo;
    });
    visibili.forEach(function (l) { griglia.appendChild(creaCardLocale(l)); });
  }

  // ---------- Eventi ----------
  function renderEventi() {
    var griglia = document.getElementById("griglia-eventi");
    var notaEl = document.getElementById("eventi-nota");
    if (!griglia) return;
    if (notaEl) notaEl.textContent = stato.eventiNota || "";

    griglia.innerHTML = "";
    GIORNI_ORDINE.forEach(function (g) {
      var eventiGiorno = stato.eventi.filter(function (e) { return e.giorno === g; });
      if (eventiGiorno.length === 0) return;

      var gruppo = document.createElement("div");
      gruppo.className = "servizi-zona";
      var titolo = document.createElement("h3");
      titolo.className = "servizi-zona__titolo";
      titolo.textContent = GIORNI_DATE[g];
      gruppo.appendChild(titolo);

      var lista = document.createElement("div");
      lista.className = "griglia-servizi";
      eventiGiorno.forEach(function (e) {
        var card = document.createElement("article");
        card.className = "card card--servizio";
        var meta = document.createElement("p");
        meta.className = "card__zona";
        meta.textContent = "🎉 " + e.luogo + (e.orario ? " · " + e.orario : "");
        card.appendChild(meta);
        var nome = document.createElement("h3");
        nome.className = "card__nome";
        nome.textContent = e.nome;
        card.appendChild(nome);
        var desc = document.createElement("p");
        desc.className = "card__descrizione";
        desc.textContent = e.descrizione;
        card.appendChild(desc);
        var badge = document.createElement("p");
        badge.className = "card__extra";
        badge.textContent = (e.adatto_bimbi ? "👶 Adatto ai bambini" : "🔞 Meno indicato per i bambini") + (e.prenotazione ? " · 📅 Su prenotazione" : "");
        card.appendChild(badge);
        lista.appendChild(card);
      });
      gruppo.appendChild(lista);
      griglia.appendChild(gruppo);
    });
  }

  // ---------- Prenotazioni con scadenze ----------
  function renderPrenotazioni() {
    var lista = document.getElementById("lista-prenotazioni");
    if (!lista) return;
    lista.innerHTML = "";
    var fatte = stato.prenotazioniFatte;

    stato.prenotazioni.forEach(function (p, i) {
      var li = document.createElement("li");
      li.className = "checklist__voce checklist__voce--prenotazione";
      var id = "prenotazione-" + i;
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = id;
      checkbox.checked = !!fatte[i];
      checkbox.addEventListener("change", function () {
        fatte[i] = checkbox.checked;
        salvaJson(STORAGE_PRENOTAZIONI, fatte);
      });
      var label = document.createElement("label");
      label.htmlFor = id;
      var nomeLuogoTesto = "";
      var luogoCollegato = stato.luoghi.filter(function (l) { return l.id === p.luogo_id; })[0];
      if (luogoCollegato) nomeLuogoTesto = luogoCollegato.nome + " — ";
      label.innerHTML = "<strong>" + nomeLuogoTesto + p.cosa + "</strong><br><span class=\"prenotazione__dettaglio\">Entro: " + p.entro + " · Come: " + p.come + "</span><br><span class=\"prenotazione__dettaglio\">" + p.nota + "</span>";
      li.appendChild(checkbox);
      li.appendChild(label);
      lista.appendChild(li);
    });
  }

  // ---------- Guest Card ----------
  function renderGuestCard() {
    var el = document.getElementById("contenuto-guestcard");
    if (!el || !stato.guestCard) return;
    var gc = stato.guestCard;
    el.innerHTML =
      '<div class="riquadro-info">' +
      '<p><strong>' + gc.nome + '</strong> — ' + (gc.gratuita ? 'gratuita' : 'a pagamento') + '</p>' +
      '<p>' + gc.comeSiOttiene + '</p>' +
      '<p><strong>Trasporti inclusi:</strong> ' + gc.trasportiInclusi + '</p>' +
      '<p><strong>Sconti principali:</strong></p>' +
      '<ul>' + gc.sconti.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>' +
      '<p><strong>Bambini:</strong> ' + gc.noteBambini + '</p>' +
      '<p class="riquadro-info__nota">' + gc.note + '</p>' +
      '</div>';
  }

  // ---------- Trasporti pubblici ----------
  function renderTrasporti() {
    var el = document.getElementById("contenuto-trasporti");
    if (!el || !stato.trasportiPubblici) return;
    var t = stato.trasportiPubblici;
    var linea = t.lineaPrincipale;
    el.innerHTML =
      '<div class="riquadro-info">' +
      '<p><strong>' + linea.nome + '</strong></p>' +
      '<p>' + linea.fermataFai + '</p>' +
      '<p><strong>Frequenza:</strong> ' + linea.frequenza + '</p>' +
      '<p><strong>Durata:</strong> ' + linea.durata + '</p>' +
      '<p>' + linea.note + '</p>' +
      '<p><strong>Navetta locale:</strong> ' + t.navettaLocale + '</p>' +
      '<p><strong>Passeggino sui bus:</strong> ' + t.passegginoSuiBus + '</p>' +
      '</div>';
  }

  // ---------- Viaggio A/R ----------
  function renderViaggio() {
    var el = document.getElementById("contenuto-viaggio");
    if (!el || !stato.viaggio) return;
    var v = stato.viaggio;
    el.innerHTML =
      '<div class="riquadro-info">' +
      '<p><strong>' + v.partenza.indirizzo + '</strong> → <strong>' + v.arrivo.indirizzo + '</strong></p>' +
      '<p>' + Math.round(v.distanzaKm) + ' km circa, ' + formatMinuti(v.durataMinuti) + ' di guida (esclusa la sosta), pedaggio stimato ' + v.pedaggioStimatoEur + ' € a tratta.</p>' +
      '<p><strong>Percorso:</strong> ' + v.percorso + '</p>' +
      '<p><strong>Soste con un neonato:</strong> ' + v.noteSoste + '</p>' +
      '<p class="riquadro-info__nota">' + v.fonte + ' Lo stesso percorso, a ritroso, vale per il rientro del 30 agosto.</p>' +
      '</div>';
  }

  // ---------- Modalità Oggi + suggeritore ----------
  function suggerisciAdesso() {
    var giorno = calcolaGiornoOggi();
    var pioggia = giorno ? !!stato.meteoGiornoPioggia[giorno] : false;
    var assegnatiOggi = giorno ? luoghiDelGiorno(giorno).map(function (l) { return l.id; }) : [];

    var candidati = stato.luoghi.slice().sort(function (a, b) {
      var scoreA = (assegnatiOggi.indexOf(a.id) !== -1 ? -1000 : 0) + (pioggia && !a.coperto ? 2000 : 0) + (a.tempo_viaggio_minuti || 0);
      var scoreB = (assegnatiOggi.indexOf(b.id) !== -1 ? -1000 : 0) + (pioggia && !b.coperto ? 2000 : 0) + (b.tempo_viaggio_minuti || 0);
      return scoreA - scoreB;
    });

    return { pioggia: pioggia, giorno: giorno, scelti: candidati.slice(0, 3) };
  }

  function renderSuggerimento(contenitore) {
    var s = suggerisciAdesso();
    var motivazione = s.pioggia ? "Piove probabilmente oggi, quindi propongo tappe al coperto o vicine." : "Ecco le tappe più comode partendo da adesso.";
    var html = '<p class="suggeritore__motivo">' + motivazione + '</p><ul class="suggeritore__lista">';
    s.scelti.forEach(function (l) {
      html += '<li><strong>' + l.nome + '</strong> — ' + formatMinuti(l.tempo_viaggio_minuti) + ' di viaggio' + (l.coperto ? ', al coperto ☂' : '') + '</li>';
    });
    html += '</ul>';
    contenitore.innerHTML = html;
  }

  function renderOggi() {
    var sezione = document.getElementById("sezione-oggi");
    var box = document.getElementById("riquadro-oggi");
    if (!sezione || !box) return;

    var g = calcolaGiornoOggi();
    if (!g) { sezione.hidden = true; return; }
    sezione.hidden = false;

    var luoghiOggi = luoghiDelGiorno(g);
    var meteoOggi = stato.meteoPerGiorno[g];

    var html = '<h2 id="titolo-oggi">Oggi — ' + GIORNI_DATE[g] + '</h2>';
    if (meteoOggi) {
      html += '<p class="riquadro-oggi__meteo">' + meteoOggi.icona + ' ' + meteoOggi.min + '°/' + meteoOggi.max + '°' + (stato.meteoGiornoPioggia[g] ? ' · ☔ pioggia probabile' : '') + '</p>';
    }
    if (luoghiOggi.length > 0) {
      html += '<p><strong>In programma:</strong> ' + luoghiOggi.map(function (l) { return l.nome; }).join(' → ') + '</p>';
    } else {
      html += '<p>Nessuna tappa assegnata a oggi.</p>';
    }
    html += '<button type="button" class="btn btn-primario" id="btn-suggerisci">Cosa facciamo adesso?</button>';
    html += '<div id="risultato-suggerimento"></div>';

    box.innerHTML = html;

    var btn = document.getElementById("btn-suggerisci");
    if (btn) {
      btn.addEventListener("click", function () {
        renderSuggerimento(document.getElementById("risultato-suggerimento"));
      });
    }
  }

  // ---------- Numeri utili ----------
  function renderNumeriUtili() {
    var lista = document.getElementById("lista-numeri-utili");
    if (!lista) return;
    lista.innerHTML = "";
    stato.numeriUtili.forEach(function (n) {
      var voce = document.createElement("li");
      voce.className = "numero-utile";
      var testo = document.createElement("div");
      var nomeEl = document.createElement("div");
      nomeEl.className = "numero-utile__nome";
      nomeEl.textContent = n.nome;
      var notaEl = document.createElement("div");
      notaEl.className = "numero-utile__nota";
      notaEl.textContent = n.nota;
      testo.appendChild(nomeEl);
      testo.appendChild(notaEl);
      voce.appendChild(testo);
      var link = document.createElement("a");
      link.className = "btn btn-card numero-utile__telefono";
      link.href = "tel:" + n.telefono;
      link.textContent = n.telefono;
      voce.appendChild(link);
      lista.appendChild(voce);
    });
  }

  // ---------- Checklist bagaglio ----------
  function renderChecklist() {
    var lista = document.getElementById("checklist-bagaglio");
    if (!lista) return;
    lista.innerHTML = "";
    var salvati = caricaJson(STORAGE_CHECKLIST, {});

    CHECKLIST_ITEMS.forEach(function (voce, i) {
      var li = document.createElement("li");
      li.className = "checklist__voce";
      var id = "checklist-item-" + i;
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = id;
      checkbox.checked = !!salvati[i];
      checkbox.addEventListener("change", function () {
        var stati = caricaJson(STORAGE_CHECKLIST, {});
        stati[i] = checkbox.checked;
        salvaJson(STORAGE_CHECKLIST, stati);
      });
      var label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = voce;
      li.appendChild(checkbox);
      li.appendChild(label);
      lista.appendChild(li);
    });
  }

  // ---------- Foglio stampabile ----------
  function costruisciFoglioStampa() {
    var el = document.getElementById("foglio-stampa");
    if (!el) return;
    var html = '<h1>Fai della Paganella — Foglio d\'emergenza</h1><p>25-30 agosto 2026 · Hotel Arcobaleno, Via Cesare Battisti 45, tel. 0461583306</p>';

    html += '<h2>Numeri utili</h2><ul>';
    stato.numeriUtili.forEach(function (n) { html += '<li><strong>' + n.nome + ':</strong> ' + n.telefono + '</li>'; });
    html += '</ul>';

    html += '<h2>I sei giorni</h2>';
    GIORNI_ORDINE.forEach(function (g) {
      var luoghiGiorno = luoghiDelGiorno(g);
      html += '<h3>' + GIORNI_DATE[g] + '</h3>';
      if (luoghiGiorno.length === 0) {
        html += '<p>Nessuna tappa assegnata.</p>';
      } else {
        html += '<ol>';
        luoghiGiorno.forEach(function (l) { html += '<li>' + l.nome + ' (' + l.zona + ')</li>'; });
        html += '</ol>';
      }
    });

    html += '<h2>Farmacie e supermercati vicini</h2><ul>';
    stato.servizi.forEach(function (s) { html += '<li><strong>' + s.nome + '</strong> — ' + s.indirizzo + (s.telefono ? ' · ' + s.telefono : '') + '</li>'; });
    html += '</ul>';

    el.innerHTML = html;
  }

  // ---------- Condivisione ----------
  function inizializzaCondivisione() {
    var btn = document.getElementById("btn-condividi");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var url = window.location.href;
      var testo = "Guida al soggiorno a Fai della Paganella (25-30 agosto 2026), passeggino-friendly";
      if (navigator.share) {
        navigator.share({ title: testo, url: url }).catch(function () {});
      } else {
        window.open("https://wa.me/?text=" + encodeURIComponent(testo + " " + url), "_blank", "noopener");
      }
    });
  }

  function inizializzaStampa() {
    var btn = document.getElementById("btn-stampa");
    if (!btn) return;
    btn.addEventListener("click", function () {
      costruisciFoglioStampa();
      window.print();
    });
  }

  // ---------- Avvio ----------
  function avvia(datiLuoghi, datiServizi, datiLocali, datiEventi) {
    stato.base = datiLuoghi.base;
    stato.luoghi = datiLuoghi.luoghi;
    stato.assegnazioni = caricaAssegnazioni(datiLuoghi.luoghi);
    stato.ordinePerGiorno = caricaJson(STORAGE_ORDINE, {});
    stato.visitati = caricaJson(STORAGE_VISITATI, {});
    stato.prenotazioniFatte = caricaJson(STORAGE_PRENOTAZIONI, {});
    stato.partenzePerGiorno = caricaJson(STORAGE_PARTENZE, {});

    stato.servizi = (datiServizi && datiServizi.servizi) || [];
    stato.numeriUtili = (datiServizi && datiServizi.numeriUtili) || [];
    stato.prenotazioni = (datiServizi && datiServizi.prenotazioni) || [];
    stato.guestCard = (datiServizi && datiServizi.guestCard) || null;
    stato.trasportiPubblici = (datiServizi && datiServizi.trasportiPubblici) || null;
    stato.viaggio = (datiServizi && datiServizi.viaggio) || null;

    stato.locali = (datiLocali && datiLocali.locali) || [];
    stato.eventi = (datiEventi && datiEventi.eventi) || [];
    stato.eventiNota = (datiEventi && datiEventi.nota_generale) || "";

    inizializzaFiltri();
    inizializzaCondivisione();
    inizializzaStampa();
    inizializzaMappaGenerale();

    renderViaggio();
    renderPrenotazioni();
    renderGuestCard();
    renderServizi();
    renderLocali();
    renderTrasporti();
    renderEventi();
    renderNumeriUtili();
    renderChecklist();
    renderLuoghi();
    renderGiorni();
    aggiornaBudget();
    renderOggi();
    caricaMeteo();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  var timerRidimensionamento = null;
  window.addEventListener("resize", function () {
    clearTimeout(timerRidimensionamento);
    timerRidimensionamento = setTimeout(function () {
      if (stato.mappaGenerale) stato.mappaGenerale.invalidateSize();
      Object.keys(stato.mappeGiorno).forEach(function (id) { stato.mappeGiorno[id].invalidateSize(); });
    }, 200);
  });

  function fetchJsonSicuro(url, fallback) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Impossibile caricare " + url);
      return r.json();
    }).catch(function () { return fallback; });
  }

  Promise.all([
    fetch("data/luoghi.json").then(function (r) {
      if (!r.ok) throw new Error("Impossibile caricare i dati dei luoghi");
      return r.json();
    }),
    fetchJsonSicuro("data/servizi.json", { servizi: [], numeriUtili: [] }),
    fetchJsonSicuro("data/locali.json", { locali: [] }),
    fetchJsonSicuro("data/eventi.json", { eventi: [] })
  ])
    .then(function (risultati) {
      avvia(risultati[0], risultati[1], risultati[2], risultati[3]);
    })
    .catch(function (err) {
      var main = document.getElementById("contenuto-principale");
      var p = document.createElement("p");
      p.className = "noscript-avviso";
      p.style.display = "block";
      p.textContent = "Non è stato possibile caricare l'elenco dei luoghi (" + err.message + "). Se hai aperto il file con doppio clic, alcuni browser bloccano il caricamento locale del JSON: prova ad aprirlo con un piccolo server locale oppure visita la versione pubblicata online.";
      main.prepend(p);
    });
})();
