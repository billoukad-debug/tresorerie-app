/* Trésorerie — couche partagée : API (avec découverte du Mac via link.json), session, helpers, composants, navigation.
   Un seul module global K. Toute valeur interpolée dans du HTML passe par K.esc. */
(function (global) {
  "use strict";
  const K = { version: "1.0.0" };

  /* ---------- base ---------- */
  K.esc = v => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const NBSP = " "; // espace fine insécable pour les milliers
  K.fmt = (v, opts) => {
    const o = opts || {}; let n = Number(v); if (!Number.isFinite(n)) n = 0;
    const neg = n < 0; n = Math.abs(n);
    const dec = o.round ? 0 : 2;
    let s = n.toFixed(dec);
    let [int, fr] = s.split(".");
    int = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    s = int + (fr ? "," + fr : "");
    const cur = o.currency === "MAD" ? "dh" : "€";
    return (neg ? "−" : (o.sign ? "+" : "")) + s + NBSP + cur;
  };
  K.num = v => { const s = String(v == null ? "" : v).replace(/[€\s  ]/g, "").replace(",", "."); if (s === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  K.round2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"], DAYS_L = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  K.parseDate = v => { if (!v) return null; const d = new Date(String(v).includes("T") ? v : String(v).slice(0, 10) + "T12:00:00"); return Number.isNaN(d.getTime()) ? null : d; };
  K.isoDay = d => { const x = d instanceof Date ? d : K.parseDate(d); if (!x) return ""; return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  K.serverToday = null;
  K.today = () => K.serverToday || K.isoDay(new Date());
  K.addDays = (iso, n) => { const d = K.parseDate(iso) || new Date(); d.setDate(d.getDate() + n); return K.isoDay(d); };
  K.nextWeekday = (iso, wd) => { let d = K.addDays(iso, 1); for (let i = 0; i < 7; i++) { if ((K.parseDate(d).getDay()) === wd) return d; d = K.addDays(d, 1); } return d; };
  K.dm = v => { const d = K.parseDate(v); return d ? d.getDate() + "/" + String(d.getMonth() + 1).padStart(2, "0") : "—"; };
  K.date = v => { const d = K.parseDate(v); return d ? DAYS[d.getDay()] + " " + K.dm(v) : "—"; };
  K.dateL = v => { const d = K.parseDate(v); return d ? DAYS_L[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] : "—"; };
  K.dateLong = v => { const d = K.parseDate(v); return d ? DAYS_L[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() : "—"; };
  K.relDay = iso => { if (!iso) return "—"; const t = K.today(); if (iso === t) return "Aujourd'hui"; if (iso === K.addDays(t, 1)) return "Demain"; if (iso === K.addDays(t, -1)) return "Hier"; return K.date(iso); };
  K.when = ts => { if (!ts) return ""; const d = K.parseDate(String(ts).replace(" ", "T")); if (!d) return String(ts); return K.dm(d) + " " + String(d.getHours()).padStart(2, "0") + "h" + String(d.getMinutes()).padStart(2, "0"); };
  K.weekStart = iso => { const d = K.parseDate(iso); const wd = (d.getDay() + 6) % 7; return K.addDays(iso, -wd); };
  K.uid = () => Math.random().toString(36).slice(2, 9);
  K.initials = name => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";

  /* ---------- stockage ---------- */
  K.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* navigation privée */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  K.ENTITIES = { aybi: { label: "Kameha · AYBI", currency: "EUR" }, burns: { label: "Burns 2", currency: "MAD" }, shop: { label: "Shop Ta Paire", currency: "EUR" }, perso: { label: "Perso", currency: "EUR" } };
  K.entity = () => { const e = K.store.get("treso_entity", "aybi"); return K.ENTITIES[e] ? e : "aybi"; };
  K.setEntity = e => { if (K.ENTITIES[e]) K.store.set("treso_entity", e); };
  K.currency = () => K.ENTITIES[K.entity()].currency;
  K.money = (v, opts) => K.fmt(v, Object.assign({ currency: K.currency() }, opts || {}));

  /* ---------- où est le Mac ? (link.json publié par le tunnel) ---------- */
  let BASE = null;
  const qs = new URLSearchParams(global.location ? global.location.search : "");
  if (qs.get("api")) { K.store.set("treso_api", qs.get("api").replace(/\/$/, "")); }
  K.refreshBase = async function () {
    try {
      const r = await fetch("link.json?t=" + Date.now(), { cache: "no-store" });
      const d = await r.json();
      if (d && d.url) { BASE = d.url.replace(/\/$/, ""); K.store.set("treso_api", BASE); K.store.set("treso_api_at", Date.now()); return BASE; }
    } catch (e) { /* pas de link.json (dev local) */ }
    return BASE;
  };
  K.base = async function () {
    if (BASE) return BASE;
    const cached = K.store.get("treso_api", null);
    if (cached) { BASE = cached; return BASE; }
    return (await K.refreshBase()) || "";
  };
  K.baseSync = () => BASE || K.store.get("treso_api", "");

  /* ---------- API ---------- */
  K.token = () => K.store.get("treso_token", null);
  K.api = async function (path, opts) {
    const o = Object.assign({}, opts || {});
    o.headers = Object.assign({}, o.headers || {});
    if (o.json !== undefined) { o.method = o.method || "POST"; o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(o.json); delete o.json; }
    const tok = K.token(); if (tok && !o.noauth) o.headers.Authorization = "Bearer " + tok;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), o.timeout || 15000); o.signal = ctrl.signal;
    let base = await K.base(), r;
    const go = async b => fetch(b + path, o);
    try { r = await go(base); }
    catch (e) {
      // le tunnel a peut-être changé d'adresse : on relit link.json une fois
      const nb = await K.refreshBase();
      if (nb && nb !== base) { try { r = await go(nb); } catch (e2) { r = null; } }
      if (!r) { clearTimeout(timer); const err = new Error("Le Mac ne répond pas. Vérifie qu'il est allumé et connecté, puis réessaie."); err.network = true; document.dispatchEvent(new CustomEvent("treso:offline")); throw err; }
    }
    clearTimeout(timer);
    document.dispatchEvent(new CustomEvent("treso:online"));
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== "/api/login") document.dispatchEvent(new CustomEvent("treso:session-expired"));
    if (!r.ok) { const err = new Error(d.error || "La demande a échoué (" + r.status + ")"); err.status = r.status; err.payload = d; throw err; }
    return d;
  };
  K.auth = {
    role: null,
    async login(code) { const d = await K.api("/api/login", { json: { code: String(code || "") }, noauth: true }); K.store.set("treso_token", d.token); K.store.set("treso_role", d.role); K.auth.role = d.role; return d; },
    async check() { if (!K.token()) return false; try { const d = await K.api("/api/me"); K.auth.role = d.role; K.store.set("treso_role", d.role); return true; } catch (e) { if (e.network) { K.auth.role = K.store.get("treso_role", null); return true; } K.auth.role = null; return false; } },
    async logout() { try { await K.api("/api/session", { method: "DELETE" }); } catch (e) { /* ignore */ } K.store.del("treso_token"); K.store.del("treso_role"); K.auth.role = null; },
    isAdmin() { return (K.auth.role || K.store.get("treso_role", null)) === "admin"; }
  };
  K.require = async function () {
    const ok = await K.auth.check();
    if (!ok) { K.store.set("treso_return", location.hash || "#/jour"); location.replace("index.html"); return false; }
    document.addEventListener("treso:session-expired", () => { K.store.set("treso_return", location.hash || "#/jour"); K.store.del("treso_token"); K.toast("Session expirée. Reconnecte-toi.", { kind: "err" }); setTimeout(() => location.replace("index.html"), 1200); }, { once: true });
    return true;
  };

  /* ---------- statuts et catégories ---------- */
  K.STATE_LABEL = { planned: "à payer", estimated: "estimé", auto: "auto", paid: "payé", received: "reçu", frozen: "gelé", cancelled: "annulé", late: "en retard" };
  K.stateKey = row => { if (!row) return "planned"; if (row.late && row.state !== "frozen") return "late"; return row.state || "planned"; };
  K.stLabel = row => { const s = K.stateKey(row); if (s === "planned" && row.kind === "in") return "à recevoir"; if ((s === "paid" || s === "received") && row.status) { const m = String(row.status).match(/(\d{4}-\d{2}-\d{2})/); if (m) return K.STATE_LABEL[s] + " " + K.dm(m[1]); } return K.STATE_LABEL[s] || s; };
  K.chip = (row, extra) => '<span class="chip st-' + K.stateKey(row) + '">' + K.esc(extra || K.stLabel(row)) + '</span>';
  K.isActive = row => ["planned", "estimated", "auto"].includes(row.state);
  const SUPPLIERS = /foodex|ifood|dirk|clavie|creembal|oscar|ozfood|colruyt|courses|loyer|bubble|fleetcor|electrabel|proximus|totalenergies|orange|yuzzu|anthropic|revolut|ucm|bt accounting|maca|club sa|google|troy|renewi|bruco|mehdi|casawe|hostinger|accountable|jims|rest ordering|kaptain|takeaway|uber|onss|tva|spf|énergie|energie|telecom|télécom|divers/i;
  K.cat = row => { if (row.category) return row.category; if (row.kind === "in") return "entree"; if (row.state === "auto") return "auto"; if (SUPPLIERS.test((row.who || "") + " " + (row.label || ""))) return "fournisseur"; return "salaire"; };
  K.CATS = { entree: "Entrées", salaire: "Salaires", fournisseur: "Fournisseurs", auto: "Auto" };

  /* ---------- icônes (SVG inline, 24×24) ---------- */
  const I = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    chart: '<path d="M3 20h18M5 16l4-5 4 3 6-8"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 010 7M21.5 20c0-3-1.8-5.2-4.5-5.8"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    refresh: '<path d="M20 11a8 8 0 00-14.5-4.5L3 9M4 13a8 8 0 0014.5 4.5L21 15"/><path d="M3 4v5h5M21 20v-5h-5"/>',
    warn: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h.01"/>',
    edit: '<path d="M4 20h4l10.5-10.5a2 2 0 000-3L17 5a2 2 0 00-3 0L4 15.5V20z"/>',
    snow: '<path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    logout: '<path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5M15 8l4 4-4 4M19 12H9"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>',
    coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 9v12"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3M14 8l2 2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2zM10 20a2 2 0 004 0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    move: '<path d="M4 12h16M14 6l6 6-6 6"/>'
  };
  K.icon = (name, cls) => '<svg class="ico' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (I[name] || I.info) + '</svg>';

  /* ---------- composants ---------- */
  const c = {};
  c.btn = (label, opts) => { const o = opts || {}; return '<button type="button" class="btn ' + (o.kind ? "btn-" + o.kind : "") + (o.sm ? " btn-sm" : "") + (o.block ? " btn-block" : "") + (o.cls ? " " + o.cls : "") + '"' + (o.id ? ' id="' + o.id + '"' : "") + (o.attrs || "") + (o.disabled ? " disabled" : "") + '>' + (o.icon ? K.icon(o.icon) : "") + K.esc(label) + '</button>'; };
  c.field = (label, inputHtml, opts) => { const o = opts || {}; return '<div class="field"' + (o.id ? ' id="' + o.id + '"' : "") + '><label' + (o.for ? ' for="' + o.for + '"' : "") + '>' + K.esc(label) + (o.req ? ' <span class="bad-t">*</span>' : "") + '</label>' + inputHtml + (o.hint ? '<span class="quiet small">' + K.esc(o.hint) + '</span>' : "") + '<span class="err" data-err></span></div>'; };
  c.input = (id, opts) => { const o = opts || {}; return '<input class="input' + (o.cls ? " " + o.cls : "") + '" id="' + id + '" type="' + (o.type || "text") + '"' + (o.value != null ? ' value="' + K.esc(o.value) + '"' : "") + (o.placeholder ? ' placeholder="' + K.esc(o.placeholder) + '"' : "") + (o.attrs || "") + '>'; };
  c.money = (id, value, opts) => c.input(id, Object.assign({ type: "text", cls: "mono", value: value == null ? "" : String(K.round2(value)).replace(".", ","), attrs: ' inputmode="decimal" autocomplete="off"' }, opts || {}));
  c.select = (id, options, value, attrs) => '<select class="input" id="' + id + '"' + (attrs || "") + '>' + options.map(([v, l]) => '<option value="' + K.esc(v) + '"' + (v === value ? " selected" : "") + '>' + K.esc(l) + '</option>').join("") + '</select>';
  c.empty = (title, text, action, icon) => '<div class="state"><div class="ic">' + K.icon(icon || "cal") + '</div><b>' + K.esc(title) + '</b>' + (text ? '<p class="sub" style="max-width:320px">' + K.esc(text) + '</p>' : "") + (action || "") + '</div>';
  c.error = (text, retry) => '<div class="notice err" role="alert"><i>!</i><div><b>Un problème.</b> ' + K.esc(text) + (retry ? ' <a href="#" data-retry>Réessayer</a>' : "") + '</div></div>';
  c.warn = html => '<div class="notice warn"><i>!</i><div>' + html + '</div></div>';
  c.ok = html => '<div class="notice ok"><i>✓</i><div>' + html + '</div></div>';
  c.info = html => '<div class="notice"><i>i</i><div>' + html + '</div></div>';
  c.skeleton = n => { let h = ""; for (let i = 0; i < (n || 3); i++) h += '<div class="card card-b" style="display:flex;flex-direction:column;gap:10px"><div class="sk" style="width:40%"></div><div class="sk" style="width:70%"></div><div class="sk" style="width:55%"></div></div>'; return h; };
  c.amount = (row, opts) => {
    const o = opts || {}; const isIn = row.kind === "in";
    const v = (row.paid_amount != null && (row.state === "paid" || row.state === "received")) ? row.paid_amount : row.amount;
    const est = row.state === "estimated";
    return '<span class="amt ' + (isIn ? "in" : "out") + (est ? " est" : "") + '">' + (est ? "≈ " : "") + K.esc(K.money(isIn ? v : -v, { sign: isIn })) + '</span>' + (o.after != null ? '<span class="after' + (o.after < 0 ? " neg" : "") + '">' + K.esc(K.money(o.after)) + '</span>' : "");
  };
  // ligne de flux : point · qui/libellé · montant · action ✓ (optionnelle)
  c.line = (row, opts) => {
    const o = opts || {}; const isIn = row.kind === "in"; const s = K.stateKey(row);
    const dot = row.state === "frozen" ? "frozen" : (row.state === "estimated" ? "est" : (isIn ? "in" : "out"));
    const who = row.who && row.who !== "divers" && row.who !== "caisse" && !/^revolut$/i.test(row.who) ? row.who : "";
    const title = row.group === "recettes" ? "Recettes du jour" : (who ? '<b>' + K.esc(who) + '</b>' + (row.label && row.label.toLowerCase() !== who.toLowerCase() ? ' <span class="muted">·</span> ' + K.esc(K.shortLabel(row.label, who)) : "") : K.esc(row.label || "—"));
    const sub = [];
    if (o.date) sub.push('<span>' + K.esc(K.relDay(row.date)) + '</span>');
    sub.push(K.chip(row));
    if (row.note && !o.noNote) sub.push('<span class="quiet" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">' + K.esc(String(row.note).slice(0, 80)) + '</span>');
    const canAct = o.act !== false && (K.isActive(row) || row.group === "recettes") && (K.auth.isAdmin());
    return '<div class="line' + (isIn ? " in" : "") + (canAct ? " has-act" : "") + (["paid", "received", "cancelled"].includes(s) ? " done" : "") + '"' + (row.id != null ? ' data-open="' + K.esc(row.id) + '"' : "") + (row.group ? ' data-group="' + K.esc(row.date) + '"' : "") + '>' +
      '<span class="dot ' + dot + '"></span><div class="mid"><div class="lbl">' + title + '</div><div class="subl">' + sub.join("") + '</div></div>' +
      '<div style="text-align:right">' + c.amount(row, { after: o.after }) + '</div>' +
      (canAct ? '<button type="button" class="act ok" data-act="ok" data-id="' + K.esc(row.id) + '" aria-label="' + (isIn ? "Reçu" : "Payé") + '">' + K.icon("check") + '</button>' : "") + '</div>';
  };
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9àâäéèêëîïôöùûüç]/g, "");
  K.shortLabel = (label, who) => {
    let l = String(label || ""); if (!who) return l;
    const w = norm(who); if (!w) return l;
    // 1) le libellé commence par « qui » → on l'enlève, avec le séparateur
    if (norm(l).startsWith(w)) { let i = 0, n = 0; while (i < l.length && n < w.length) { if (norm(l[i])) n++; i++; } l = l.slice(i).replace(/^[\s—–\-:·,()]+/, ""); return l || String(label); }
    // 2) la tête du libellé (avant « — », « · », « - ») désigne le même tiers → on garde la suite
    const m = l.match(/^(.{2,40}?)\s+[—–\-·]\s+(.+)$/);
    if (m) { const h = norm(m[1]); if (h && (w.includes(h) || h.includes(w) || h.slice(0, 5) === w.slice(0, 5))) return m[2]; }
    return l;
  };
  K.c = c;

  /* ---------- toasts, dialogues, panneau ---------- */
  const toasts = () => { let t = document.querySelector(".toasts"); if (!t) { t = document.createElement("div"); t.className = "toasts"; t.setAttribute("aria-live", "polite"); document.body.appendChild(t); } return t; };
  K.toast = (msg, opts) => { const o = opts || {}; const el = document.createElement("div"); el.className = "toast" + (o.kind ? " " + o.kind : ""); el.innerHTML = '<span>' + K.esc(msg) + '</span>' + (o.action ? '<button type="button">' + K.esc(o.action) + '</button>' : ""); if (o.action && o.onAction) el.querySelector("button").onclick = () => { o.onAction(); el.remove(); }; toasts().appendChild(el); setTimeout(() => el.remove(), o.ms || 4500); return el; };
  K.confirm = opts => new Promise(resolve => {
    const o = typeof opts === "string" ? { text: opts } : (opts || {});
    const d = document.createElement("div"); d.className = "dialog"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.innerHTML = '<div class="box"><b style="font-size:15px">' + K.esc(o.title || "Confirmer") + '</b><span class="muted">' + K.esc(o.text || "") + '</span><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px"><button type="button" class="btn btn-o btn-sm" data-no>' + K.esc(o.no || "Non") + '</button><button type="button" class="btn btn-sm ' + (o.danger ? "btn-danger" : "btn-p") + '" data-yes>' + K.esc(o.yes || "Oui") + '</button></div></div>';
    const done = v => { d.remove(); document.removeEventListener("keydown", esc); resolve(v); };
    const esc = e => { if (e.key === "Escape") done(false); };
    d.querySelector("[data-yes]").onclick = () => done(true); d.querySelector("[data-no]").onclick = () => done(false);
    d.addEventListener("click", e => { if (e.target === d) done(false); });
    document.addEventListener("keydown", esc); document.body.appendChild(d); d.querySelector("[data-yes]").focus();
  });
  K.panel = opts => {
    const o = opts || {}; const s = document.createElement("div"); s.className = "scrim";
    s.innerHTML = '<div class="panel" role="dialog" aria-modal="true"><div class="panel-h"><div style="min-width:0"><h2 class="h2">' + K.esc(o.title || "") + '</h2>' + (o.sub ? '<p class="sub">' + K.esc(o.sub) + '</p>' : "") + '</div><button type="button" class="ibtn" data-close aria-label="Fermer">' + K.icon("x") + '</button></div><div class="panel-b">' + (o.body || "") + '</div>' + (o.footer ? '<div class="panel-f">' + o.footer + '</div>' : "") + '</div>';
    const close = () => { s.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", esc); if (o.onClose) o.onClose(); };
    const esc = e => { if (e.key === "Escape") close(); };
    s.querySelector("[data-close]").onclick = close; s.addEventListener("click", e => { if (e.target === s) close(); });
    document.addEventListener("keydown", esc); document.body.style.overflow = "hidden"; document.body.appendChild(s);
    const f = s.querySelector("input,select,textarea,button.btn-p"); if (f && o.focus !== false) setTimeout(() => f.focus(), 60);
    return { el: s, close, body: s.querySelector(".panel-b"), footer: s.querySelector(".panel-f") };
  };
  K.on = (root, ev, sel, fn) => { const key = "__k_" + ev + "_" + sel; if (root[key]) root.removeEventListener(ev, root[key]); const h = e => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); }; root[key] = h; root.addEventListener(ev, h); };
  K.busy = (btn, on, label) => { if (!btn) return; if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.textContent = label || "Un instant…"; } else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; } };
  K.setErr = (id, msg) => { const f = document.getElementById(id); if (!f) return; const e = f.querySelector("[data-err]"); if (e) e.textContent = msg || ""; const i = f.querySelector(".input"); if (i) { if (msg) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid"); } };
  K.hashParams = () => { const h = location.hash.replace(/^#\/?/, ""); const [path, q] = h.split("?"); const p = {}; new URLSearchParams(q || "").forEach((v, k) => { p[k] = v; }); return { path: path || "", params: p }; };
  K.go = h => { location.hash = h; };
  K.copy = async text => { try { await navigator.clipboard.writeText(text); return true; } catch (e) { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e2) { /* ignore */ } ta.remove(); return true; } };

  /* ---------- navigation (barre du bas) ---------- */
  const TABS = [["jour", "Aujourd'hui", "cal"], ["previsionnel", "Prévisionnel", "chart"], ["tiers", "Tiers", "users"], ["plus", "Plus", "more"]];
  K.tabs = active => '<nav class="mtabs">' + TABS.map(([k, l, i]) => '<a class="mtab' + (active === k ? " on" : "") + '" href="#/' + k + '"' + (active === k ? ' aria-current="page"' : "") + '>' + K.icon(i) + l + '</a>').join("") + '</nav>';
  K.shell = opts => {
    const o = opts || {}; const app = document.getElementById("app");
    app.innerHTML = '<div class="kwrap"><div class="mtop" id="mtop">' + (o.top || "") + '</div><div id="offline" class="offline hide">' + K.icon("warn") + '<span>Le Mac ne répond pas — données de la dernière fois.</span></div><div class="mlist" id="page"></div></div>' + K.tabs(o.active) + (o.fab ? '<button type="button" class="fab" id="fab" aria-label="Nouvelle transaction">' + K.icon("plus") + '</button>' : "");
    document.body.classList.toggle("wide", !!o.wide);
    K.measure();
    return document.getElementById("page");
  };
  K.measure = () => { const m = document.getElementById("mtop"); if (m) document.documentElement.style.setProperty("--mtop-h", m.offsetHeight + "px"); };
  if (global.addEventListener) { global.addEventListener("resize", K.measure); document.addEventListener("treso:offline", () => { const o = document.getElementById("offline"); if (o) o.classList.remove("hide"); }); document.addEventListener("treso:online", () => { const o = document.getElementById("offline"); if (o) o.classList.add("hide"); }); }

  global.K = K;
})(typeof window !== "undefined" ? window : globalThis);
