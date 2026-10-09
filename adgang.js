/*
 * Adgangskode til statiske sider (kun JavaScript).
 *
 * Brug: sæt denne linje som den første i <head> på hver side, der skal låses:
 *   <script src="adgang.js"></script>
 * (er siden i en undermappe, så ret stien, f.eks. ../adgang.js)
 *
 * OBS: Det er en forhindring, ikke rigtig sikkerhed. Indholdet ligger stadig
 * på serveren, og alle kan læse denne fil og sidernes kildekode.
 */
(function () {
  'use strict';

  // ---- Indstillinger -------------------------------------------------------
  var NAVN = 'Oddy-opslag';

  // Lav koden med lav-adgangskode.html og indsæt den mellem citationstegnene.
  // Er den tom, kan ingen logge ind.
  var HASH = '';

  // Hvor mange dage "Husk mig på denne enhed" gælder.
  var HUSK_DAGE = 30;
  // --------------------------------------------------------------------------

  var NOEGLE = 'adgang-ok';
  var FINGERAFTRYK = HASH.slice(-16); // ny adgangskode = alle logges ud
  var root = document.documentElement;

  function laes(lager) {
    try { return lager.getItem(NOEGLE); } catch (e) { return null; }
  }
  function skriv(lager, v) {
    try { lager.setItem(NOEGLE, v); } catch (e) { /* privat tilstand */ }
  }
  function slet() {
    try { sessionStorage.removeItem(NOEGLE); } catch (e) {}
    try { localStorage.removeItem(NOEGLE); } catch (e) {}
  }

  function erLoggetInd() {
    if (!FINGERAFTRYK) return false;
    if (laes(sessionStorage) === FINGERAFTRYK) return true;
    try {
      var d = JSON.parse(laes(localStorage) || 'null');
      return !!d && d.f === FINGERAFTRYK && d.til > Date.now();
    } catch (e) { return false; }
  }

  window.adgangLogud = function () {
    slet();
    location.reload();
  };

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-adgang-logud]') : null;
    if (a) { e.preventDefault(); window.adgangLogud(); }
  });

  if (erLoggetInd()) return;

  // Skjul siden med det samme, så den ikke blinker frem.
  var stil = document.createElement('style');
  stil.textContent =
    'html.adgang-laast{background:#154482}' +
    'html.adgang-laast>body{display:none!important}';
  root.appendChild(stil);
  root.classList.add('adgang-laast');

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  // Format fra lav-adgangskode.html: pbkdf2$sha256$<iterationer>$<salt>$<hex>
  function tjekKode(kode) {
    var p = HASH.split('$');
    if (p.length !== 5 || p[0] !== 'pbkdf2' || !window.crypto || !crypto.subtle) {
      return Promise.resolve(false);
    }
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(kode), 'PBKDF2', false, ['deriveBits'])
      .then(function (n) {
        return crypto.subtle.deriveBits(
          { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(p[3]), iterations: parseInt(p[2], 10) },
          n, 256);
      })
      .then(function (bits) { return hex(bits) === p[4]; });
  }

  var CSS =
    '.adgang{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:16px;background:#154482;color:#1b2433;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.adgang *{box-sizing:border-box}' +
    '.adgang-kort{width:100%;max-width:400px;background:#fff;border-radius:12px;padding:36px 32px 32px;box-shadow:0 12px 40px rgba(0,0,0,.25)}' +
    '.adgang-laas{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:#154482;display:grid;place-items:center}' +
    '.adgang-laas svg{width:28px;height:28px}' +
    '.adgang h1{margin:0 0 4px;text-align:center;font-size:1.5rem;color:#154482}' +
    '.adgang-under{margin:0 0 24px;text-align:center;color:#5b6678;font-size:.95rem}' +
    '.adgang label{display:block;margin-bottom:6px;font-weight:600;font-size:.95rem}' +
    '.adgang-felt{position:relative}' +
    '.adgang input[type=password],.adgang input[type=text]{width:100%;padding:12px 84px 12px 14px;font:inherit;color:#1b2433;background:#fff;border:2px solid #c9d2e0;border-radius:8px}' +
    '.adgang input:focus{outline:none;border-color:#154482;box-shadow:0 0 0 3px rgba(21,68,130,.25)}' +
    '.adgang-vis{position:absolute;right:6px;top:50%;transform:translateY(-50%);padding:6px 10px;font:inherit;font-size:.85rem;color:#154482;background:none;border:0;border-radius:6px;cursor:pointer}' +
    '.adgang-vis:hover{background:#e8eef7}' +
    '.adgang-vis:focus-visible{outline:2px solid #154482}' +
    '.adgang-husk{display:flex;gap:8px;align-items:center;margin-top:14px;font-size:.9rem;color:#5b6678}' +
    '.adgang-husk input{width:18px;height:18px;accent-color:#154482}' +
    '.adgang-husk label{margin:0;font-weight:400}' +
    '.adgang-log{width:100%;margin-top:20px;padding:12px;font:inherit;font-weight:600;color:#fff;background:#154482;border:0;border-radius:8px;cursor:pointer}' +
    '.adgang-log:hover{background:#0e3260}' +
    '.adgang-log:focus-visible{outline:3px solid #154482;outline-offset:2px}' +
    '.adgang-log[disabled]{opacity:.7;cursor:wait}' +
    '.adgang-besked{margin:0 0 16px;padding:10px 12px;border-radius:8px;font-size:.95rem;color:#a4262c;background:#fdecec;border:1px solid #f0b8bb}' +
    '.adgang-besked:empty{display:none}';

  var HTML =
    '<div class="adgang-kort" role="dialog" aria-modal="true" aria-labelledby="adgang-titel">' +
      '<div class="adgang-laas" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>' +
      '<h1 id="adgang-titel"></h1>' +
      '<p class="adgang-under">Indtast adgangskoden for at fortsætte</p>' +
      '<p class="adgang-besked" role="alert"></p>' +
      '<form>' +
        '<label for="adgang-kode">Adgangskode</label>' +
        '<div class="adgang-felt">' +
          '<input id="adgang-kode" type="password" autocomplete="current-password" required>' +
          '<button type="button" class="adgang-vis" aria-controls="adgang-kode" aria-pressed="false">Vis</button>' +
        '</div>' +
        '<div class="adgang-husk"><input type="checkbox" id="adgang-husk"><label for="adgang-husk">Husk mig på denne enhed</label></div>' +
        '<button type="submit" class="adgang-log">Log ind</button>' +
      '</form>' +
    '</div>';

  function byg() {
    var s = document.createElement('style');
    s.textContent = CSS;
    root.appendChild(s);

    var d = document.createElement('div');
    d.className = 'adgang';
    d.innerHTML = HTML;
    d.querySelector('h1').textContent = NAVN;
    root.appendChild(d);

    var form = d.querySelector('form');
    var felt = d.querySelector('#adgang-kode');
    var vis = d.querySelector('.adgang-vis');
    var besked = d.querySelector('.adgang-besked');
    var knap = d.querySelector('.adgang-log');
    var husk = d.querySelector('#adgang-husk');
    var fejl = 0;

    if (!HASH) {
      besked.textContent = 'Adgangskoden er ikke sat op endnu. Åbn lav-adgangskode.html og følg vejledningen.';
    } else if (!window.crypto || !crypto.subtle) {
      besked.textContent = 'Siden skal åbnes via https for at kunne låses op.';
    }

    vis.addEventListener('click', function () {
      var skjult = felt.type === 'password';
      felt.type = skjult ? 'text' : 'password';
      vis.textContent = skjult ? 'Skjul' : 'Vis';
      vis.setAttribute('aria-pressed', String(skjult));
      felt.focus();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      knap.disabled = true;
      besked.textContent = '';
      tjekKode(felt.value).then(function (ok) {
        if (ok) {
          if (husk.checked) {
            skriv(localStorage, JSON.stringify({ f: FINGERAFTRYK, til: Date.now() + HUSK_DAGE * 864e5 }));
          } else {
            skriv(sessionStorage, FINGERAFTRYK);
          }
          root.classList.remove('adgang-laast');
          d.remove();
          return;
        }
        fejl++;
        // Lidt ventetid efter hvert forkert forsøg (maks. 8 sek.).
        var vent = Math.min(8000, 500 * Math.pow(2, fejl - 1));
        besked.textContent = HASH ? 'Forkert adgangskode.' : besked.textContent;
        felt.select();
        setTimeout(function () { knap.disabled = false; felt.focus(); }, vent);
      });
    });

    felt.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', byg);
  } else {
    byg();
  }
})();
