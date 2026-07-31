(function () {
  "use strict";

  var summary = window.GEO_PORTAL_SUMMARY;
  var numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

  function text(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function value(metric) {
    if (!metric || metric.value === null || metric.value === undefined || metric.value === "") return "暂无数据";
    var output = typeof metric.value === "number" ? numberFormatter.format(metric.value) : String(metric.value);
    return output + (metric.unit || "");
  }

  function moduleById(id) {
    return summary.modules.find(function (module) { return module.id === id; });
  }

  function renderMetrics(targetId, metrics) {
    var target = document.getElementById(targetId);
    if (!target) return;
    target.replaceChildren();

    (metrics || []).forEach(function (metric) {
      var item = document.createElement("div");
      item.className = "portal-metric";

      var metricValue = document.createElement("strong");
      metricValue.textContent = value(metric);

      var label = document.createElement("span");
      label.textContent = metric.label;

      item.append(metricValue, label);
      if (metric.context) {
        var context = document.createElement("small");
        context.textContent = metric.context;
        item.appendChild(context);
      }
      target.appendChild(item);
    });
  }

  function renderInsights() {
    var target = document.getElementById("insight-list");
    if (!target) return;
    target.replaceChildren();

    var insights = summary.modules.reduce(function (items, module) {
      return items.concat((module.insights || []).map(function (insight) {
        return { module: module.label, insight: insight };
      }));
    }, []).slice(0, 3);

    if (!insights.length) {
      var empty = document.createElement("p");
      empty.className = "portal-empty";
      empty.textContent = "摘要数据暂不可用，请进入各仪表盘查看。";
      target.appendChild(empty);
      return;
    }

    insights.forEach(function (item) {
      var row = document.createElement("article");
      row.className = "portal-insight";

      var meta = document.createElement("div");
      meta.className = "portal-insight-meta";
      meta.textContent = item.module + " / " + (item.insight.as_of || "日期待确认");

      var body = document.createElement("p");
      body.textContent = item.insight.text;

      var link = document.createElement("a");
      link.href = item.insight.source_href;
      link.textContent = "查看依据";

      row.append(meta, body, link);
      target.appendChild(row);
    });
  }

  function renderViews(module) {
    var target = document.getElementById("sampling-views");
    if (!target) return;
    target.replaceChildren();

    (module.views || []).forEach(function (view) {
      var link = document.createElement("a");
      link.href = view.href;
      link.innerHTML = "<span></span><small></small>";
      link.querySelector("span").textContent = view.label;
      link.querySelector("small").textContent = view.status === "sampling" ? "采样中" : "查看";
      target.appendChild(link);
    });
  }

  function showUnavailable() {
    document.body.classList.add("portal-data-unavailable");
    ["hero-metrics", "sampling-metrics", "citation-metrics"].forEach(function (id) {
      var target = document.getElementById(id);
      if (!target) return;
      target.replaceChildren();
      var message = document.createElement("p");
      message.className = "portal-empty";
      message.textContent = "摘要数据暂不可用";
      target.appendChild(message);
    });
    text("footer-updated", "摘要数据暂不可用");
  }

  if (!summary || summary.schema_version !== 1 || !Array.isArray(summary.modules)) {
    showUnavailable();
    return;
  }

  var sampling = moduleById("sampling");
  var citation = moduleById("citation");

  renderMetrics("hero-metrics", summary.hero_metrics);
  renderMetrics("sampling-metrics", sampling && sampling.metrics);
  renderMetrics("citation-metrics", citation && citation.metrics);
  renderInsights();
  if (sampling) renderViews(sampling);

  text("data-period", (summary.period.start || "暂无数据") + " 至 " + (summary.period.end || "暂无数据") + "，各模块按标注日期更新。");
  text("footer-updated", "数据更新至 " + summary.generated_at);
}());
