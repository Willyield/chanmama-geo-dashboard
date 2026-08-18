(function () {
  "use strict";

  var summary = window.GEO_PORTAL_SUMMARY;
  var numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function text(id, output) {
    var node = document.getElementById(id);
    if (node) node.textContent = output;
  }

  function metricValue(metric) {
    if (!metric || metric.value === null || metric.value === undefined || metric.value === "") return "暂无数据";
    var output = typeof metric.value === "number" ? numberFormatter.format(metric.value) : String(metric.value);
    return output + (metric.unit || "");
  }

  function moduleById(id) {
    return summary.modules.find(function (module) { return module.id === id; });
  }

  function metricByKey(module, key) {
    return module && module.metrics.find(function (metric) { return metric.key === key; });
  }

  function renderMetrics() {
    var target = document.getElementById("hero-metrics");
    if (!target) return;
    target.replaceChildren();

    summary.hero_metrics.forEach(function (metric) {
      var item = document.createElement("div");
      item.className = "portal-metric";

      var output = document.createElement("strong");
      output.textContent = metricValue(metric);
      output.setAttribute("aria-label", metric.label + " " + metricValue(metric));
      if (typeof metric.value === "number") {
        output.dataset.countValue = String(metric.value);
        output.dataset.countUnit = metric.unit || "";
      }

      var label = document.createElement("span");
      label.textContent = metric.label;

      var context = document.createElement("small");
      context.textContent = metric.context || metric.source || "";

      item.append(output, label, context);
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
    }, []).sort(function (first, second) {
      return String(second.insight.as_of || "").localeCompare(String(first.insight.as_of || ""));
    }).slice(0, 4);

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
      link.textContent = "查看依据 →";

      row.append(meta, body, link);
      target.appendChild(row);
    });
  }

  function syncWorkspace() {
    var sampling = moduleById("sampling");
    var citation = moduleById("citation");
    var product = moduleById("product_geo");
    var progressMetric = metricByKey(sampling, "round2_progress");
    var citationEvents = metricByKey(citation, "citation_events");
    var citationUrls = metricByKey(citation, "unique_urls");
    var cqqProgress = metricByKey(product, "cqq_progress");
    var creativeProgress = metricByKey(product, "creative_progress");

    var current = Number(progressMetric && progressMetric.value) || 0;
    var unitMatch = String(progressMetric && progressMetric.unit || "").match(/\/(\d+)/);
    var total = unitMatch ? Number(unitMatch[1]) : 0;
    var remaining = Math.max(0, total - current);
    var percent = total ? current / total * 100 : 0;

    text("round2-progress-text", numberFormatter.format(current) + " / " + numberFormatter.format(total));
    text("round2-remaining", remaining ? "剩余 " + numberFormatter.format(remaining) + " 个样本" : "两轮全量复测已完成");
    text("round2-updated", "更新至 " + (sampling.updated_at || "日期待确认"));
    text("citation-event-count", metricValue(citationEvents) + " 次");
    text("citation-url-count", metricValue(citationUrls));
    text("citation-updated", "更新至 " + (citation.updated_at || "日期待确认"));
    text("cqq-progress-text", metricValue(cqqProgress));
    text("creative-progress-text", metricValue(creativeProgress));

    var creativeCurrent = Number(creativeProgress && creativeProgress.value) || 0;
    var creativeUnitMatch = String(creativeProgress && creativeProgress.unit || "").match(/\/(\d+)/);
    var creativeTotal = creativeUnitMatch ? Number(creativeUnitMatch[1]) : 0;
    var creativePercent = creativeTotal ? creativeCurrent / creativeTotal * 100 : 0;
    text("attention-round2", "08 月 18 日有效回答 270/270；两日 FULL 仍为 " + numberFormatter.format(creativeCurrent) + "/" + numberFormatter.format(creativeTotal) + "，明日批次尚未授权。");

    var progressBar = document.getElementById("round2-progress-bar");
    var progressTrack = progressBar && progressBar.parentElement;
    if (progressBar) progressBar.style.width = percent.toFixed(2) + "%";
    if (progressTrack) {
      progressTrack.setAttribute("aria-valuemax", String(total));
      progressTrack.setAttribute("aria-valuenow", String(current));
      progressTrack.setAttribute("aria-valuetext", numberFormatter.format(current) + " / " + numberFormatter.format(total));
    }

    var creativeBar = document.getElementById("creative-progress-bar");
    var creativeTrack = creativeBar && creativeBar.parentElement;
    if (creativeBar) creativeBar.style.width = creativePercent.toFixed(2) + "%";
    if (creativeTrack) {
      creativeTrack.setAttribute("aria-valuemax", String(creativeTotal));
      creativeTrack.setAttribute("aria-valuenow", String(creativeCurrent));
      creativeTrack.setAttribute("aria-valuetext", numberFormatter.format(creativeCurrent) + " / " + numberFormatter.format(creativeTotal));
    }

    text("data-period", (summary.period.start || "暂无数据") + " 至 " + (summary.period.end || "暂无数据") + "，各模块按标注日期更新。");
    text("summary-updated", "数据更新至 " + summary.generated_at);
    text("footer-updated", "数据更新至 " + summary.generated_at);
  }

  function showUnavailable() {
    document.body.classList.add("portal-data-unavailable");
    ["hero-metrics", "workspace-progress", "insight-list"].forEach(function (id) {
      var target = document.getElementById(id);
      if (!target) return;
      target.replaceChildren();
      var message = document.createElement("p");
      message.className = "portal-empty";
      message.textContent = "摘要数据暂不可用";
      target.appendChild(message);
    });
    text("summary-updated", "摘要数据暂不可用");
    text("footer-updated", "摘要数据暂不可用");
  }

  function animateNumber(node) {
    if (reduceMotion || node.dataset.counted === "true") return;
    var finalValue = Number(node.dataset.countValue);
    if (!Number.isFinite(finalValue)) return;

    var unit = node.dataset.countUnit || "";
    var start = performance.now();
    var duration = 700;
    node.dataset.counted = "true";

    function frame(now) {
      var progress = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      var decimals = String(finalValue).includes(".") ? String(finalValue).split(".")[1].length : 0;
      var current = Number((finalValue * eased).toFixed(decimals));
      node.textContent = numberFormatter.format(current) + unit;
      if (progress < 1) requestAnimationFrame(frame);
      else node.textContent = numberFormatter.format(finalValue) + unit;
    }

    requestAnimationFrame(frame);
  }

  function initCountAnimation() {
    var strip = document.getElementById("hero-metrics");
    if (!strip) return;

    function run() {
      strip.querySelectorAll("[data-count-value]").forEach(animateNumber);
    }

    if (reduceMotion || !("IntersectionObserver" in window)) {
      run();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      run();
      observer.disconnect();
    }, { threshold: .25 });
    observer.observe(strip);
  }

  function initMotion() {
    if (reduceMotion) return;
    document.documentElement.classList.add("motion-ready");

    var reveals = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      reveals.forEach(function (node) { node.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: "0px 0px -5%" });

    reveals.forEach(function (node) { observer.observe(node); });
  }

  if (!summary || summary.schema_version !== 1 || !Array.isArray(summary.modules)) {
    showUnavailable();
    initMotion();
    return;
  }

  renderMetrics();
  renderInsights();
  syncWorkspace();
  initMotion();
  initCountAnimation();
}());
