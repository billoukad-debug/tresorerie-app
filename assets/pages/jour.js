/* Aujourd'hui : solde connu, point bas, puis En retard · Hier à confirmer · Aujourd'hui · Demain. Une action par ligne (✓). */
App.pages.jour = async function (params, ctl) {
  const page = K.shell({ active: "jour", top: App.top("", "") });
  App.bindTop();
  page.innerHTML = K.c.skeleton(3);

  const net = rows => rows.reduce((s, r) => s + (K.isActive(r) ? (r.kind === "in" ? r.amount : -r.amount) : 0), 0);
  const section = (cls, title, sub, rows, emptyHtml) => {
    if (!rows.length && !emptyHtml) return "";
    const n = net(rows);
    return '<div class="grp ' + cls + '"><div class="grp-h"><span class="d">' + K.esc(title) + '</span>' + (sub ? '<small>' + K.esc(sub) + '</small>' : "") + (rows.length ? '<span class="net ' + (n >= 0 ? "ok-t" : "bad-t") + '">' + K.esc(K.money(n, { sign: true })) + '</span>' : "") + '</div>' +
      (rows.length ? rows.map(r => K.c.line(r)).join("") : emptyHtml) + '</div>';
  };

  function render() {
    const s = App.state; if (!s) return;
    const t = s.today; const day = iso => (s.days || []).find(d => d.date === iso) || { rows: [] };
    const vis = rows => (rows || []).filter(r => r.state !== "cancelled");
    const today = vis(day(t).rows), tomorrow = vis(day(K.addDays(t, 1)).rows);
    const late = vis(s.late), yest = vis(s.yesterday);
    const seen = s.start_detail && s.start_detail.length ? s.start_detail.reduce((m, a) => a.ts > m ? a.ts : m, "") : "";
    const lowBad = s.low && s.low.amount != null && s.low.amount < 500;
    const since = s.since && s.since.n > 0;
    page.innerHTML =
      '<div class="card card-b" style="padding-top:12px"><div class="hero"><div><div class="lbl">' + (since ? "Solde maintenant" : "Solde connu") + '</div><div class="val" id="solde" role="button" tabindex="0" title="Détail par compte">' + K.esc(K.money(s.start)) + '</div><div class="when">' + (since ? K.esc(K.money(s.start_known)) + " vu le " + K.esc(K.when(seen)) + (s.since.out ? " − " + K.esc(K.money(s.since.out)) + " payé" : "") + (s.since["in"] ? " + " + K.esc(K.money(s.since["in"])) + " reçu" : "") + " depuis" : ((s.start_detail || []).length + ' comptes' + (seen ? " · vu le " + K.esc(K.when(seen)) : ""))) + ' · détail ›</div></div><div style="text-align:right"><div class="lbl">Fin 45 j</div><div class="mono" style="font-size:17px;font-weight:600;color:' + (s.end < 0 ? "var(--bad)" : "var(--text)") + '">' + K.esc(K.money(s.end)) + '</div></div></div>' +
      '<div class="kpis" style="margin-top:10px"><div class="kp ' + (lowBad ? "bad" : "gold") + '"><small>Point bas</small><b>' + K.esc(s.low && s.low.amount != null ? K.money(s.low.amount) : "—") + '</b><em>' + K.esc(s.low && s.low.date ? K.date(s.low.date) : "") + '</em></div><div class="kp warn"><small>Gelé, toujours dû</small><b>' + K.esc(K.money(s.frozen ? s.frozen.total : 0)) + '</b><em><a href="#/previsionnel?f=geles">' + ((s.frozen && s.frozen.rows) || []).length + ' flux</a></em></div></div></div>' +
      section("late", "En retard", late.length + " à confirmer ou déplacer", late) +
      section("confirm", "Hier — à confirmer", K.date(K.addDays(t, -1)), yest) +
      section("today", "Aujourd'hui", K.dateL(t), today, '<div class="empty"><span>Rien de prévu aujourd\'hui.</span>' + (K.auth.isAdmin() ? K.c.btn("Ajouter une transaction", { kind: "o", sm: true, attrs: ' data-new="1"' }) : "") + '</div>') +
      section("", "Demain", K.dateL(K.addDays(t, 1)), tomorrow, '<div class="empty"><span>Rien de prévu demain.</span></div>') +
      '<a class="btn btn-o" href="#/previsionnel">Voir les 45 prochains jours ' + K.icon("chev") + '</a>' +
      '<div class="gold-box"><div class="t">Ce que ça dit.</div>' + App.verdict(s) + '</div>';
    K.measure();
  }
  Flux.bind(page);
  K.on(page, "click", "#solde", () => Flux.soldes());
  K.on(page, "click", "[data-new]", () => Flux.create({ date: K.today() }));
  K.on(page, "click", "[data-retry]", async e => { e.preventDefault(); await load(); });
  async function load() { page.innerHTML = K.c.skeleton(3); try { await App.load(true); render(); } catch (e) { page.innerHTML = K.c.error(e.message, true); } }
  const onChange = () => render();
  document.addEventListener("treso:changed", onChange);
  try { await App.load(); render(); } catch (e) { page.innerHTML = K.c.error(e.message, true); }
  return { destroy() { document.removeEventListener("treso:changed", onChange); } };
};
