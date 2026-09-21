/* Prévisionnel : courbe 45 j, filtres, semaine par semaine avec solde après, gelés, « Ce que ça dit ». */
App.pages.previsionnel = async function (params, ctl) {
  const page = K.shell({ active: "previsionnel", top: App.top("Prévisionnel"), wide: true });
  App.bindTop();
  page.innerHTML = K.c.skeleton(3);
  const FILTERS = [["tout", "Tout"], ["entree", "Entrées"], ["salaire", "Salaires"], ["fournisseur", "Fournisseurs"], ["auto", "Auto"], ["geles", "Gelés"]];
  let filter = params.f || K.store.get("treso_filter", "tout"); if (!FILTERS.some(f => f[0] === filter)) filter = "tout";
  let week = params.semaine || null;

  function chart(s) {
    const W = 560, H = 160, padL = 8, padR = 8, padT = 14, padB = 22;
    const pts = [{ d: s.today, v: s.start }].concat((s.days || []).map(d => ({ d: d.date, v: d.end })));
    if (pts.length < 2) return "";
    const vals = pts.map(p => p.v); const lowV = s.low && s.low.amount != null ? s.low.amount : Math.min.apply(null, vals);
    const ymin = Math.min(0, lowV, Math.min.apply(null, vals)), ymax = Math.max.apply(null, vals.concat([1]));
    const span = (ymax - ymin) || 1; const x = i => padL + i * (W - padL - padR) / (pts.length - 1); const y = v => padT + (ymax - v) * (H - padT - padB) / span;
    const path = pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join(" ");
    const area = path + " L" + x(pts.length - 1).toFixed(1) + " " + y(Math.max(ymin, 0)).toFixed(1) + " L" + x(0).toFixed(1) + " " + y(Math.max(ymin, 0)).toFixed(1) + " Z";
    const li = s.low && s.low.date ? pts.findIndex(p => p.d === s.low.date) : -1;
    const lowMark = li >= 0 ? '<circle class="pt" cx="' + x(li).toFixed(1) + '" cy="' + y(lowV).toFixed(1) + '" r="4"/><text class="low" x="' + Math.min(W - 90, Math.max(4, x(li) - 30)).toFixed(1) + '" y="' + (y(lowV) + 14 > H - padB ? y(lowV) - 8 : y(lowV) + 14).toFixed(1) + '">' + K.esc(K.money(lowV, { round: true })) + ' · ' + K.esc(K.dm(s.low.date)) + '</text>' : "";
    const zero = ymin < 0 ? '<line class="zero" x1="0" x2="' + W + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>' : "";
    const labels = [0, Math.floor(pts.length / 3), Math.floor(2 * pts.length / 3), pts.length - 1].map(i => '<text x="' + Math.min(W - 36, x(i)).toFixed(1) + '" y="' + (H - 6) + '">' + K.esc(K.dm(pts[i].d)) + '</text>').join("");
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Solde projeté sur 45 jours"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6ab4e"/><stop offset="1" stop-color="#d6ab4e" stop-opacity="0"/></linearGradient></defs>' +
      '<line class="grid" x1="0" x2="' + W + '" y1="' + y(ymax).toFixed(1) + '" y2="' + y(ymax).toFixed(1) + '"/>' + zero + '<path class="area" d="' + area + '"/><path class="l" d="' + path + '"/>' + lowMark +
      '<text x="4" y="' + (padT - 4) + '">' + K.esc(K.money(ymax, { round: true })) + '</text>' + labels + '</svg>';
  }
  const keep = r => { if (r.state === "cancelled") return false; if (filter === "tout") return true; if (filter === "geles") return r.state === "frozen"; return K.cat(r) === filter; };

  function render() {
    const s = App.state; if (!s) return;
    const days = s.days || []; const t = s.today;
    const weeks = []; days.forEach(d => { const ws = K.weekStart(d.date); let w = weeks.find(x => x.start === ws); if (!w) { w = { start: ws, end: K.addDays(ws, 6), days: [] }; weeks.push(w); } w.days.push(d); });
    if (!week || !weeks.some(w => w.start === week)) week = weeks.length ? weeks[0].start : K.weekStart(t);
    const wi = weeks.findIndex(w => w.start === week); const w = weeks[wi] || { days: [] };
    let body = "";
    if (filter === "geles") {
      const fr = (s.frozen && s.frozen.rows) || [];
      body = '<div class="grp"><div class="grp-h"><span class="d">Gelé — dû mais hors calcul</span><span class="net warn-t">' + K.esc(K.money(s.frozen ? s.frozen.total : 0)) + '</span></div>' + (fr.length ? fr.map(r => K.c.line(r, { date: true })).join("") : '<div class="empty"><span>Rien de gelé.</span></div>') + '</div>' +
        (s.frozen && s.frozen.end_if_paid != null ? K.c.warn("Si tout est payé avant la fin des 45 jours : <b class=\"mono\">" + K.esc(K.money(s.frozen.end_if_paid)) + "</b>.") : "");
    } else {
      body = '<div class="weeknav"><button type="button" class="ibtn" data-w="' + (wi > 0 ? weeks[wi - 1].start : "") + '" aria-label="Semaine précédente"' + (wi <= 0 ? " disabled" : "") + '>' + K.icon("back") + '</button><span class="t">Semaine ' + K.esc(K.dm(w.start)) + ' → ' + K.esc(K.dm(w.end)) + '</span><button type="button" class="ibtn" data-w="' + (wi < weeks.length - 1 ? weeks[wi + 1].start : "") + '" aria-label="Semaine suivante"' + (wi >= weeks.length - 1 ? " disabled" : "") + '>' + K.icon("chev") + '</button></div>';
      let any = false;
      w.days.forEach(d => {
        const rows = (d.rows || []).filter(keep); if (!rows.length) return; any = true;
        const n = rows.reduce((a, r) => a + (K.isActive(r) ? (r.kind === "in" ? r.amount : -r.amount) : 0), 0);
        body += '<div class="grp' + (d.date === t ? " today" : "") + '"><div class="grp-h"><span class="d">' + K.esc(d.date === t ? "Aujourd'hui" : K.dateL(d.date)) + '</span><small>fin ' + K.esc(K.money(d.end, { round: true })) + '</small><span class="net ' + (n >= 0 ? "ok-t" : "bad-t") + '">' + K.esc(K.money(n, { sign: true })) + '</span></div>' + rows.map(r => K.c.line(r, { after: r.solde != null && r.solde !== "" ? r.solde : null })).join("") + '</div>';
      });
      if (!any) body += '<div class="empty"><span>Rien cette semaine' + (filter !== "tout" ? " pour ce filtre" : "") + '.</span></div>';
    }
    page.innerHTML =
      '<div class="card"><div class="card-b" style="padding-bottom:6px">' + chart(s) + '</div><div class="kpis three" style="padding:0 14px 14px"><div class="kp ' + (s.low && s.low.amount < 500 ? "bad" : "gold") + '"><small>Point bas</small><b>' + K.esc(K.money(s.low ? s.low.amount : 0, { round: true })) + '</b><em>' + K.esc(s.low ? K.date(s.low.date) : "") + '</em></div><div class="kp"><small>Fin 45 j</small><b>' + K.esc(K.money(s.end, { round: true })) + '</b><em>' + K.esc(days.length ? K.date(days[days.length - 1].date) : "") + '</em></div><div class="kp warn"><small>Gelé</small><b>' + K.esc(K.money(s.frozen ? s.frozen.total : 0, { round: true })) + '</b><em>' + (((s.frozen || {}).rows || []).length) + ' flux</em></div></div></div>' +
      '<div class="cats">' + FILTERS.map(f => '<button type="button" class="' + (filter === f[0] ? "on" : "") + '" data-f="' + f[0] + '">' + K.esc(f[1]) + '</button>').join("") + '</div>' +
      body +
      '<div class="gold-box"><div class="t">Ce que ça dit.</div>' + App.verdict(s) + '</div>' +
      '<div class="btnrow">' + K.c.btn("Exporter CSV", { kind: "o", sm: true, id: "bCsv", icon: "sheet" }) + K.c.btn("Copier pour Sheets", { kind: "o", sm: true, id: "bCopy" }) + '</div>' +
      '<p class="quiet small" style="margin:0">Feuilles Drive : <a href="https://docs.google.com/spreadsheets/d/1cEHwjHWyEZJoUIxFbYwOE78g7c4jApCTFZhNHNq_lZs/edit" target="_blank" rel="noopener">DEPENSES</a> · <a href="https://docs.google.com/spreadsheets/d/1VRA_YCjDPA1_IXxo6pbm51VyYOKrGMah_Y0SpvKa6fM/edit" target="_blank" rel="noopener">PREVISIONNEL 21-09</a> · <a href="https://docs.google.com/spreadsheets/d/1tNOORCqyYsjHii-sG24l3dF6WkHUHgGyhMdHuyTNfVY/edit" target="_blank" rel="noopener">TRESO IN</a></p>';
    K.measure();
  }
  Flux.bind(page);
  K.on(page, "click", "[data-f]", (e, b) => { filter = b.dataset.f; K.store.set("treso_filter", filter); render(); });
  K.on(page, "click", "[data-w]", (e, b) => { if (b.dataset.w) { week = b.dataset.w; render(); } });
  K.on(page, "click", "#bCsv", async () => { try { await App.download("/api/export/previsionnel.csv?entity=" + K.entity() + "&days=60", "previsionnel-" + K.today() + ".csv"); K.toast("CSV prêt — même format que la feuille PREVISIONNEL."); } catch (e) { K.toast(e.message, { kind: "err" }); } });
  K.on(page, "click", "#bCopy", async () => { try { const txt = await App.fetchText("/api/export/previsionnel.csv?entity=" + K.entity() + "&days=60"); await K.copy(txt.replace(/;/g, "\t")); K.toast("Copié : colle dans un onglet Sheets (Ctrl/Cmd+V)."); } catch (e) { K.toast(e.message, { kind: "err" }); } });
  K.on(page, "click", "[data-retry]", async e => { e.preventDefault(); await load(); });
  async function load() { page.innerHTML = K.c.skeleton(3); try { await App.load(true); render(); } catch (e) { page.innerHTML = K.c.error(e.message, true); } }
  const onChange = () => render();
  document.addEventListener("treso:changed", onChange);
  try { await App.load(); render(); } catch (e) { page.innerHTML = K.c.error(e.message, true); }
  return { destroy() { document.removeEventListener("treso:changed", onChange); document.body.classList.remove("wide"); } };
};

/* téléchargements authentifiés (les liens ne peuvent pas porter le jeton) */
App.fetchText = async function (path) {
  const base = await K.base(); const r = await fetch(base + path, { headers: { Authorization: "Bearer " + K.token() } });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Export impossible (" + r.status + ")"); }
  return await r.text();
};
App.download = async function (path, filename) {
  const txt = await App.fetchText(path);
  const blob = new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
};
