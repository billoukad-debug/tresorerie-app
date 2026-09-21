/* Plus : caisse (entité), comptes, caisses du soir, feuilles Drive, synchronisation Sheets, exports, journal, code, serveur, déconnexion. */
App.pages.plus = async function (params, ctl) {
  const page = K.shell({ active: "plus", top: App.top("Plus") });
  App.bindTop();
  const admin = K.auth.isAdmin();
  const item = (icon, title, sub, attrs) => '<a class="it" href="#" ' + attrs + '><span class="avatar">' + K.icon(icon) + '</span><div class="t">' + K.esc(title) + (sub ? '<small>' + K.esc(sub) + '</small>' : "") + '</div><span class="chev">' + K.icon("chev") + '</span></a>';
  const DRIVE = [["DEPENSES (Ridoine)", "sorties réelles, impayés, salaires, prévisionnel de Bilal", "https://docs.google.com/spreadsheets/d/1cEHwjHWyEZJoUIxFbYwOE78g7c4jApCTFZhNHNq_lZs/edit"], ["TRESO IN (Ridoine)", "recettes réelles par jour, suivi cash", "https://docs.google.com/spreadsheets/d/1tNOORCqyYsjHii-sG24l3dF6WkHUHgGyhMdHuyTNfVY/edit"], ["PREVISIONNEL Claude 21-09", "instantané jour par jour", "https://docs.google.com/spreadsheets/d/1VRA_YCjDPA1_IXxo6pbm51VyYOKrGMah_Y0SpvKa6fM/edit"], ["Retards de paiement — messages prêts", "brouillons WhatsApp / mail", "https://docs.google.com/document/d/1rCznAiE_WwvEgxvWF1flnf0X9WY2C5J6fv_WuEik1Ng/edit"]];
  let sheets = null, health = null;

  function render() {
    page.innerHTML =
      '<div class="sec">Caisse</div><div class="card list">' + item("wallet", K.ENTITIES[K.entity()].label, "toucher pour changer de caisse — étanches entre elles", 'data-go="entity"') + '</div>' +
      '<div class="sec">Argent</div><div class="card list">' + item("coins", "Soldes par compte", "dernier relevé, mettre à jour un solde", 'data-go="soldes"') + item("list", "Caisses du soir", "TPE, Takeaway, Uber, cash, fond de caisse", 'data-go="caisses"') + item("chart", "Prévisionnel", "45 jours, point bas, gelés", 'href="#/previsionnel"') + item("users", "Tiers", "qui est dû combien", 'href="#/tiers"') + '</div>' +
      '<div class="sec">Drive</div><div class="card list">' + DRIVE.map(d => '<a class="it" href="' + K.esc(d[2]) + '" target="_blank" rel="noopener"><span class="avatar">' + K.icon("sheet") + '</span><div class="t">' + K.esc(d[0]) + '<small>' + K.esc(d[1]) + '</small></div><span class="chev">' + K.icon("ext") + '</span></a>').join("") + '</div>' +
      '<div class="sec">Synchronisation</div><div class="card list">' + item("refresh", "Feuille PREVISIONNEL (Apps Script)", sheets ? (sheets.configured ? ("branchée · dernier envoi " + (sheets.last_push ? K.when(sheets.last_push) : "jamais") + (sheets.last_error ? " · erreur : " + sheets.last_error : "")) : "MANQUANT — pas encore branchée (5 minutes de clics)") : "…", 'data-go="sheets"') + item("sheet", "Exporter le prévisionnel (CSV)", "même colonnes que la feuille PREVISIONNEL", 'data-go="csv"') + item("sheet", "Exporter TRESO IN du mois (CSV)", "Date · CASH · TPE · TAKEAWAY · UBER · TOTAL · FDC", 'data-go="csvin"') + '</div>' +
      '<div class="sec">App</div><div class="card list">' + item("list", "Journal des modifications", "tout ce qui a été confirmé, déplacé, créé", 'data-go="audit"') + (admin ? item("key", "Code d'accès", "changer le code de Bilal ou celui de l'équipe", 'data-go="code"') : "") + item("info", "Serveur (le Mac)", health ? ("répond · " + K.when(health.time) + " · v" + health.version) : (K.baseSync() ? K.baseSync().replace(/^https?:\/\//, "") : "adresse inconnue"), 'data-go="server"') + item("logout", "Se déconnecter", (K.auth.role === "admin" ? "connecté comme Bilal" : "connecté comme équipe"), 'data-go="logout"') + '</div>' +
      '<p class="quiet small" style="text-align:center;margin:0">Trésorerie v' + K.esc(K.version) + ' · données sur le Mac, jamais dans le cloud.</p>';
    K.measure();
  }
  const go = {
    entity: () => App.pickEntity(),
    soldes: () => Flux.soldes(),
    caisses: async () => {
      let rows = []; try { rows = await K.api("/api/caisses?entity=" + K.entity() + "&days=30"); } catch (e) { K.toast(e.message, { kind: "err" }); return; }
      const body = (rows.length ? '<table class="tbl"><thead><tr><th>Jour</th><th class="num">TPE</th><th class="num">Tkw</th><th class="num">Uber</th><th class="num">Cash</th><th class="num">Total</th></tr></thead><tbody>' + rows.map(c => '<tr><td>' + K.esc(K.date(c.date)) + '</td><td class="num">' + K.esc(K.money(c.rev || 0, { round: true })) + '</td><td class="num">' + K.esc(K.money(c.tkw || 0, { round: true })) + '</td><td class="num">' + K.esc(K.money(c.uber || 0, { round: true })) + '</td><td class="num">' + K.esc(K.money(c.cash || 0, { round: true })) + '</td><td class="num"><b>' + K.esc(K.money(c.total || 0, { round: true })) + '</b></td></tr>').join("") + '</tbody></table>' : K.c.empty("Aucune caisse saisie", "30 derniers jours.", null, "list"));
      const p = K.panel({ title: "Caisses du soir", sub: rows.length + " jours · " + K.ENTITIES[K.entity()].label, body, footer: K.c.btn("Saisir la caisse du soir", { kind: "p", id: "cNew" }), focus: false });
      p.el.querySelector("#cNew").onclick = () => { p.close(); go.caisse(); };
    },
    caisse: () => {
      const t = K.today(); const mad = K.currency() === "MAD";
      const body = '<div class="row2">' + K.c.field("Jour", K.c.input("cDate", { type: "date", value: t }), { id: "cDateF" }) + K.c.field(mad ? "Carte (CB)" : "TPE Revolut", K.c.money("cRev", null), { id: "cRevF" }) + '</div>' +
        '<div class="row2">' + K.c.field(mad ? "Glovo" : "Takeaway", K.c.money("cTkw", null), { id: "cTkwF" }) + K.c.field(mad ? "Autre livraison" : "Uber Eats", K.c.money("cUber", null), { id: "cUberF" }) + '</div>' +
        '<div class="row2">' + K.c.field("Cash", K.c.money("cCash", null), { id: "cCashF" }) + K.c.field("Fond de caisse", K.c.money("cFdc", null), { id: "cFdcF" }) + '</div>' +
        K.c.field("Note", K.c.input("cNote", { placeholder: "ex. 22h-2h, sortie cash paie Ramon 491" }), { id: "cNoteF" }) +
        '<div class="quick"><button type="button" data-d="' + t + '">Aujourd\'hui</button><button type="button" data-d="' + K.addDays(t, -1) + '">Hier</button></div>';
      const p = K.panel({ title: "Caisse du soir", sub: K.ENTITIES[K.entity()].label, body, footer: K.c.btn("Fermer", { kind: "ghost", id: "cCancel" }) + K.c.btn("Enregistrer la caisse", { kind: "p", id: "cSave" }) });
      K.on(p.el, "click", ".quick button", (e, b) => { p.el.querySelector("#cDate").value = b.dataset.d; });
      p.el.querySelector("#cCancel").onclick = p.close;
      p.el.querySelector("#cSave").onclick = async () => {
        const v = id => K.num(p.el.querySelector("#" + id).value) || 0; const date = p.el.querySelector("#cDate").value;
        if (!date) { K.setErr("cDateF", "Jour requis."); return; }
        const payload = { entity: K.entity(), date, rev: v("cRev"), tkw: v("cTkw"), uber: v("cUber"), cash: v("cCash"), fdc: v("cFdc"), note: p.el.querySelector("#cNote").value.trim() };
        const b = p.el.querySelector("#cSave"); K.busy(b, true);
        try { await K.api("/api/caisses", { json: payload }); K.toast("Caisse du " + K.dm(date) + " enregistrée : " + K.money(payload.rev + payload.tkw + payload.uber + payload.cash), { kind: "ok" }); p.close(); } catch (e) { K.busy(b, false); K.toast(e.message, { kind: "err" }); }
      };
    },
    sheets: () => {
      const steps = '<ol class="muted small" style="padding-left:18px;margin:0;line-height:1.7"><li>Ouvre la feuille <b>DEPENSES</b> (dossier de Ridoine).</li><li>Menu <b>Extensions → Apps Script</b>.</li><li>Efface le contenu de <code>Code.gs</code>, colle le script fourni par Claude (fichier <code>apps-script-previsionnel.gs</code> sur le Mac, dans ~/.billy/config). Ctrl+S.</li><li><b>Déployer → Nouveau déploiement</b> → type <b>Application Web</b> → exécuter en tant que <b>Moi</b> → accès <b>Tout le monde</b> → Déployer → Autoriser.</li><li>Copie l\'URL qui finit par <code>/exec</code>, et dis à Claude sur Telegram : « voici l\'URL de la feuille : … ». Il la range au bon endroit ; l\'app se synchronise ensuite toute seule après chaque modification.</li></ol>';
      const body = (sheets && sheets.configured ? K.c.ok("Feuille branchée. Dernier envoi : " + K.esc(sheets.last_push ? K.when(sheets.last_push) : "jamais") + (sheets.last_error ? "<br>Dernière erreur : " + K.esc(sheets.last_error) : "")) : K.c.warn("<b>MANQUANT</b> — la feuille Google n'est pas encore branchée. En attendant : export CSV ou « Copier pour Sheets » dans le Prévisionnel.")) + '<div class="sec">Brancher en 5 minutes</div>' + steps;
      const p = K.panel({ title: "Synchronisation Sheets", body, footer: (admin && sheets && sheets.configured) ? K.c.btn("Synchroniser maintenant", { kind: "p", id: "shPush" }) : "", focus: false });
      const b = p.el.querySelector("#shPush"); if (b) b.onclick = async () => { K.busy(b, true, "Envoi…"); try { const d = await K.api("/api/sheets/push", { json: {} }); K.toast("Feuille mise à jour (" + (d.pushed || 0) + " lignes)."); p.close(); loadMeta(); } catch (e) { K.busy(b, false); K.toast(e.message, { kind: "err" }); } };
    },
    csv: async () => { try { await App.download("/api/export/previsionnel.csv?entity=" + K.entity() + "&days=60", "previsionnel-" + K.today() + ".csv"); K.toast("CSV téléchargé."); } catch (e) { K.toast(e.message, { kind: "err" }); } },
    csvin: async () => { try { await App.download("/api/export/tresoin.csv?entity=" + K.entity() + "&month=" + K.today().slice(0, 7), "tresoin-" + K.today().slice(0, 7) + ".csv"); K.toast("CSV téléchargé."); } catch (e) { K.toast(e.message, { kind: "err" }); } },
    audit: async () => {
      let rows = []; try { rows = await K.api("/api/audit?limit=80"); } catch (e) { K.toast(e.message, { kind: "err" }); return; }
      K.panel({ title: "Journal des modifications", sub: rows.length + " dernières", body: rows.length ? '<div class="tl">' + rows.map(h => '<div><i class="on"></i><div>' + K.esc(h.note || h.action) + (h.flow_id ? ' <a href="#/flux/' + K.esc(h.flow_id) + '">#' + K.esc(h.flow_id) + '</a>' : "") + '<small>' + K.esc(K.when(h.ts)) + (h.actor ? " · " + K.esc(h.actor) : "") + '</small></div></div>').join("") + '</div>' : K.c.empty("Rien encore", "Les actions faites dans l'app apparaîtront ici.", null, "list"), focus: false });
    },
    code: () => {
      const body = K.c.field("Quel code ?", K.c.select("kRole", [["admin", "Bilal (tout)"], ["staff", "Équipe (caisses et tiers seulement)"]], "admin"), { id: "kRoleF" }) + K.c.field("Ton code actuel", K.c.input("kCur", { type: "password", attrs: ' autocomplete="current-password"' }), { id: "kCurF" }) + K.c.field("Nouveau code", K.c.input("kNew", { type: "password", attrs: ' autocomplete="new-password"' }), { id: "kNewF", hint: "8 caractères minimum. Note-le quelque part de sûr." });
      const p = K.panel({ title: "Code d'accès", body, footer: K.c.btn("Fermer", { kind: "ghost", id: "kCancel" }) + K.c.btn("Changer le code", { kind: "p", id: "kSave" }) });
      p.el.querySelector("#kCancel").onclick = p.close;
      p.el.querySelector("#kSave").onclick = async () => { const cur = p.el.querySelector("#kCur").value, nx = p.el.querySelector("#kNew").value, role = p.el.querySelector("#kRole").value; K.setErr("kNewF", ""); if (nx.length < 8) { K.setErr("kNewF", "8 caractères minimum."); return; } const b = p.el.querySelector("#kSave"); K.busy(b, true); try { await K.api("/api/code", { json: { current: cur, next: nx, role } }); K.toast("Code " + (role === "admin" ? "de Bilal" : "de l'équipe") + " changé."); p.close(); } catch (e) { K.busy(b, false); K.toast(e.message, { kind: "err" }); } };
    },
    server: async () => {
      const base = K.baseSync();
      const p = K.panel({ title: "Le Mac", sub: "où vivent les données", body: '<div class="kv"><div><small>Adresse actuelle</small>' + K.esc(base || "inconnue") + '</div><div><small>Dernière réponse</small>' + K.esc(health ? K.when(health.time) : "—") + '</div><div><small>Version serveur</small>' + K.esc(health ? health.version : "—") + '</div><div><small>Adresse relue le</small>' + K.esc(K.store.get("treso_api_at", null) ? K.when(new Date(K.store.get("treso_api_at")).toISOString()) : "—") + '</div></div>' + K.c.info("Si le Mac redémarre, son adresse change : l'app la relit toute seule. Ce bouton force la relecture."), footer: K.c.btn("Relire l'adresse du Mac", { kind: "o", id: "svRe" }) + K.c.btn("Tester", { kind: "p", id: "svTest" }), focus: false });
      p.el.querySelector("#svRe").onclick = async () => { const b = await K.refreshBase(); K.toast(b ? "Adresse relue : " + b.replace(/^https?:\/\//, "") : "link.json introuvable."); p.close(); loadMeta(); };
      p.el.querySelector("#svTest").onclick = async () => { const b = p.el.querySelector("#svTest"); K.busy(b, true, "Test…"); try { const h = await K.api("/api/health", { noauth: true }); K.toast("Le Mac répond · " + K.when(h.time), { kind: "ok" }); health = h; render(); p.close(); } catch (e) { K.busy(b, false); K.toast(e.message, { kind: "err" }); } };
    },
    logout: async () => { if (!(await K.confirm({ title: "Se déconnecter ?", text: "Il faudra retaper le code.", yes: "Déconnexion" }))) return; await K.auth.logout(); location.replace("index.html"); }
  };
  K.on(page, "click", "[data-go]", (e, a) => { e.preventDefault(); const fn = go[a.dataset.go]; if (fn) fn(); });
  async function loadMeta() { try { sheets = await K.api("/api/sheets"); } catch (e) { sheets = null; } try { health = await K.api("/api/health", { noauth: true }); } catch (e) { health = null; } render(); }
  render(); loadMeta();
  if (params.go && go[params.go]) go[params.go]();
  return { destroy() { /* rien */ } };
};
