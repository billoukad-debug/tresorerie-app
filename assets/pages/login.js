/* Connexion : un code, un bouton. Le code ne circule que dans le corps de la requête. */
(async function () {
  const app = document.getElementById("app");
  if (K.token() && await K.auth.check()) { location.replace("app.html" + (K.store.get("treso_return", "") || "#/jour")); return; }
  const standalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
  app.innerHTML = '<div class="login">' +
    '<div><div class="logo">€</div><h1 class="h1" style="margin-top:14px">Trésorerie</h1><p class="sub">Kameha · Burns 2 · Shop · perso — une seule caisse à la fois.</p></div>' +
    '<form id="f" autocomplete="off">' + K.c.field("Code d'accès", '<input class="input" id="code" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" placeholder="treso-····-····">', { id: "fCode", for: "code" }) +
    '<div id="err"></div>' +
    '<button type="submit" class="btn btn-p btn-block" id="go">Entrer</button>' +
    '<p class="quiet small" style="text-align:center;margin:8px 0 0">5 essais, puis 30 secondes d\'attente.</p></form>' +
    '<div class="hr"></div>' +
    (standalone ? '<p class="quiet small">Installée sur l\'écran d\'accueil ✓</p>' :
      '<details><summary class="muted small" style="cursor:pointer">Ajouter à l\'écran d\'accueil (iPhone)</summary><ol class="muted small" style="padding-left:18px;margin:8px 0 0;line-height:1.7"><li>Ouvre ce lien dans <b>Safari</b>.</li><li>Touche le bouton <b>Partager</b> (le carré avec la flèche, en bas).</li><li>Choisis <b>Sur l\'écran d\'accueil</b>, puis <b>Ajouter</b>.</li></ol></details>') +
    '<p class="quiet small" id="srv" style="margin:0"></p>' +
    '</div>';
  const srv = document.getElementById("srv");
  try { const b = await K.base(); if (!b) srv.textContent = "Adresse du Mac inconnue (link.json absent)."; else { const h = await K.api("/api/health", { noauth: true, timeout: 8000 }); srv.textContent = "Mac joignable · " + K.when(h.time); } } catch (e) { srv.textContent = e.network ? "Le Mac ne répond pas pour l'instant." : ("Serveur : " + e.message); }
  const form = document.getElementById("f");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const code = document.getElementById("code").value.trim(); K.setErr("fCode", ""); document.getElementById("err").innerHTML = "";
    if (!code) { K.setErr("fCode", "Tape ton code."); return; }
    const btn = document.getElementById("go"); K.busy(btn, true, "Vérification…");
    try { await K.auth.login(code); const back = K.store.get("treso_return", ""); K.store.del("treso_return"); location.replace("app.html" + (back || "#/jour")); }
    catch (err) { document.getElementById("err").innerHTML = K.c.error(err.message); K.busy(btn, false); }
  });
  if ("serviceWorker" in navigator) { navigator.serviceWorker.register("sw.js").catch(() => null); }
})();
