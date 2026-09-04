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
    var target = new URL(path, rootHref);
    var samePath = window.location.pathname.replace(/\/+$/, "") === target.pathname.replace(/\/+$/, "");
    var active = samePath && (target.hash ? window.location.hash === target.hash : !window.location.hash);
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
      '<a class="geo-shell-brand" href="' + href("./") + '" aria-label="蝉妈妈 GEO 综合分析平台首页">' +
        '<span class="geo-shell-mark" aria-hidden="true"><i></i><i></i></span>' +
        '<span class="geo-shell-brand-text">蝉妈妈 <span>GEO</span></span>' +
      '</a>' +
      '<button class="geo-shell-mobile-toggle" type="button" aria-expanded="false" aria-controls="geo-shell-nav" aria-label="打开导航">☰</button>' +
      '<nav class="geo-shell-nav" id="geo-shell-nav" aria-label="综合平台导航">' +
        '<a href="' + href("./") + '"' + current("overview") + '>工作台</a>' +
        '<details data-active="' + (section === "sampling") + '"><summary>GEO 样本</summary><div class="geo-shell-submenu">' +
          submenuLink("./top01/", "第一轮核心问题", "基线") +
          submenuLink("./top01-round2/", "第二轮复测", "最终 576/576") +
          submenuLink("./top01-two-week-compare/", "两周趋势对比", "趋势") +
          submenuLink("./top2-top3/", "扩展问题", "TOP2+TOP3") +
          submenuLink("./total/", "全部问题总览", "TOP0-TOP3") +
          submenuLink("./chanmama-bi/", "第三轮采样", "FULL 192/192") +
        '</div></details>' +
        '<details data-active="' + (section === "citation") + '"><summary>引用源</summary><div class="geo-shell-submenu">' +
          submenuLink("./douyin-citation-report/", "第一轮引用源", "基线") +
          submenuLink("./douyin-citation-report-round2/", "第二轮引用源", "最终 576/576") +
          submenuLink("./chanquanquan-citation-report/", "蝉圈圈引用源", "最终 730/730") +
          submenuLink("./chanmama-creative-citation-report/", "创意引用源", "270 样本 · 1 待回答恢复") +
          submenuLink("./chanmama-bi-citation/", "第三轮引用源", "191/192 含引用 · 3578 条") +
        '</div></details>' +
        '<details data-active="' + (section === "product") + '"><summary>产品 GEO</summary><div class="geo-shell-submenu">' +
          submenuLink("./chanjing-ai/", "蝉镜 AI", "双端观察") +
          submenuLink("./chanquanquan-geo/", "蝉圈圈 GEO", "最终 730/730") +
        '</div></details>' +
        '<details data-active="' + (section === "operations") + '"><summary>运营工作台</summary><div class="geo-shell-submenu">' +
          submenuLink("./account-matrix/", "账号矩阵日报", "更新至 08-06") +
          submenuLink("./daily-hotspot/", "热点与行业活动", "更新至 08-10") +
        '</div></details>' +
        '<details data-active="' + (section === "more") + '"><summary>更多</summary><div class="geo-shell-submenu">' +
          submenuLink("./chanmama-creative-geo/", "蝉妈妈创意 GEO", "首日 270/270") +
        '</div></details>' +
        '<a href="' + href("./#method") + '">方法与口径</a>' +
      '</nav>' +
    '</div>';

  document.body.classList.add("geo-shell-present");

  if (section !== "overview") {
    var context = document.createElement("div");
    context.className = "geo-shell-context";
    context.innerHTML = '<div class="geo-shell-context-inner"><a href="' + href("./") + '">GEO 工作台</a><span aria-hidden="true">/</span><span>' + label + '</span></div>';
    host.insertAdjacentElement("afterend", context);
  }

  var toggle = host.querySelector(".geo-shell-mobile-toggle");
  var nav = host.querySelector(".geo-shell-nav");
  var menus = Array.from(nav.querySelectorAll("details"));

  function closeMenu() {
    host.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "打开导航");
    toggle.textContent = "☰";
  }

  function closeSubmenus(except) {
    menus.forEach(function (menu) {
      if (menu !== except) menu.removeAttribute("open");
    });
  }

  toggle.addEventListener("click", function () {
    var open = !host.classList.contains("is-open");
    host.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
    toggle.textContent = open ? "×" : "☰";
  });

  menus.forEach(function (menu) {
    menu.addEventListener("toggle", function () {
      if (menu.open) closeSubmenus(menu);
    });
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a") && window.matchMedia("(max-width: 900px)").matches) closeMenu();
  });

  document.addEventListener("click", function (event) {
    if (!host.contains(event.target)) {
      closeSubmenus();
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    closeSubmenus();
    closeMenu();
    toggle.focus();
  });

  window.addEventListener("resize", function () {
    if (!window.matchMedia("(max-width: 900px)").matches) closeMenu();
  });
}());
