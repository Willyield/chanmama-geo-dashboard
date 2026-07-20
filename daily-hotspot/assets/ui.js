export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

export function icon(name) {
  return `<i data-lucide="${escapeHtml(name)}"></i>`;
}

export function formatDate(value) {
  if (!value) return "暂缺";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return escapeHtml(value);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function formatDateTime(value) {
  if (!value) return "暂缺";
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : escapeHtml(text);
}

export function formatEventRange(start, end) {
  const startText = formatDateTime(start);
  const endText = formatDateTime(end);
  if (startText === "暂缺") return startText;
  if (endText === "暂缺") return startText;
  const sameDate = startText.slice(0, 10) === endText.slice(0, 10);
  return sameDate ? `${startText}<br>至 ${endText.slice(11)}` : `${startText}<br>至 ${endText}`;
}

export function firstLine(value, fallback = "暂缺") {
  const text = String(value ?? "").split(/\r?\n/).find((line) => line.trim());
  return text?.trim() || fallback;
}

export function splitLines(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function sourceLinksHtml(links, limit = 2) {
  if (!links?.length) return `<span class="cell-secondary">来源暂缺</span>`;
  return `<div class="source-stack">${links.slice(0, limit).map((link) => {
    const url = safeUrl(link.url);
    const label = link.domain || link.label || "原始来源";
    return `<a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(link.label || label)}">
      <span>${escapeHtml(label)}</span>${icon("external-link")}
    </a>`;
  }).join("")}${links.length > limit ? `<span class="cell-secondary">另有 ${links.length - limit} 个来源</span>` : ""}</div>`;
}

export function statusChip(label, className = "") {
  return `<span class="status-chip ${escapeHtml(className)}">${escapeHtml(label)}</span>`;
}

export function renderPageHeading({ eyebrow, title, subtitle, views, activeView }) {
  return `<div class="page-heading">
    <div class="page-heading-copy">
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </div>
    <nav class="subnav" aria-label="模块视图">
      ${views.map((view) => `<button type="button" data-view="${escapeHtml(view.id)}" class="${view.id === activeView ? "is-active" : ""}">${escapeHtml(view.label)}</button>`).join("")}
    </nav>
  </div>`;
}

export function renderSummaryBand({ summary, metrics, observedAt, sourceWorkbook, verifiedAt = null }) {
  return `<section class="summary-band" aria-label="今日摘要">
    <div class="summary-copy">
      <h2>${escapeHtml(summary)}</h2>
      <div class="summary-meta">
        <span>${icon("clock-3")}观察 ${escapeHtml(observedAt || "暂缺")}</span>
        ${verifiedAt ? `<span>${icon("badge-check")}复核 ${escapeHtml(verifiedAt)}</span>` : ""}
        <span>${icon("file-spreadsheet")}来源 ${escapeHtml(sourceWorkbook || "暂缺")}</span>
      </div>
    </div>
    <div class="summary-metrics">
      ${metrics.map((metric) => `<div class="metric">
        <span class="metric-value">${escapeHtml(metric.value)}</span>
        <span class="metric-label">${escapeHtml(metric.label)}</span>
      </div>`).join("")}
    </div>
  </section>`;
}

export function renderDecisionStrip(items, recordKey) {
  if (!items?.length) return "";
  return `<div class="decision-strip" aria-label="优先动作">
    ${items.slice(0, 3).map((item, index) => `<button class="decision-item" type="button" data-open-id="${escapeHtml(item[recordKey])}">
      <span class="decision-index">0${index + 1}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(firstLine(item.action || item.reason))}</span>
    </button>`).join("")}
  </div>`;
}

export function renderEmpty(message, iconName = "inbox") {
  return `<div class="empty-state"><div>${icon(iconName)}<div>${escapeHtml(message)}</div></div></div>`;
}

export function renderError(message) {
  return `<div class="error-state"><div>${icon("triangle-alert")}<div>${escapeHtml(message)}</div></div></div>`;
}

export function detailSection(title, iconName, content) {
  return `<section class="drawer-section"><h3>${icon(iconName)}${escapeHtml(title)}</h3>${content}</section>`;
}

export function factGrid(facts) {
  return `<div class="fact-grid">${facts.map(([label, value]) => `<div>
    <span class="fact-label">${escapeHtml(label)}</span>
    <span class="fact-value">${value}</span>
  </div>`).join("")}</div>`;
}

export function listHtml(items, fallback = "暂缺") {
  if (!items?.length) return `<p class="drawer-prose">${escapeHtml(fallback)}</p>`;
  return `<ul class="detail-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function uniqueOptions(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
}
