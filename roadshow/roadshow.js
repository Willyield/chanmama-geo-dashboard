(function () {
  "use strict";

  var deck = document.getElementById("roadshow-deck");
  var scenes = Array.from(document.querySelectorAll("[data-scene]"));
  var dotsHost = document.getElementById("roadshow-dots");
  var counter = document.getElementById("roadshow-counter");
  var progress = document.getElementById("roadshow-progress-fill");
  var previous = document.getElementById("roadshow-prev");
  var next = document.getElementById("roadshow-next");
  var fullscreen = document.getElementById("roadshow-fullscreen");
  var summary = window.GEO_PORTAL_SUMMARY;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
  var activeIndex = 0;

  function metricMap(items) {
    return Object.fromEntries((items || []).map(function (item) { return [item.key, item]; }));
  }

  function formatMetric(metric) {
    if (!metric) return "暂无数据";
    var output = typeof metric.value === "number" ? numberFormatter.format(metric.value) : String(metric.value);
    return output + (metric.unit || "");
  }

  function bindSummary() {
    if (!summary || summary.schema_version !== 1) return;

    var hero = metricMap(summary.hero_metrics);
    var sampling = summary.modules.find(function (item) { return item.id === "sampling"; });
    var citation = summary.modules.find(function (item) { return item.id === "citation"; });
    var samplingMetrics = metricMap(sampling && sampling.metrics);
    var citationMetrics = metricMap(citation && citation.metrics);
    var values = {
      valid_samples: hero.valid_samples,
      round2_mention_rate: hero.round2_mention_rate,
      round2_progress: samplingMetrics.round2_progress,
      citation_events: citationMetrics.citation_events,
      unique_urls: citationMetrics.unique_urls
    };

    document.querySelectorAll("[data-summary]").forEach(function (node) {
      var metric = values[node.dataset.summary];
      if (!metric) return;
      node.textContent = formatMetric(metric);
      if (typeof metric.value === "number") {
        node.dataset.countValue = String(metric.value);
        node.dataset.countUnit = metric.unit || "";
        node.dataset.finalText = formatMetric(metric);
      }
    });

    document.querySelectorAll("[data-summary-date]").forEach(function (node) {
      node.textContent = summary.generated_at;
    });
  }

  function animateNumber(node) {
    if (reduceMotion || node.dataset.counted === "true") return;
    var finalValue = Number(node.dataset.countValue);
    if (!Number.isFinite(finalValue)) return;

    var unit = node.dataset.countUnit || "";
    var decimals = String(finalValue).includes(".") ? String(finalValue).split(".")[1].length : 0;
    var start = performance.now();
    node.dataset.counted = "true";

    function frame(now) {
      var ratio = Math.min(1, (now - start) / 800);
      var eased = 1 - Math.pow(1 - ratio, 3);
      var current = Number((finalValue * eased).toFixed(decimals));
      node.textContent = numberFormatter.format(current) + unit;
      if (ratio < 1) requestAnimationFrame(frame);
      else node.textContent = node.dataset.finalText || numberFormatter.format(finalValue) + unit;
    }

    requestAnimationFrame(frame);
  }

  function activateNumbers(scene) {
    scene.querySelectorAll("[data-count-value]").forEach(animateNumber);
  }

  function buildDots() {
    scenes.forEach(function (scene, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "roadshow-dot";
      button.setAttribute("aria-label", "前往第 " + (index + 1) + " 场");
      button.addEventListener("click", function () { goTo(index); });
      dotsHost.appendChild(button);
    });
  }

  function setActive(index) {
    activeIndex = Math.max(0, Math.min(scenes.length - 1, index));
    scenes.forEach(function (scene, sceneIndex) {
      scene.classList.toggle("is-active", sceneIndex === activeIndex);
    });
    Array.from(dotsHost.children).forEach(function (dot, dotIndex) {
      dot.setAttribute("aria-current", dotIndex === activeIndex ? "true" : "false");
    });
    counter.textContent = String(activeIndex + 1).padStart(2, "0") + " / " + String(scenes.length).padStart(2, "0");
    progress.style.width = ((activeIndex + 1) / scenes.length * 100) + "%";
    previous.disabled = activeIndex === 0;
    next.disabled = activeIndex === scenes.length - 1;
    activateNumbers(scenes[activeIndex]);
    history.replaceState(null, "", "#scene-" + (activeIndex + 1));
  }

  function goTo(index, instant) {
    var target = Math.max(0, Math.min(scenes.length - 1, index));
    if (instant) {
      var previousBehavior = deck.style.scrollBehavior;
      deck.style.scrollBehavior = "auto";
      deck.scrollTop = scenes[target].offsetTop;
      requestAnimationFrame(function () { deck.style.scrollBehavior = previousBehavior; });
    } else {
      scenes[target].scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
    setActive(target);
  }

  function initObserver() {
    if (!("IntersectionObserver" in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) { return entry.isIntersecting; }).sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });
      if (!visible.length) return;
      setActive(scenes.indexOf(visible[0].target));
    }, { root: deck, threshold: [.55, .75] });
    scenes.forEach(function (scene) { observer.observe(scene); });
  }

  function initKeyboard() {
    document.addEventListener("keydown", function (event) {
      if (event.target.matches("input, textarea, select")) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        goTo(activeIndex + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        goTo(activeIndex - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0, true);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(scenes.length - 1, true);
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen().catch(function () {});
    }
  }

  function updateFullscreenButton() {
    var open = Boolean(document.fullscreenElement);
    fullscreen.setAttribute("aria-label", open ? "退出全屏" : "进入全屏");
    fullscreen.title = open ? "退出全屏" : "进入全屏";
  }

  function finalizeForPrint() {
    document.querySelectorAll("[data-final-text]").forEach(function (node) {
      node.textContent = node.dataset.finalText;
    });
    scenes.forEach(function (scene) { scene.classList.add("is-active"); });
  }

  bindSummary();
  buildDots();
  document.documentElement.classList.add("deck-ready");
  var hashMatch = window.location.hash.match(/^#scene-(\d+)$/);
  var initialIndex = hashMatch ? Number(hashMatch[1]) - 1 : 0;
  goTo(initialIndex, true);
  initObserver();
  initKeyboard();

  previous.addEventListener("click", function () { goTo(activeIndex - 1); });
  next.addEventListener("click", function () { goTo(activeIndex + 1); });
  fullscreen.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  window.addEventListener("beforeprint", finalizeForPrint);

}());
