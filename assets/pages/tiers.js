/* Tiers : qui est dû combien (salariés, fournisseurs), en retard, gelé, prochaine échéance. Tap → ses flux. */
App.pages.tiers = async function (params, ctl) {
  const page = K.shell({ active: "tiers", top: App.top("Tiers") });
  App.bindTop();
  let list = [], q = params.q || "";
  page.innerHTML = K.c.skeleton(3);

  function render() {
    const needle = q.trim().toLowerCase();
    const rows = list.filter(t => t.who !== "caisse" && t.who !== "(sans tiers)" && (!needle || String(t.who || "").toLowerCase().includes(needle)));
    const tot = rows.reduce((s, t) => s + (t.due_active || 0), 0), late = rows.reduce((s, t) => s + (t.due_late || 0), 0), fro = rows.reduce((s, t) => s + (t.frozen || 0), 0);
    page.innerHTML =
      '<label class="search">' + K.icon("search") + '<input id="q" placeholder="Chercher un nom…" value="' + K.esc(q) + '" autocomplete="off"></label>' +
      '<div class="kpis three"><div class="kp"><small>Dû (actif)</small><b>' + K.esc(K.money(tot, { round: true })) + '</b><em>' + rows.length + ' tiers</em></div><div class="kp bad"><small>En retard</small><b>' + K.esc(K.money(late, { round: true })) + '</b><em>date passée</em></div><div class="kp warn"><small>Gelé</small><b>' + K.esc(K.money(fro, { round: true })) + '</b><em>hors calcul</em></div></div>' +
      (rows.length ? '<div class="card">' + rows.map(t => '<div class="trow" data-who="' + K.esc(t.who) + '"><div><div class="n">' + K.esc(t.who) + '</div><div class="m">' + (t.due_late ? '<span class="bad-t">en retard ' + K.esc(K.money(t.due_late, { round: true })) + '</span>' : "") + (t.frozen ? '<span class="warn-t">gelé ' + K.esc(K.money(t.frozen, { round: true })) + '</span>' : "") + (t.next_date ? '<span>prochain : ' + K.esc(K.relDay(t.next_date)) + '</span>' : "") + (t.paid_30d ? '<span class="ok-t">' + (t.in_active > 0 && !t.due_active ? "reçu 30 j " : "payé 30 j ") + K.esc(K.money(t.paid_30d, { round: true })) + '</span>' : "") + '</div></div><div class="amt ' + (t.due_active > 0 ? "out" : (t.in_active > 0 ? "in" : "muted")) + '">' + K.esc(t.due_active > 0 ? K.money(-t.due_active) : (t.in_active > 0 ? K.money(t.in_active, { sign: true }) : K.money(0))) + '</div></div>').join("") + '</div>'
        : K.c.empty("Personne", needle ? "Aucun tiers ne correspond." : "Aucun flux pour cette caisse.", null, "users"));
    const inp = page.querySelector("#q"); if (needle) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    K.measure();
  }
  async function openWho(who) {
    let rows = [];
    try { rows = await K.api("/api/flows?entity=" + K.entity() + "&status=all&who=" + encodeURIComponent(who)); } catch (e) { K.toast(e.message, { kind: "err" }); return; }
    rows.forEach(r => { App.byId[r.id] = r; });
    const act = rows.filter(K.isActive), fro = rows.filter(r => r.state === "frozen"), done = rows.filter(r => !K.isActive(r) && r.state !== "frozen");
    const grp = (title, rs, cls) => rs.length ? '<div class="grp ' + (cls || "") + '"><div class="grp-h"><span class="d">' + K.esc(title) + '</span><small>' + rs.length + '</small><span class="net">' + K.esc(K.money(rs.reduce((s, r) => s + (r.kind === "in" ? r.amount : -r.amount), 0), { sign: true })) + '</span></div>' + rs.map(r => K.c.line(r, { date: true })).join("") + '</div>' : "";
    const p = K.panel({ title: who, sub: rows.length + " flux · " + K.ENTITIES[K.entity()].label, body: grp("À venir", act.sort((a, b) => a.date.localeCompare(b.date)), "today") + grp("Gelé", fro, "confirm") + grp("Terminé", done.sort((a, b) => b.date.localeCompare(a.date))) + (rows.length ? "" : K.c.empty("Rien", "Aucun flux.")), footer: K.auth.isAdmin() ? K.c.btn("Nouvelle transaction pour " + who, { kind: "p", id: "tNew" }) : "", focus: false });
    Flux.bind(p.body);
    const b = p.el.querySelector("#tNew"); if (b) b.onclick = () => { p.close(); Flux.create({ who, date: K.today() }); };
    const refresh = async () => { p.close(); }; document.addEventListener("treso:changed", refresh, { once: true });
  }
  K.on(page, "input", "#q", (e, i) => { q = i.value; render(); });
  K.on(page, "click", "[data-who]", (e, t) => openWho(t.dataset.who));
  K.on(page, "click", "[data-retry]", async e => { e.preventDefault(); await load(); });
  async function load() { try { list = await K.api("/api/tiers?entity=" + K.entity()); render(); if (params.who) openWho(params.who); } catch (e) { page.innerHTML = K.c.error(e.message, true); } }
  const onChange = () => load();
  document.addEventListener("treso:changed", onChange);
  await load();
  return { destroy() { document.removeEventListener("treso:changed", onChange); } };
};
