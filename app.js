(function () {
  "use strict";

  document.documentElement.classList.add("js-attivo");

  var STORAGE_GIORNI = "faiPaganella:giorni";
  var GIORNI_DATE = {
    1: "Martedì 25 agosto",
    2: "Mercoledì 26 agosto",
    3: "Giovedì 27 agosto",
    4: "Venerdì 28 agosto",
    5: "Sabato 29 agosto",
    6: "Domenica 30 agosto"
  };
  var GIORNI_ORDINE = [1, 2, 3, 4, 5, 6];

  var CATEGORIE_LABEL = {
    natura: "Natura",
    lago: "Lago",
    impianti: "Impianti",
    paese: "Paese",
    citta: "Città",
    museo: "Museo",
    mangiare: "Mangiare",
    bimbo: "Bimbo"
  };

  var PASSEGGINO_LABEL = { ok: "Passeggino ok", parziale: "Passeggino parziale", no: "Serve il marsupio" };
  var PASSEGGINO_ICONA = { ok: "🟢", parziale: "🟡", no: "🔴" };

  var stato = {
    luoghi: [],
    base: null,
    filtri: { passeggino: false, senzaAuto: false, coperto: false, breve: false, categoria: null },
    assegnazioni: {}, // id luogo -> giorno (numero) o null
    meteoGiornoPioggia: {} // giorno -> bool
  };

  function caricaAssegnazioni(luoghi) {
    var salvate = {};
    try {
      salvate = JSON.parse(localStorage.getItem(STORAGE_GIORNI) || "{}");
    } catch (e) {
      salvate = {};
    }
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

  function salvaAssegnazioni() {
    localStorage.setItem(STORAGE_GIORNI, JSON.stringify(stato.assegnazioni));
  }

  function formatMinuti(min) {
    if (min == null) return "n/d";
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60);
    var m = min % 60;
    return h + "h" + (m ? " " + m + "min" : "");
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

  function creaCard(luogo) {
    var art = document.createElement("article");
    art.className = "card";
    art.dataset.id = luogo.id;

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

    var badge = document.createElement("span");
    badge.className = "badge-passeggino " + luogo.passeggino;
    badge.textContent = PASSEGGINO_ICONA[luogo.passeggino] + " " + PASSEGGINO_LABEL[luogo.passeggino];
    art.appendChild(badge);

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

    if (luogo.coperto && stato._giornoPioggiaAttivo) {
      art.classList.add("card--coperto-suggerito");
    }

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
    return true;
  }

  function renderLuoghi() {
    var griglia = document.getElementById("griglia-luoghi");
    griglia.innerHTML = "";
    var visibili = stato.luoghi.filter(luogoPassaFiltri);

    if (visibili.length === 0) {
      var vuoto = document.createElement("p");
      vuoto.className = "lista-vuota";
      vuoto.textContent = "Nessun luogo corrisponde ai filtri scelti. Prova a toglierne qualcuno.";
      griglia.appendChild(vuoto);
    } else {
      visibili.forEach(function (l) {
        griglia.appendChild(creaCard(l));
      });
    }

    var contatore = document.getElementById("filtri-contatore");
    contatore.textContent = visibili.length + " luoghi su " + stato.luoghi.length;
  }

  function aggiornaChipCategoria(container) {
    var chips = container.querySelectorAll("[data-categoria]");
    chips.forEach(function (chip) {
      var attivo = stato.filtri.categoria === chip.dataset.categoria;
      chip.setAttribute("aria-pressed", attivo ? "true" : "false");
    });
  }

  function inizializzaFiltri() {
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

  function nomeLuogo(id) {
    var l = stato.luoghi.filter(function (x) { return x.id === id; })[0];
    return l ? l.nome : id;
  }

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
      stato.assegnazioni[luogo.id] = select.value ? parseInt(select.value, 10) : null;
      salvaAssegnazioni();
      renderGiorni();
    });

    return select;
  }

  function renderGiorni() {
    var contenitore = document.getElementById("giorni-lista");
    contenitore.innerHTML = "";

    GIORNI_ORDINE.forEach(function (g) {
      var luoghiGiorno = stato.luoghi.filter(function (l) {
        return stato.assegnazioni[l.id] === g;
      });

      var box = document.createElement("div");
      box.className = "giorno";
      if (stato.meteoGiornoPioggia[g]) box.classList.add("giorno--pioggia");

      var intest = document.createElement("div");
      intest.className = "giorno__intestazione";

      var titolo = document.createElement("h3");
      titolo.className = "giorno__titolo";
      titolo.textContent = GIORNI_DATE[g];
      intest.appendChild(titolo);

      var totaleMin = luoghiGiorno.reduce(function (s, l) {
        return s + (l.tempo_viaggio_minuti || 0);
      }, 0);
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

      if (luoghiGiorno.length === 0) {
        var vuoto = document.createElement("p");
        vuoto.className = "giorno--vuoto";
        vuoto.textContent = "Nessun luogo assegnato.";
        box.appendChild(vuoto);
      } else {
        luoghiGiorno.forEach(function (l) {
          var voce = document.createElement("div");
          voce.className = "giorno__voce";

          var info = document.createElement("div");
          var nomeEl = document.createElement("div");
          nomeEl.className = "giorno__voce-nome";
          nomeEl.textContent = l.nome + (l.coperto ? " ☂" : "");
          var metaEl = document.createElement("div");
          metaEl.className = "giorno__voce-meta";
          metaEl.textContent = formatMinuti(l.tempo_viaggio_minuti) + " di viaggio · " + PASSEGGINO_ICONA[l.passeggino];
          info.appendChild(nomeEl);
          info.appendChild(metaEl);
          voce.appendChild(info);

          voce.appendChild(creaSelectGiorno(l));
          box.appendChild(voce);
        });
      }

      contenitore.appendChild(box);
    });
  }

  // ---------- Meteo ----------
  var METEO_LAT = 46.1746;
  var METEO_LNG = 11.0657;
  var DATA_INIZIO = "2026-08-25";
  var DATA_FINE = "2026-08-30";

  var WEATHER_ICONE = {
    0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️",
    45: "🌫", 48: "🌫",
    51: "🌦", 53: "🌦", 55: "🌦",
    61: "🌧", 63: "🌧", 65: "🌧",
    71: "🌨", 73: "🌨", 75: "🌨",
    80: "🌦", 81: "🌧", 82: "⛈",
    95: "⛈", 96: "⛈", 99: "⛈"
  };

  function iconaMeteo(codice) {
    return WEATHER_ICONE[codice] || "🌡";
  }

  function formatDataBreve(iso) {
    var d = new Date(iso + "T00:00:00");
    var giorni = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
    return giorni[d.getDay()] + " " + d.getDate() + "/08";
  }

  function mappaGiornoDaData(iso) {
    var mappaData = {
      "2026-08-25": 1, "2026-08-26": 2, "2026-08-27": 3,
      "2026-08-28": 4, "2026-08-29": 5, "2026-08-30": 6
    };
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
      if (giornoNum && pioggiaProb != null && pioggiaProb >= 50) {
        stato.meteoGiornoPioggia[giornoNum] = true;
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
  }

  function renderMeteoStorico(dati) {
    var container = document.getElementById("meteo-contenuto");
    container.innerHTML = "";

    var etichetta = document.createElement("p");
    etichetta.className = "meteo__etichetta";
    etichetta.textContent = "Media degli ultimi 10 anni, non è una previsione";
    container.appendChild(etichetta);

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
      if (probPioggia != null && probPioggia >= 0.5) {
        stato.meteoGiornoPioggia[giornoNum] = true;
      }

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
    var urlPrevisione = "https://api.open-meteo.com/v1/forecast?latitude=" + METEO_LAT +
      "&longitude=" + METEO_LNG +
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
      .catch(function () {
        caricaMeteoStorico();
      });
  }

  function caricaMeteoStorico() {
    var annoCorrente = new Date().getFullYear();
    var annoInizio = annoCorrente - 10;
    var annoFine = annoCorrente - 1;
    var startArchivio = annoInizio + "-08-25";
    var endArchivio = annoFine + "-08-30";

    var url = "https://archive-api.open-meteo.com/v1/archive?latitude=" + METEO_LAT +
      "&longitude=" + METEO_LNG +
      "&start_date=" + startArchivio + "&end_date=" + endArchivio +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum" +
      "&timezone=Europe%2FRome";

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (dati) {
        if (dati.daily && dati.daily.time) {
          renderMeteoStorico(dati);
        } else {
          renderMeteoErrore("Non è stato possibile caricare i dati meteo storici. Riprova più tardi.");
        }
      })
      .catch(function () {
        renderMeteoErrore("Non è stato possibile contattare il servizio meteo. Controlla la connessione e riprova.");
      });
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
        var waUrl = "https://wa.me/?text=" + encodeURIComponent(testo + " " + url);
        window.open(waUrl, "_blank", "noopener");
      }
    });
  }

  // ---------- Avvio ----------
  function avvia(dati) {
    stato.base = dati.base;
    stato.luoghi = dati.luoghi;
    stato.assegnazioni = caricaAssegnazioni(dati.luoghi);

    inizializzaFiltri();
    inizializzaCondivisione();
    renderLuoghi();
    renderGiorni();
    caricaMeteo();
  }

  fetch("data/luoghi.json")
    .then(function (r) {
      if (!r.ok) throw new Error("Impossibile caricare i dati dei luoghi");
      return r.json();
    })
    .then(avvia)
    .catch(function (err) {
      var main = document.getElementById("contenuto-principale");
      var p = document.createElement("p");
      p.className = "noscript-avviso";
      p.style.display = "block";
      p.textContent = "Non è stato possibile caricare l'elenco dei luoghi (" + err.message + "). Se hai aperto il file con doppio clic, alcuni browser bloccano il caricamento locale del JSON: prova ad aprirlo con un piccolo server locale oppure visita la versione pubblicata online.";
      main.prepend(p);
    });
})();
