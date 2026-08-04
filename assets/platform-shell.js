(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var rootHref = new URL(script.dataset.root || "./", document.baseURI).href;
  var section = script.dataset.section || "overview";
  var label = script.dataset.label || "当前页面";

  function href(path) {
    return new URL(path, rootHref).href;
  }

  function current(name) {
    return section === name ? ' aria-current="page"' : "";
  }

  function submenuLink(path, text, note) {
    var active = window.location.pathname.replace(/\/+$/, "") === new URL(path, rootHref).pathname.replace(/\/+$/, "");
    return '<a href="' + href(path) + '"' + (active ? ' aria-current="page"' : "") + '><span>' + text + '</span><small>' + note + '</small></a>';
  }

  var host = document.getElementById("geo-shell-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "geo-shell-root";
    document.body.insertBefore(host, document.body.firstChild);
  }
  host.className = "geo-shell-root";
  host.innerHTML =
    '<div class="geo-shell-inner">' +
      '<a class="geo-shell-brand" href="' + href("./") + '">蝉妈妈 <span>GEO</span></a>' +
      '<button class="geo-shell-mobile-toggle" type="button" aria-expanded="false" aria-controls="geo-shell-nav" aria-label="打开导航">☰</button>' +
      '<nav class="geo-shell-nav" id="geo-shell-nav" aria-label="综合平台导航">' +
        '<a href="' + href("./") + '"' + current("overview") + '>总览</a>' +
        '<details data-active="' + (section === "sampling") + '"><summary>GEO 样本</summary><div class="geo-shell-submenu">' +
          submenuLink("./top01/", "第一轮核心问题", "基线") +
          submenuLink("./top01-round2/", "第二轮复测", "采样中") +
          submenuLink("./top01-two-week-compare/", "两周趋势对比", "趋势") +
          submenuLink("./top2-top3/", "扩展问题", "TOP2+TOP3") +
          submenuLink("./total/", "全部问题总览", "TOP0-TOP3") +
        '</div></details>' +
        '<details data-active="' + (section === "citation") + '"><summary>引用源</summary><div class="geo-shell-submenu">' +
          submenuLink("./douyin-citation-report/", "第一轮引用源", "基线") +
          submenuLink("./douyin-citation-report-round2/", "第二轮引用源", "阶段性 300/576") +
        '</div></details>' +
        '<a href="' + href("./#roadmap") + '">研究路线</a>' +
        '<a href="' + href("./#method") + '">方法与口径</a>' +
        '<details data-active="' + (section === "more") + '"><summary>更多</summary><div class="geo-shell-submenu">' +
          submenuLink("./chanjing-ai/", "蝉镜 AI", "双端观察") +
        '</div></details>' +
      '</nav>' +
    '</div>';

  document.body.classList.add("geo-shell-present");

  if (section !== "overview") {
    var context = document.createElement("div");
    context.className = "geo-shell-context";
    context.innerHTML = '<div class="geo-shell-context-inner"><a href="' + href("./") + '">综合总览</a><span aria-hidden="true">/</span><span>' + label + '</span></div>';
    host.insertAdjacentElement("afterend", context);
  }

  var toggle = host.querySelector(".geo-shell-mobile-toggle");
  var nav = host.querySelector(".geo-shell-nav");

  function closeMenu() {
    host.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "打开导航");
    toggle.textContent = "☰";
  }

  toggle.addEventListener("click", function () {
    var open = !host.classList.contains("is-open");
    host.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
    toggle.textContent = open ? "×" : "☰";
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a") && window.matchMedia("(max-width: 900px)").matches) closeMenu();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });
}());
