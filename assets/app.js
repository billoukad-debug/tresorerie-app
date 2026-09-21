/* App : état partagé (/api/state), routeur par hash, en-tête commun. Les pages s'enregistrent dans App.pages. */
(function (global) {
  "use strict";
  const App = { pages: {}, state: null, loadedAt: 0, current: null, byId: {} };

  App.cacheKey = () => "treso_state_" + K.entity();
  App.load = async function (force) {
    const fresh = App.state && App.state.entity === K.entity() && Date.now() - App.loadedAt < 45000;
    if (fresh && !force) return App.state;
    try {
      const s = await K.api("/api/state?entity=" + K.entity() + "&days=45");
      App.setState(s, true);
      return s;
    } catch (e) {
      if (e.network) { const c = K.store.get(App.cacheKey(), null); if (c) { App.setState(c, false); return c; } }
      throw e;
    }
  };
  App.setState = (s, persist) => {
    App.state = s; App.loadedAt = Date.now(); K.serverToday = s.today || null;
    App.byId = {};
    const put = r => { if (r && r.id != null) App.byId[r.id] = r; if (r && r.members) r.members.forEach(m => { if (m && m.id != null) App.byId[m.id] = m; }); };
    (s.late || []).forEach(put); (s.yesterday || []).forEach(put); (s.days || []).forEach(d => (d.rows || []).forEach(put)); (s.frozen && s.frozen.rows || []).forEach(put);
    if (persist) K.store.set(App.cacheKey(), s);
    document.dispatchEvent(new CustomEvent("treso:state"));
  };
  App.find = id => App.byId[id] || null;
  App.changed = async () => { try { await App.load(true); } catch (e) { /* hors ligne */ } document.dispatchEvent(new CustomEvent("treso:changed")); };

  /* en-tête commun : marque + entité */
  App.top = (title, extra) => '<div class="row"><span class="brand"><b>Trésorerie</b>' + (title ? '<span>· ' + K.esc(title) + '</span>' : "") + '</span><span class="spacer"></span>' + (extra || "") + '<button type="button" class="ent" id="entBtn" aria-label="Changer de caisse"><i></i>' + K.esc(K.ENTITIES[K.entity()].label) + '</button>' + (K.auth.isAdmin() ? '<button type="button" class="add" id="addBtn" aria-label="Nouvelle transaction">' + K.icon("plus") + '</button>' : "") + '</div>';
  App.bindTop = () => { const b = document.getElementById("entBtn"); if (b) b.onclick = App.pickEntity; const a = document.getElementById("addBtn"); if (a) a.onclick = () => Flux.create({ date: K.today() }); };
  App.pickEntity = () => {
    const body = '<div class="list">' + Object.keys(K.ENTITIES).map(k => '<a class="it" href="#" data-ent="' + k + '"><span class="avatar">' + K.esc(K.initials(K.ENTITIES[k].label)) + '</span><div class="t">' + K.esc(K.ENTITIES[k].label) + '<small>' + (k === "aybi" ? "restaurant Kameha Poke, Wavre — EUR" : (k === "burns" ? "Tanger — dirhams" : (k === "shop" ? "sneakers — EUR" : "Bilal — EUR"))) + '</small></div>' + (k === K.entity() ? K.icon("check", "gold") : '<span class="chev">' + K.icon("chev") + '</span>') + '</a>').join("") + '</div>' + K.c.info("Les caisses sont étanches : aucun total ne mélange deux caisses.");
    const p = K.panel({ title: "Quelle caisse ?", body });
    K.on(p.body, "click", "[data-ent]", async (e, t) => { e.preventDefault(); K.setEntity(t.dataset.ent); p.close(); App.state = null; await App.route(); });
  };

  /* routeur */
  App.route = async function () {
    const { path, params } = K.hashParams();
    const name = (path.split("/")[0] || "jour");
    if (name === "flux" && path.split("/")[1]) { if (!location.hash.includes("_from")) { /* lien profond vers une fiche */ } const id = Number(path.split("/")[1]); await App.show("jour", params); Flux.open(id); return; }
    const page = App.pages[name] ? name : "jour";
    await App.show(page, params);
  };
  App.show = async function (name, params) {
    if (App.current && App.current.destroy) { try { App.current.destroy(); } catch (e) { /* ignore */ } }
    App.current = { name };
    const ctl = await App.pages[name](params || {}, App.current);
    if (ctl) Object.assign(App.current, ctl);
    window.scrollTo(0, 0);
  };
  App.start = async function () {
    if (!(await K.require())) return;
    window.addEventListener("hashchange", App.route);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) App.changed(); });
    setInterval(() => { if (!document.hidden) App.changed(); }, 120000);
    if ("serviceWorker" in navigator) { navigator.serviceWorker.register("sw.js").catch(() => null); }
    if (!location.hash) location.replace("#/jour");
    await App.route();
  };

  /* texte « Ce que ça dit » à partir de l'état */
  App.verdict = s => {
    if (!s) return "";
    const low = s.low || {}; const parts = [];
    if (low.amount != null) parts.push("Point bas <b class=\"mono " + (low.amount < 300 ? "bad-t" : "gold") + "\">" + K.esc(K.money(low.amount)) + "</b> le " + K.esc(K.date(low.date)) + (low.label ? " (après " + K.esc(low.label) + ")" : "") + ".");
    const soon = []; (s.days || []).slice(0, 7).forEach(d => (d.rows || []).forEach(r => { if (r.kind === "out" && K.isActive(r) && r.amount >= 1000) soon.push(r); }));
    if (soon.length) { const b = soon.sort((a, b2) => b2.amount - a.amount)[0]; parts.push("La plus grosse sortie des 7 jours : <b>" + K.esc(b.who || b.label) + "</b> " + K.esc(K.money(b.amount)) + " le " + K.esc(K.date(b.date)) + "."); }
    if (s.frozen && s.frozen.total > 0) parts.push("Gelé, toujours dû : <b class=\"mono warn-t\">" + K.esc(K.money(s.frozen.total)) + "</b>" + (s.frozen.end_if_paid != null ? " — si tout est payé avant la fin : <b class=\"mono " + (s.frozen.end_if_paid < 0 ? "bad-t" : "ok-t") + "\">" + K.esc(K.money(s.frozen.end_if_paid)) + "</b>." : "."));
    if (s.late && s.late.length) parts.push("<b class=\"bad-t\">" + s.late.length + " flux en retard</b> à confirmer ou à déplacer.");
    return parts.map(p => "<p>" + p + "</p>").join("");
  };

  global.App = App;
})(window);
