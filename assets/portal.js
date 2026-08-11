(function () {
  "use strict";

  var summary = window.GEO_PORTAL_SUMMARY;
  var integerFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
  var decimalFormatter = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function text(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function hasValue(value) {
    return value !== null && value !== undefined && value !== "";
  }

  function formatNumber(value, decimals) {
    if (!hasValue(value)) return "暂无数据";
    if (typeof value !== "number") return String(value);
    return decimals ? decimalFormatter.format(value) : integerFormatter.format(value);
  }

  function metricValue(metric) {
    if (!metric || !hasValue(metric.value)) return "暂无数据";
    var decimals = metric.unit === "%" || metric.unit === "pp";
    return formatNumber(metric.value, decimals) + (metric.unit || "");
  }

  function ratio(metric) {
    if (!hasValue(metric.numerator)) return "口径暂无数据";
    if (!hasValue(metric.denominator)) return "计数 " + formatNumber(metric.numerator, false);
    return formatNumber(metric.numerator, false) + " / " + formatNumber(metric.denominator, false);
  }

  function sourceLink(href) {
    var link = document.createElement("a");
    link.href = href;
    link.textContent = "公开来源";
    return link;
  }

  function renderMetrics() {
    var target = document.getElementById("hero-metrics");
    if (!target) return;
    target.replaceChildren();

    summary.hero_metrics.forEach(function (metric) {
      var item = document.createElement("article");
      item.className = "portal-metric";

      var value = document.createElement("strong");
      value.textContent = metricValue(metric);

      var label = document.createElement("span");
      label.textContent = metric.label;

      var scope = document.createElement("small");
      scope.className = "portal-metric-scope";
      scope.textContent = metric.scope;

      var meta = document.createElement("div");
      meta.className = "portal-metric-meta";
      var fraction = document.createElement("span");
      fraction.textContent = ratio(metric);
      var date = document.createElement("time");
      date.dateTime = metric.as_of || "";
      date.textContent = metric.as_of || "暂无数据";
      meta.append(fraction, date, sourceLink(metric.source_href));

      item.append(value, label, scope, meta);
      target.appendChild(item);
    });
  }

  function renderChanges() {
    var target = document.getElementById("change-list");
    if (!target) return;
    target.replaceChildren();

    summary.changes.forEach(function (change, index) {
      var item = document.createElement("article");
      item.className = "portal-change";

      var marker = document.createElement("span");
      marker.className = "portal-change-index";
      marker.textContent = String(index + 1).padStart(2, "0");

      var copy = document.createElement("div");
      var title = document.createElement("h3");
      title.textContent = change.label;
      var scope = document.createElement("p");
      scope.textContent = change.scope;
      copy.append(title, scope);

      var measure = document.createElement("div");
      measure.className = "portal-change-measure";
      var value = document.createElement("strong");
      var sign = change.value > 0 ? "+" : "";
      value.textContent = sign + metricValue(change);
      var meta = document.createElement("span");
      meta.append(document.createTextNode((change.as_of || "暂无数据") + " · "), sourceLink(change.source_href));
      measure.append(value, meta);

      item.append(marker, copy, measure);
      target.appendChild(item);
    });
  }

  function renderModuleGroups() {
    var target = document.getElementById("module-groups");
    if (!target) return;
    target.replaceChildren();

    summary.module_groups.forEach(function (group) {
      var section = document.createElement("section");
      section.className = "portal-module-group";
      section.setAttribute("aria-labelledby", "module-group-" + group.id);

      var heading = document.createElement("h3");
      heading.id = "module-group-" + group.id;
      heading.textContent = group.label;

      var list = document.createElement("div");
      list.className = "portal-module-list";
      group.items.forEach(function (item) {
        var link = document.createElement("a");
        link.href = item.href;
        var copy = document.createElement("span");
        var label = document.createElement("strong");
        label.textContent = item.label;
        var note = document.createElement("small");
        note.textContent = item.note;
        copy.append(label, note);
        var status = document.createElement("em");
        status.textContent = item.status;
        link.append(copy, status);
        list.appendChild(link);
      });

      section.append(heading, list);
      target.appendChild(section);
    });
  }

  function formatGeneratedAt(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "暂无数据";
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date).replace(/\//g, "-");
  }

  function showUnavailable() {
    document.body.classList.add("portal-data-unavailable");
    ["hero-metrics", "change-list", "module-groups"].forEach(function (id) {
      var target = document.getElementById(id);
      if (!target) return;
      target.replaceChildren();
      var message = document.createElement("p");
      message.className = "portal-empty";
      message.textContent = "摘要数据暂不可用";
      target.appendChild(message);
    });
    text("summary-generated", "暂无数据");
    text("footer-updated", "摘要数据暂不可用");
  }

  if (!summary || summary.schema_version !== 2 || !Array.isArray(summary.hero_metrics) ||
      !Array.isArray(summary.changes) || !Array.isArray(summary.module_groups)) {
    showUnavailable();
    return;
  }

  renderMetrics();
  renderChanges();
  renderModuleGroups();

  var generated = formatGeneratedAt(summary.generated_at);
  text("summary-generated", generated);
  text("footer-updated", "综合摘要生成于 " + generated + " · 最新数据截至 " + summary.latest_data_as_of);

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
    var sections = Array.prototype.slice.call(document.querySelectorAll(".portal-section"));
    sections.forEach(function (section) { section.classList.add("portal-reveal"); });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    sections.forEach(function (section) { observer.observe(section); });
  }
}());
