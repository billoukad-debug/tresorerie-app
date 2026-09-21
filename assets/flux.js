/* Flux : fiche d'une transaction, actions (payé/reçu, modifier, déplacer, geler, annuler, supprimer, rétablir),
   nouvelle transaction, recettes du jour, soldes. Toute écriture → serveur → rechargement de l'état → toast avec le nouveau point bas. */
(function (global) {
  "use strict";
  const Flux = {};
  const admin = () => K.auth.isAdmin();
  const lowTxt = () => { const s = App.state; return s && s.low && s.low.amount != null ? " · point bas " + K.money(s.low.amount) + " le " + K.dm(s.low.date) : ""; };
  const name = r => (r.who && r.who !== "divers" && r.who !== "caisse" ? r.who : (r.label || "flux #" + r.id));

  /* action générique avec rechargement + toast + annulation */
  Flux.act = async function (action, id, payload, opts) {
    const o = opts || {};
    const d = await K.api("/api/flows/" + id + "/" + action, { json: payload || {} });
    await App.changed();
    if (o.msg !== false) K.toast((o.msg || "Enregistré") + lowTxt(), { kind: "ok", action: o.undo === false ? null : "Annuler", onAction: async () => { try { await K.api("/api/flows/" + id + "/undo", { json: {} }); await App.changed(); K.toast("Rétabli."); } catch (e) { K.toast(e.message, { kind: "err" }); } }, ms: 8000 });
    return d;
  };
  Flux.ok = async (id, payload) => { const r = App.find(id); const isIn = r && r.kind === "in"; return Flux.act("ok", id, payload || {}, { msg: (isIn ? "Reçu — " : "Payé — ") + (r ? name(r) + " " + K.money(payload && payload.amount != null ? payload.amount : r.amount) : "") }); };

  /* fiche */
  Flux.open = async function (id) {
    let r = App.find(id); let hist = [];
    try { const d = await K.api("/api/flows/" + id); r = d.flow || d; hist = d.history || r.history || []; } catch (e) { if (!r) { K.toast(e.message, { kind: "err" }); return; } }
    const isIn = r.kind === "in"; const active = K.isActive(r); const t = K.today();
    const body =
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + K.chip(r) + '<span class="tag">' + K.esc(isIn ? "entrée" : "sortie") + '</span>' + (r.source ? '<span class="tag">source : ' + K.esc(String(r.source).slice(0, 40)) + '</span>' : "") + '</div>' +
      '<div class="row2">' + K.c.field("Montant", K.c.money("fAmt", r.amount, { attrs: ' inputmode="decimal"' + (admin() ? "" : " disabled") }), { id: "fAmtF" }) + K.c.field("Date", K.c.input("fDate", { type: "date", value: r.date, attrs: admin() ? "" : " disabled" }), { id: "fDateF" }) + '</div>' +
      (admin() ? '<div class="quick" id="quick"><button type="button" data-d="' + K.addDays(t, 1) + '">Demain</button><button type="button" data-d="' + K.addDays(t, 7) + '">+7 j</button><button type="button" data-d="' + K.nextWeekday(t, 1) + '">Lundi</button><button type="button" data-d="' + K.nextWeekday(t, 2) + '">Mardi</button><button type="button" data-d="' + K.nextWeekday(t, 5) + '">Vendredi</button></div>' : "") +
      K.c.field("Libellé", K.c.input("fLabel", { value: r.label || "", attrs: admin() ? "" : " disabled" }), { id: "fLabelF" }) +
      K.c.field("Qui", K.c.input("fWho", { value: r.who || "", placeholder: "Ex. Foodex, Gauthier…", attrs: ' list="whoList"' + (admin() ? "" : " disabled") }), { id: "fWhoF" }) +
      K.c.field("Note", '<textarea class="input" id="fNote"' + (admin() ? "" : " disabled") + '>' + K.esc(r.note || "") + '</textarea>', { id: "fNoteF" }) +
      (r.paid_amount != null ? K.c.info("Montant réellement " + (isIn ? "reçu" : "payé") + " : <b class=\"mono\">" + K.esc(K.money(r.paid_amount)) + "</b>") : "") +
      (hist.length ? '<div><div class="sec">Historique</div><div class="tl">' + hist.slice(0, 12).map(h => '<div><i class="on"></i><div>' + K.esc(h.note || h.action || "") + '<small>' + K.esc(K.when(h.ts)) + (h.actor ? " · " + K.esc(h.actor) : "") + '</small></div></div>').join("") + '</div></div>' : "") +
      Flux.datalist();
    let footer = "";
    if (admin()) {
      if (active) footer = K.c.btn("Enregistrer", { kind: "p", id: "bSave" }) + K.c.btn(isIn ? "Reçu ✓" : "Payé ✓", { kind: "ok", id: "bOk" }) + '<div style="flex-basis:100%;display:flex;gap:10px">' + K.c.btn("Geler", { kind: "o", id: "bGel", sm: true }) + K.c.btn("Annuler ce flux", { kind: "danger", id: "bSkip", sm: true }) + (r.source === "app" ? K.c.btn("Supprimer", { kind: "ghost", id: "bDel", sm: true }) : "") + '</div>';
      else if (r.state === "frozen") footer = K.c.btn("Enregistrer", { kind: "p", id: "bSave" }) + K.c.btn("Dégeler", { kind: "ok", id: "bDegel" }) + '<div style="flex-basis:100%;display:flex;gap:10px">' + K.c.btn("Annuler ce flux", { kind: "danger", id: "bSkip", sm: true }) + '</div>';
      else footer = K.c.btn("Rétablir (dernière action)", { kind: "o", id: "bUndo" }) + (r.source === "app" ? K.c.btn("Supprimer", { kind: "ghost", id: "bDel" }) : "");
    }
    const p = K.panel({ title: name(r), sub: K.relDay(r.date) + " · " + (isIn ? "+" : "−") + K.money(r.amount), body, footer, focus: false });
    const val = () => ({ amount: K.num(p.el.querySelector("#fAmt").value), date: p.el.querySelector("#fDate").value, label: p.el.querySelector("#fLabel").value.trim(), who: p.el.querySelector("#fWho").value.trim(), note: p.el.querySelector("#fNote").value.trim() });
    const changed = v => { const out = {}; if (v.amount != null && Math.abs(v.amount - r.amount) > 0.004) out.amount = v.amount; if (v.date && v.date !== r.date) out.date = v.date; if (v.label !== (r.label || "")) out.label = v.label; if (v.who !== (r.who || "")) out.who = v.who; if (v.note !== (r.note || "")) out.note = v.note; return out; };
    K.on(p.el, "click", "#quick button", (e, b) => { p.el.querySelector("#fDate").value = b.dataset.d; });
    const btn = id => p.el.querySelector("#" + id);
    if (btn("bSave")) btn("bSave").onclick = async () => { const v = val(); if (v.amount == null || v.amount < 0) { K.setErr("fAmtF", "Montant invalide."); return; } const ch = changed(v); if (!Object.keys(ch).length) { p.close(); return; } K.busy(btn("bSave"), true); try { await Flux.act("set", r.id, ch, { msg: "Modifié — " + name(r) + (ch.date ? " déplacé au " + K.date(ch.date) : "") }); p.close(); } catch (e) { K.busy(btn("bSave"), false); K.toast(e.message, { kind: "err" }); } };
    if (btn("bOk")) btn("bOk").onclick = async () => { const v = val(); const payload = {}; if (v.amount != null && Math.abs(v.amount - r.amount) > 0.004) payload.amount = v.amount; K.busy(btn("bOk"), true); try { await Flux.ok(r.id, payload); p.close(); } catch (e) { K.busy(btn("bOk"), false); K.toast(e.message, { kind: "err" }); } };
    if (btn("bGel")) btn("bGel").onclick = async () => { if (!(await K.confirm({ title: "Geler ce flux ?", text: "Il sort du calcul du solde mais reste dû. Tu pourras le dégeler à une date.", yes: "Geler" }))) return; try { await Flux.act("gel", r.id, {}, { msg: "Gelé — " + name(r) }); p.close(); } catch (e) { K.toast(e.message, { kind: "err" }); } };
    if (btn("bDegel")) btn("bDegel").onclick = async () => { const v = val(); try { await Flux.act("degel", r.id, { date: v.date || K.today() }, { msg: "Dégelé — " + name(r) + " le " + K.date(v.date || K.today()) }); p.close(); } catch (e) { K.toast(e.message, { kind: "err" }); } };
    if (btn("bSkip")) btn("bSkip").onclick = async () => { if (!(await K.confirm({ title: "Annuler ce flux ?", text: "Il ne comptera plus dans le solde. Tu pourras le rétablir depuis sa fiche.", yes: "Annuler le flux", danger: true }))) return; try { await Flux.act("skip", r.id, {}, { msg: "Annulé — " + name(r) }); p.close(); } catch (e) { K.toast(e.message, { kind: "err" }); } };
    if (btn("bDel")) btn("bDel").onclick = async () => { if (!(await K.confirm({ title: "Supprimer définitivement ?", text: "Seuls les flux créés dans l'app peuvent être supprimés. Pas de retour possible.", yes: "Supprimer", danger: true }))) return; try { await K.api("/api/flows/" + r.id, { method: "DELETE" }); await App.changed(); K.toast("Supprimé."); p.close(); } catch (e) { K.toast(e.message, { kind: "err" }); } };
    if (btn("bUndo")) btn("bUndo").onclick = async () => { try { await K.api("/api/flows/" + r.id + "/undo", { json: {} }); await App.changed(); K.toast("Rétabli — " + name(r)); p.close(); } catch (e) { K.toast(e.message, { kind: "err" }); } };
  };

  /* suggestions de tiers */
  Flux.whoNames = () => { const set = new Set(); Object.values(App.byId || {}).forEach(r => { if (r.who && !/^(divers|caisse|revolut)$/i.test(r.who)) set.add(r.who); }); return Array.from(set).sort(); };
  Flux.datalist = () => '<datalist id="whoList">' + Flux.whoNames().map(w => '<option value="' + K.esc(w) + '">').join("") + '</datalist>';

  /* nouvelle transaction */
  Flux.create = function (defaults) {
    if (!admin()) { K.toast("Réservé à Bilal.", { kind: "err" }); return; }
    const d = defaults || {}; let kind = d.kind || "out"; const t = K.today();
    const body =
      '<div class="opt" id="kind"><button type="button" class="' + (kind === "out" ? "on out" : "") + '" data-k="out">Sortie</button><button type="button" class="' + (kind === "in" ? "on in" : "") + '" data-k="in">Entrée</button></div>' +
      '<div class="row2">' + K.c.field("Montant", K.c.money("nAmt", d.amount, { placeholder: "0,00" }), { id: "nAmtF", req: true }) + K.c.field("Date", K.c.input("nDate", { type: "date", value: d.date || t }), { id: "nDateF", req: true }) + '</div>' +
      '<div class="quick" id="nquick"><button type="button" data-d="' + t + '">Aujourd\'hui</button><button type="button" data-d="' + K.addDays(t, 1) + '">Demain</button><button type="button" data-d="' + K.nextWeekday(t, 1) + '">Lundi</button><button type="button" data-d="' + K.nextWeekday(t, 2) + '">Mardi</button><button type="button" data-d="' + K.addDays(t, 7) + '">+7 j</button></div>' +
      K.c.field("Qui", K.c.input("nWho", { value: d.who || "", placeholder: "Ex. Foodex, Gauthier, loyer…", attrs: ' list="whoList" autocapitalize="words"' }), { id: "nWhoF" }) +
      K.c.field("Libellé", K.c.input("nLabel", { value: d.label || "", placeholder: "Ex. facture 262089 (août)" }), { id: "nLabelF" }) +
      K.c.field("Note", '<textarea class="input" id="nNote" placeholder="Promesse, preuve, INCERTAIN…"></textarea>', { id: "nNoteF" }) +
      Flux.datalist();
    const p = K.panel({ title: "Nouvelle transaction", sub: K.ENTITIES[K.entity()].label, body, footer: K.c.btn("Fermer", { kind: "ghost", id: "nCancel" }) + K.c.btn("Ajouter", { kind: "p", id: "nSave" }) });
    K.on(p.el, "click", "#kind button", (e, b) => { kind = b.dataset.k; p.el.querySelectorAll("#kind button").forEach(x => { x.className = ""; }); b.className = "on " + kind; });
    K.on(p.el, "click", "#nquick button", (e, b) => { p.el.querySelector("#nDate").value = b.dataset.d; });
    p.el.querySelector("#nCancel").onclick = p.close;
    p.el.querySelector("#nSave").onclick = async () => {
      const amount = K.num(p.el.querySelector("#nAmt").value), date = p.el.querySelector("#nDate").value, who = p.el.querySelector("#nWho").value.trim(), label = p.el.querySelector("#nLabel").value.trim(), note = p.el.querySelector("#nNote").value.trim();
      let bad = false; K.setErr("nAmtF", ""); K.setErr("nDateF", ""); K.setErr("nWhoF", "");
      if (amount == null || amount <= 0) { K.setErr("nAmtF", "Montant requis."); bad = true; }
      if (!date) { K.setErr("nDateF", "Date requise."); bad = true; }
      if (!who && !label) { K.setErr("nWhoF", "Qui, ou un libellé."); bad = true; }
      if (bad) return;
      const b = p.el.querySelector("#nSave"); K.busy(b, true, "Ajout…");
      try { await K.api("/api/flows", { json: { entity: K.entity(), kind, date, label: label || who, who, amount, note } }); await App.changed(); K.toast((kind === "in" ? "Entrée ajoutée — " : "Sortie ajoutée — ") + (who || label) + " " + K.money(amount) + " le " + K.date(date) + lowTxt(), { kind: "ok" }); p.close(); }
      catch (e) { K.busy(b, false); K.toast(e.message, { kind: "err" }); }
    };
  };

  /* recettes du jour (groupe TPE + cash + Takeaway + Uber) */
  Flux.recettes = function (date, group) {
    if (!admin()) return;
    const g = group || {}; const est = k => { if (k === "tpe" && g.tpe != null) return g.tpe; if (k === "cash" && g.cash != null) return g.cash; const m = (g.members || []).find(x => new RegExp(k, "i").test(x.label || "")); return m ? m.amount : null; };
    const body = K.c.info("Ce que la caisse a vraiment rapporté le " + K.esc(K.dateL(date)) + ". Les estimations sont préremplies : corrige, puis confirme en une fois.") +
      '<div class="row2">' + K.c.field("TPE Revolut", K.c.money("rTpe", est("tpe")), { id: "rTpeF" }) + K.c.field("Cash", K.c.money("rCash", est("cash")), { id: "rCashF" }) + '</div>' +
      '<div class="row2">' + K.c.field("Takeaway", K.c.money("rTkw", est("takeaway")), { id: "rTkwF", hint: "net reçu, si versé ce jour" }) + K.c.field("Uber Eats", K.c.money("rUber", est("uber")), { id: "rUberF" }) + '</div>' +
      '<div class="row2">' + K.c.field("Fond de caisse", K.c.money("rFdc", null), { id: "rFdcF" }) + K.c.field("Note", K.c.input("rNote", { placeholder: "ex. 2 créneaux, cash à recompter" }), { id: "rNoteF" }) + '</div>';
    const p = K.panel({ title: "Recettes du jour", sub: K.relDay(date) + " · " + K.ENTITIES[K.entity()].label, body, footer: K.c.btn("Fermer", { kind: "ghost", id: "rCancel" }) + K.c.btn("Confirmer les recettes", { kind: "p", id: "rSave" }) });
    p.el.querySelector("#rCancel").onclick = p.close;
    p.el.querySelector("#rSave").onclick = async () => {
      const v = id => K.num(p.el.querySelector("#" + id).value) || 0;
      const payload = { entity: K.entity(), date, tpe: v("rTpe"), cash: v("rCash"), takeaway: v("rTkw"), uber: v("rUber"), fdc: v("rFdc"), note: p.el.querySelector("#rNote").value.trim() };
      const b = p.el.querySelector("#rSave"); K.busy(b, true, "Confirmation…");
      try { await K.api("/api/recettes/confirm", { json: payload }); await App.changed(); K.toast("Recettes du " + K.dm(date) + " confirmées : " + K.money(payload.tpe + payload.cash + payload.takeaway + payload.uber) + lowTxt(), { kind: "ok" }); p.close(); }
      catch (e) { K.busy(b, false); K.toast(e.message, { kind: "err" }); }
    };
  };

  /* soldes par compte + mise à jour */
  Flux.soldes = async function () {
    let d = null; try { d = await K.api("/api/balances?entity=" + K.entity()); } catch (e) { K.toast(e.message, { kind: "err" }); return; }
    const rows = d.accounts || d.rows || (Array.isArray(d) ? d : []);
    const body = '<table class="tbl"><thead><tr><th>Compte</th><th class="num">Solde</th><th>Vu le</th></tr></thead><tbody>' + rows.map(a => '<tr><td>' + K.esc(a.account) + '<br><small class="quiet">' + K.esc(a.source || "") + '</small></td><td class="num">' + K.esc(K.money(a.amount)) + '</td><td class="quiet small">' + K.esc(K.when(a.ts)) + '</td></tr>').join("") + '<tr><td><b>Total</b></td><td class="num"><b class="gold">' + K.esc(K.money(d.total != null ? d.total : rows.reduce((s, a) => s + (a.amount || 0), 0))) + '</b></td><td></td></tr></tbody></table>' +
      (admin() ? '<div class="hr"></div><div class="sec">Mettre à jour un solde</div><div class="row2">' + K.c.field("Compte", K.c.input("bAcc", { placeholder: "Ex. Revolut Main", attrs: ' list="accList"' }), { id: "bAccF" }) + K.c.field("Montant", K.c.money("bAmt", null), { id: "bAmtF" }) + '</div>' + K.c.field("Source", K.c.input("bSrc", { placeholder: "capture 21/09 22h" }), { id: "bSrcF" }) + '<datalist id="accList">' + rows.map(a => '<option value="' + K.esc(a.account) + '">').join("") + '</datalist>' : "");
    const p = K.panel({ title: "Solde connu", sub: "dernier relevé par compte", body, footer: admin() ? K.c.btn("Fermer", { kind: "ghost", id: "sCancel" }) + K.c.btn("Enregistrer le solde", { kind: "p", id: "sSave" }) : "", focus: false });
    if (!admin()) return;
    p.el.querySelector("#sCancel").onclick = p.close;
    p.el.querySelector("#sSave").onclick = async () => {
      const account = p.el.querySelector("#bAcc").value.trim(), amount = K.num(p.el.querySelector("#bAmt").value), source = p.el.querySelector("#bSrc").value.trim() || ("app " + K.dm(K.today()));
      if (!account) { K.setErr("bAccF", "Nom du compte."); return; } if (amount == null) { K.setErr("bAmtF", "Montant."); return; }
      const b = p.el.querySelector("#sSave"); K.busy(b, true);
      try { await K.api("/api/balances", { json: { entity: K.entity(), account, amount, source } }); await App.changed(); K.toast(account + " : " + K.money(amount) + " enregistré" + lowTxt(), { kind: "ok" }); p.close(); } catch (e) { K.busy(b, false); K.toast(e.message, { kind: "err" }); }
    };
  };

  /* clics communs sur les lignes (fiche / ✓ / groupe recettes) */
  Flux.bind = function (root) {
    const groupOf = el => { const l = el.closest(".line"); if (!l || !l.dataset.group) return null; const d = (App.state && App.state.days || []).find(x => x.date === l.dataset.group); return d ? (d.rows || []).find(r => r.group === "recettes") || { date: l.dataset.group } : { date: l.dataset.group }; };
    K.on(root, "click", "[data-act=ok]", async (e, b) => { e.stopPropagation(); const g = groupOf(b); if (g) { Flux.recettes(g.date, g); return; } const id = Number(b.dataset.id); if (!id) return; b.disabled = true; try { await Flux.ok(id); } catch (err) { b.disabled = false; K.toast(err.message, { kind: "err" }); } });
    K.on(root, "click", ".line[data-open],.line[data-group]", (e, l) => { if (e.target.closest("[data-act]")) return; const g = groupOf(l); if (g) { Flux.recettes(g.date, g); return; } const id = Number(l.dataset.open); if (id) Flux.open(id); });
  };

  global.Flux = Flux;
})(window);
