import {
  buildClassificationDelta,
  buildClassificationComparison,
  buildFilteredPublishCohort,
  buildLineGeometry,
  classifyTrendPoint,
  matchesPublishedDate,
  metricCoverageLabel,
  selectTrendPoints,
} from "./trend-view.mjs";

const CATEGORY_LABELS = {
  tutorial_method: "教程方法",
  competitor_comparison: "竞品对比",
  ranking_data: "榜单数据",
  current_hotspot: "时事热点",
};

const CATEGORY_COLOR_SLOTS = {
  tutorial_method: 1,
  competitor_comparison: 2,
  ranking_data: 3,
  current_hotspot: 4,
};

const BASIS_LABELS = {
  PLATFORM_CATEGORY_AGE: "同平台、同分类、发布时间相近",
  PLATFORM_AGE_FALLBACK: "同平台、发布时间相近",
};

const app = document.querySelector("#app");
const reportMeta = document.querySelector("#report-meta");
const headerStatus = document.querySelector("#header-status");
const state = { index: null, reportDate: null, summary: null, records: [], error: null };

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatNumber = (value) => Number.isFinite(value)
  ? new Intl.NumberFormat("zh-CN", { notation: Math.abs(value) >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value)
  : "暂无";
const formatExact = (value) => Number.isFinite(value) ? new Intl.NumberFormat("zh-CN").format(value) : "暂无";
const formatPercent = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%` : "暂无";
const formatSignedExact = (value, unit = "") => Number.isFinite(value)
  ? `${value > 0 ? "+" : ""}${formatExact(value)}${unit}`
  : "暂无";
const formatSignedPercent = (value, unit = "%") => Number.isFinite(value)
  ? `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}${unit}`
  : "暂无";
const changeClass = (value) => value > 0 ? "is-increase" : value < 0 ? "is-decrease" : "is-flat";
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value)) : "暂无";
const formatFullDateTime = (value) => {
  if (!value) return "暂无";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
};

const basisLabel = (basis) => BASIS_LABELS[basis] || "比较范围不可用";

const formatPerformance = (multiple, { compact = false } = {}) => {
  if (!Number.isFinite(multiple)) return "暂不可比";
  const difference = Math.round(Math.abs((multiple - 1) * 100));
  if (multiple > 1.1) return compact ? `领先${difference}%` : `高于同类常规水平${difference}%`;
  if (multiple < 0.9) return compact ? `低${difference}%` : `低于同类常规水平${difference}%`;
  return compact ? "接近常规" : "接近同类常规水平";
};

const comparisonSummary = (record) => {
  const comparison = record.comparison;
  if (!comparison || comparison.status === "INSUFFICIENT_SAMPLE") {
    return `暂不可比 · 参考${comparison?.sampleSize ?? 0}篇内容`;
  }
  if (comparison.lowBase) return `参考价值低 · 常规阅读量过小 · 参考${comparison.sampleSize}篇内容`;
  const parts = [];
  if (comparison.percentile >= 0.9) parts.push("进入同类前10%");
  parts.push(formatPerformance(comparison.medianMultiple));
  parts.push(`参考${comparison.sampleSize}篇内容`);
  if (comparison.basis === "PLATFORM_AGE_FALLBACK") parts.push("按同平台同期内容比较");
  return parts.join(" · ");
};

const performanceCell = (comparison) => {
  if (!comparison || comparison.status === "INSUFFICIENT_SAMPLE") {
    return `<strong>暂不可比</strong><small>参考${comparison?.sampleSize ?? 0}篇内容</small>`;
  }
  if (comparison.lowBase) return "<strong>参考价值低</strong><small>常规阅读量过小</small>";
  return `<strong>${formatPerformance(comparison.medianMultiple, { compact: true })}</strong><small>参考${comparison.sampleSize}篇内容</small>`;
};

const routeState = () => {
  const raw = location.hash.startsWith("#/") ? location.hash.slice(2) : "overview";
  const [routePath, queryString = ""] = raw.split("?");
  const parts = routePath.split("/").filter(Boolean);
  return {
    view: parts[0] || "overview",
    id: parts.length > 1 ? decodeURIComponent(parts.slice(1).join("/")) : null,
    query: new URLSearchParams(queryString),
  };
};

const makeRoute = (view, id = null, query = new URLSearchParams()) => {
  const route = `#/${view}${id ? `/${encodeURIComponent(id)}` : ""}`;
  const queryString = query.toString();
  return queryString ? `${route}?${queryString}` : route;
};

const normalizeLegacyRoute = (route) => {
  const query = new URLSearchParams(route.query);
  let view = route.view;
  let id = route.id;
  let changed = false;
  if (query.has("age")) {
    query.delete("age");
    changed = true;
  }
  if (query.has("publishedDate") && !/^\d{4}-\d{2}-\d{2}$/.test(query.get("publishedDate"))) {
    query.delete("publishedDate");
    changed = true;
  }
  const queryCategory = query.get("category");
  if (queryCategory && !CATEGORY_LABELS[queryCategory]) {
    query.delete("category");
    changed = true;
  }
  if (view === "category" && (!id || !CATEGORY_LABELS[id])) {
    view = "overview";
    id = null;
    changed = true;
  }
  return { route: { ...route, view, id, query }, changed };
};

const setQuery = (name, value) => {
  const route = routeState();
  if (value) route.query.set(name, value); else route.query.delete(name);
  location.hash = makeRoute(route.view, route.id, route.query);
};

const statusClass = (status) => status === "FULL" ? "status-full" : status === "PARTIAL" ? "status-partial" : "status-incident";
const statusLabel = (status) => status === "FULL" ? "完整" : status === "PARTIAL" ? "部分受限" : "采集故障";

const fetchJson = async (url) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
};

const loadReport = async (reportDate) => {
  const [summary, contents] = await Promise.all([
    fetchJson(`./data/${reportDate}/summary.json`),
    fetchJson(`./data/${reportDate}/contents.json`),
  ]);
  state.reportDate = reportDate;
  state.summary = summary;
  state.records = contents.records || [];
  state.error = null;
};

const syncHeader = () => {
  const route = routeState();
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const active = link.dataset.nav === route.view || (route.view === "content" && link.dataset.nav === "contents");
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
  if (!state.summary) return;
  reportMeta.textContent = `数据采样截至 ${formatFullDateTime(state.summary.period.observedTo)}（北京时间） · 生成时间 ${formatFullDateTime(state.summary.generatedAt)}`;
  headerStatus.innerHTML = `<span class="status-chip ${statusClass(state.summary.status)}">${statusLabel(state.summary.status)}</span>`;
};

const filterRecords = (records, query, forced = {}) => {
  const filters = {
    platform: forced.platform || query.get("platform") || "",
    source: query.get("source") || "",
    category: forced.category || query.get("category") || "",
    high: query.get("high") || "",
    quality: query.get("quality") || "",
    publishedDate: query.get("publishedDate") || "",
    search: (query.get("search") || "").trim().toLowerCase(),
  };
  return records.filter((record) => {
    if (filters.platform && record.platformId !== filters.platform) return false;
    if (filters.source && record.sourceId !== filters.source) return false;
    if (filters.category && record.categoryId !== filters.category) return false;
    if (filters.high === "yes" && !record.comparison?.credibleHighPerformance) return false;
    if (filters.high === "no" && record.comparison?.credibleHighPerformance) return false;
    if (filters.quality === "low_base" && !record.comparison?.lowBase) return false;
    if (filters.quality === "fallback" && record.comparison?.basis !== "PLATFORM_AGE_FALLBACK") return false;
    if (filters.quality === "insufficient" && record.comparison?.status !== "INSUFFICIENT_SAMPLE") return false;
    if (!matchesPublishedDate(record, filters.publishedDate)) return false;
    if (filters.search && !`${record.title} ${record.accountName} ${record.platformLabel}`.toLowerCase().includes(filters.search)) return false;
    return true;
  });
};

const optionList = (items, selected, emptyLabel) => [
  `<option value="">${escapeHtml(emptyLabel)}</option>`,
  ...items.map(({ value, label }) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`),
].join("");

const renderFilters = (query, { hidePlatform = false, hideCategory = false, resultCount = null } = {}) => {
  const platforms = [...new Map(state.records.map((record) => [record.platformId, record.platformLabel])).entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  const sources = [...new Map(state.records.map((record) => [record.sourceId, `${record.platformLabel} / ${record.accountName}`])).entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  const categories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
  const dates = (state.index?.reports || []).map((report) => ({ value: report.reportDate, label: `${report.reportDate} / ${statusLabel(report.status)}` }));
  const publishedDate = query.get("publishedDate") || "";
  return `<div class="filter-bar" aria-label="日报筛选">
    <div class="filter-field"><label for="filter-date">日报日期</label><select id="filter-date" data-filter="date">${optionList(dates, state.reportDate, "选择日期")}</select></div>
    ${hidePlatform ? "" : `<div class="filter-field"><label for="filter-platform">平台</label><select id="filter-platform" data-filter="platform">${optionList(platforms, query.get("platform") || "", "全部平台")}</select></div>`}
    <div class="filter-field"><label for="filter-source">账号</label><select id="filter-source" data-filter="source">${optionList(sources, query.get("source") || "", "全部账号")}</select></div>
    ${hideCategory ? "" : `<div class="filter-field"><label for="filter-category">分类</label><select id="filter-category" data-filter="category">${optionList(categories, query.get("category") || "", "全部分类")}</select></div>`}
    <div class="filter-field"><label for="filter-published-date">发布日期</label><input id="filter-published-date" data-filter="publishedDate" type="date" value="${escapeHtml(publishedDate)}"></div>
    <div class="filter-field"><label for="filter-high">表现突出</label><select id="filter-high" data-filter="high"><option value="">全部状态</option><option value="yes"${query.get("high") === "yes" ? " selected" : ""}>仅表现突出</option><option value="no"${query.get("high") === "no" ? " selected" : ""}>排除表现突出</option></select></div>
    <div class="filter-field"><label for="filter-quality">比较质量</label><select id="filter-quality" data-filter="quality"><option value="">全部状态</option><option value="low_base"${query.get("quality") === "low_base" ? " selected" : ""}>仅参考价值低</option><option value="fallback"${query.get("quality") === "fallback" ? " selected" : ""}>仅同平台同期参考</option><option value="insufficient"${query.get("quality") === "insufficient" ? " selected" : ""}>仅暂不可比</option></select></div>
    <div class="filter-field"><label for="filter-search">搜索</label><input id="filter-search" data-filter="search" type="search" value="${escapeHtml(query.get("search") || "")}" placeholder="标题、平台或账号"></div>
  </div>${Number.isInteger(resultCount) ? `<p class="filter-result" role="status" aria-live="polite">筛选结果：${formatExact(resultCount)}篇${publishedDate ? ` · 发布于${escapeHtml(publishedDate)}` : ""}</p>` : ""}`;
};

const qualityBand = () => {
  const coverage = state.summary.coverage;
  const missingAccounts = coverage.missingAccounts || [];
  const partialAccounts = coverage.partialAccounts || [];
  const messages = [];
  if (missingAccounts.length) {
    messages.push(`缺失账号：${missingAccounts.map((item) => item.accountName).join("、")}`);
  }
  if (partialAccounts.length) {
    const details = partialAccounts.map((item) => {
      const limits = [];
      if (item.warningItems) limits.push(`${item.warningItems} 篇字段受限`);
      if (item.skippedItems) limits.push(`${item.skippedItems} 篇未纳入`);
      return `${item.accountName}${limits.length ? `（${limits.join("，")}）` : "（部分字段受限）"}`;
    });
    messages.push(`部分受限：${details.join("、")}`);
  }
  const totals = state.summary.totals;
  const summary = `数据质量：已采集${coverage.collectedAccounts}个账号，共${coverage.expectedAccounts}个 · 可比较${totals.credibleScorableCount}篇，共${totals.contentCount}篇 · ${partialAccounts.length}个来源受限`;
  const detail = messages.join("；") || "全部来源采集完整";
  return `<details class="quality-panel ${state.summary.status === "INCIDENT" ? "danger" : state.summary.status === "PARTIAL" ? "warning" : ""}"><summary><span>${escapeHtml(summary)}</span><span>查看详情</span></summary><div class="quality-detail">${escapeHtml(detail)}。缺失来源不参与确定比较；受限来源仅展示可验证字段。</div></details>`;
};

const executiveSummary = () => {
  const summary = state.summary;
  const totals = summary.totals;
  const baseline = summary.period.kind === "BASELINE";
  const best = summary.bestCategory;
  const overallTitle = baseline ? "首次基线已建立" : summary.status === "FULL" ? "本期采集完整" : "本期数据部分受限";
  const overallText = baseline
    ? `已采集${summary.coverage.collectedAccounts}个账号，计划监测${summary.coverage.expectedAccounts}个账号，共${totals.contentCount}篇内容；连续快照形成前暂不判断涨跌。`
    : `本期新增播放/阅读 ${formatNumber(totals.totalViewDelta)}，新增互动 ${formatNumber(totals.commonInteractionDelta)}。`;
  const opportunityTitle = best ? `${best.categoryLabel}样本最具参考性` : "分类参考内容仍在积累";
  const opportunityText = best
    ? `${best.contentCount}篇内容中有${best.credibleScorableCount}篇可比较，${formatPerformance(best.trustedRelativeIndex)}。`
    : "尚无分类达到至少5篇可比较内容，暂不输出最佳分类。";
  const riskTitle = `${summary.coverage.partialAccounts.length}个来源部分受限`;
  const riskText = `可比较内容${totals.credibleScorableCount}篇，共${totals.contentCount}篇；${totals.lowBaseCount}篇常规阅读量过小，${totals.fallbackCount}篇采用同平台同期参考。`;
  return `<section class="executive-summary" aria-label="管理摘要"><div class="executive-heading"><h2>今日结论</h2><span>${baseline ? "首次基线" : "连续快照"}</span></div><div class="executive-grid">
    <div><span>整体状态</span><strong>${escapeHtml(overallTitle)}</strong><p>${escapeHtml(overallText)}</p></div>
    <div><span>内容机会</span><strong>${escapeHtml(opportunityTitle)}</strong><p>${escapeHtml(opportunityText)}</p></div>
    <div><span>数据边界</span><strong>${escapeHtml(riskTitle)}</strong><p>${escapeHtml(riskText)}</p></div>
  </div></section>`;
};

const metricStrip = () => {
  const totals = state.summary.totals;
  const baseline = state.summary.period.kind === "BASELINE";
  return `<section class="metric-strip" aria-label="核心指标">
    <div class="metric-cell"><span class="metric-label">已采集账号</span><strong class="metric-value">${state.summary.coverage.collectedAccounts}个账号</strong><small class="metric-note">计划监测${state.summary.coverage.expectedAccounts}个</small></div>
    <div class="metric-cell"><span class="metric-label">${baseline ? "累计播放/阅读" : "区间新增播放/阅读"}</span><strong class="metric-value ${!baseline && totals.totalViewDelta > 0 ? "metric-positive" : ""}">${formatNumber(baseline ? totals.totalViews : totals.totalViewDelta)}</strong><small class="metric-note">${baseline ? "首日累计基线" : `累计 ${formatNumber(totals.totalViews)}`}</small></div>
    <div class="metric-cell"><span class="metric-label">内容总数</span><strong class="metric-value">${formatExact(totals.contentCount)}</strong><small class="metric-note">共同互动 ${formatExact(totals.commonInteractions)}</small></div>
    <div class="metric-cell"><span class="metric-label">数据表现优秀</span><strong class="metric-value">${formatExact(totals.credibleHighPerformanceCount)}</strong><small class="metric-note">已排除常规阅读量过小的结果</small></div>
  </section>`;
};

const barList = (items, {
  labelKey,
  labelTitle = "分类",
  valueKey,
  countKey = "contentCount",
  colorKey = null,
  routeView,
  routeIdKey,
}) => {
  const rankedItems = [...items].sort((a, b) =>
    (b[countKey] || 0) - (a[countKey] || 0)
    || (b[valueKey] || 0) - (a[valueKey] || 0),
  );
  const maximum = Math.max(1, ...rankedItems.map((item) => item[countKey] || 0));
  return `<div class="bar-list"><div class="bar-head" aria-hidden="true"><span>${escapeHtml(labelTitle)}</span><span>发布量</span><span>篇数</span><span>表现</span></div>${rankedItems.map((item, index) => {
    const width = Math.max(1, ((item[countKey] || 0) / maximum) * 100);
    const colorSlot = colorKey ? CATEGORY_COLOR_SLOTS[item[colorKey]] : null;
    const fillColor = colorSlot ? `var(--category-${colorSlot})` : "var(--signal)";
    const query = new URLSearchParams({ date: state.reportDate });
    return `<button class="bar-row" type="button" data-route="${escapeHtml(makeRoute(routeView, item[routeIdKey], query))}">
      <span class="bar-name">${escapeHtml(item[labelKey])}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${width.toFixed(1)}%;background:${fillColor}"></span></span>
      <span class="bar-count">${formatExact(item[countKey])}篇</span>
      <span class="bar-index">${formatPerformance(item[valueKey], { compact: true })}</span>
    </button>`;
  }).join("") || `<div class="empty-state">暂无可比较数据</div>`}</div>`;
};

const topSignals = (records) => {
  const recordMap = new Map(records.map((record) => [record.key, record]));
  const items = state.summary.topContents.map((key) => recordMap.get(key)).filter(Boolean).slice(0, 3);
  return `<div class="content-signals">${items.map((record, index) => `<div class="signal-row">
    <span class="signal-index">${index + 1}</span>
    <div class="signal-title"><button type="button" data-route="${escapeHtml(makeRoute("content", record.key, new URLSearchParams({ date: state.reportDate })))}"><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.platformLabel)} / ${escapeHtml(record.accountName)} / ${escapeHtml(CATEGORY_LABELS[record.categoryId] || record.categoryId)}</small><small class="signal-explanation">${escapeHtml(comparisonSummary(record))}</small></button></div>
    <span class="signal-score"><strong>${formatExact(record.metrics.views)}</strong><small>播放/阅读</small></span>
  </div>`).join("") || `<div class="empty-state">当前没有数据表现优秀内容</div>`}</div>`;
};

const pathData = (points, xOffset = 22) => points
  .map((point, index) => `${index ? "L" : "M"}${(point.x + xOffset).toFixed(2)},${point.y.toFixed(2)}`)
  .join(" ");

const trendRoute = (query, publishedDate) => {
  const nextQuery = new URLSearchParams(query);
  nextQuery.set("date", state.reportDate);
  nextQuery.set("publishedDate", publishedDate);
  return makeRoute("contents", null, nextQuery);
};

const renderPublishTrendPlot = (points, query, days) => {
  const width = days === 7 ? 720 : 1320;
  const plotLeft = 62;
  const plotRight = 24;
  const innerWidth = width - plotLeft - plotRight;
  const medianHeight = 190;
  const totalHeight = 136;
  const volumeHeight = 98;
  const medianTop = 22;
  const medianBottom = 24;
  const totalTop = 18;
  const totalBottom = 18;
  const volumeTop = 12;
  const volumeBottom = 28;
  const medianGeometry = buildLineGeometry(points, (point) =>
    classifyTrendPoint(point) === "known" ? point.views.median : null, {
    width: innerWidth,
    height: medianHeight,
    top: medianTop,
    bottom: medianBottom,
  });
  const totalMaximum = Math.max(1, ...points
    .filter((point) => classifyTrendPoint(point) === "known")
    .map((point) => point.views.total));
  const volumeMaximum = Math.max(1, ...points.map((point) => point.contentCount));
  const peakContent = [...points].sort((left, right) => right.contentCount - left.contentCount)[0];
  const step = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth;
  const totalBarWidth = Math.max(7, Math.min(22, step * 0.56));
  const volumeBarWidth = Math.max(7, Math.min(20, step * 0.48));
  const dateIndexes = points.map((_, index) => index)
    .filter((index) => days === 7 || index % 5 === 0 || index === points.length - 1);
  const xAt = (index) => plotLeft + index * step;
  const plotGrid = (maximum, height, top, bottom, suffix = "") => {
    const usableHeight = height - top - bottom;
    const ticks = [
      { value: maximum, ratio: 1 },
      { value: maximum / 2, ratio: 0.5 },
      { value: 0, ratio: 0 },
    ];
    const horizontal = ticks.map(({ value, ratio }) => {
      const y = top + usableHeight * (1 - ratio);
      return `<line class="trend-grid-line${ratio === 0 ? " trend-grid-line-base" : ""}" x1="${plotLeft}" y1="${y.toFixed(2)}" x2="${width - plotRight}" y2="${y.toFixed(2)}"></line>
        <text class="trend-scale-label" x="${plotLeft - 10}" y="${(y + 3).toFixed(2)}" text-anchor="end">${escapeHtml(`${formatExact(value)}${suffix}`)}</text>`;
    }).join("");
    const vertical = dateIndexes.map((index) => `<line class="trend-grid-line trend-grid-line-vertical" x1="${xAt(index).toFixed(2)}" y1="${top}" x2="${xAt(index).toFixed(2)}" y2="${height - bottom}"></line>`).join("");
    return `${horizontal}${vertical}`;
  };
  const medianPaths = medianGeometry.paths
    .map((path) => `<path class="trend-line trend-line-primary" d="${pathData(path, plotLeft)}"></path>`)
    .join("");
  const missingMark = (point, index, baseline, variant) => {
    const x = xAt(index);
    return `<g class="trend-mark trend-missing-mark trend-missing-${variant}" data-trend-date="${escapeHtml(point.date)}" transform="translate(${x.toFixed(2)} ${(baseline - 7).toFixed(2)})">
      <line x1="-5" y1="-5" x2="5" y2="5"></line><line x1="5" y1="-5" x2="-5" y2="5"></line>
    </g>`;
  };
  const medianMarks = points.map((point, index) => {
    const state = classifyTrendPoint(point);
    if (state === "empty") return "";
    if (state === "unknown") return missingMark(point, index, medianHeight - medianBottom, "median");
    const geometry = medianGeometry.points[index];
    const partial = point.views.knownCount < point.views.totalCount;
    const zero = point.views.median === 0;
    return `<circle class="trend-mark trend-primary-point${partial ? " is-partial" : ""}${zero ? " is-zero" : ""}" data-trend-date="${escapeHtml(point.date)}" cx="${(geometry.x + plotLeft).toFixed(2)}" cy="${geometry.y.toFixed(2)}" r="4"></circle>`;
  }).join("");
  const totalMarks = points.map((point, index) => {
    const state = classifyTrendPoint(point);
    if (state === "empty") return "";
    if (state === "unknown") return missingMark(point, index, totalHeight - totalBottom, "total");
    const available = totalHeight - totalTop - totalBottom;
    const rawHeight = point.views.total / totalMaximum * available;
    const barHeight = point.views.total === 0 ? 2 : Math.max(3, rawHeight);
    const partial = point.views.knownCount < point.views.totalCount;
    return `<rect class="trend-mark trend-total-bar${partial ? " is-partial" : ""}${point.views.total === 0 ? " is-zero" : ""}" data-trend-date="${escapeHtml(point.date)}" x="${(xAt(index) - totalBarWidth / 2).toFixed(2)}" y="${(totalHeight - totalBottom - barHeight).toFixed(2)}" width="${totalBarWidth.toFixed(2)}" height="${barHeight.toFixed(2)}"></rect>`;
  }).join("");
  const volumeMarks = points.map((point, index) => {
    if (!point.contentCount) return "";
    const available = volumeHeight - volumeTop - volumeBottom;
    const barHeight = Math.max(3, point.contentCount / volumeMaximum * available);
    return `<rect class="trend-mark trend-volume-bar" data-trend-date="${escapeHtml(point.date)}" x="${(xAt(index) - volumeBarWidth / 2).toFixed(2)}" y="${(volumeHeight - volumeBottom - barHeight).toFixed(2)}" width="${volumeBarWidth.toFixed(2)}" height="${barHeight.toFixed(2)}"></rect>`;
  }).join("");
  const dateLabels = dateIndexes.map((index) => `<text class="trend-axis-label" x="${xAt(index).toFixed(2)}" y="${volumeHeight - 7}" text-anchor="middle">${escapeHtml(points[index].date.slice(5))}</text>`).join("");
  const completePoints = points.map((point, index) => ({ point, index }))
    .filter(({ point }) => classifyTrendPoint(point) === "known"
      && point.views.knownCount === point.views.totalCount);
  const peakMedian = [...completePoints].sort((left, right) => right.point.views.median - left.point.views.median)[0];
  const peakTotal = [...completePoints].sort((left, right) => right.point.views.total - left.point.views.total)[0];
  let latestKnownIndex = -1;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (classifyTrendPoint(points[index]) === "known") {
      latestKnownIndex = index;
      break;
    }
  }
  const latestKnown = latestKnownIndex >= 0 ? points[latestKnownIndex] : null;
  const latestGeometry = latestKnownIndex >= 0 ? medianGeometry.points[latestKnownIndex] : null;
  const latestLabel = latestKnown && latestGeometry?.y !== null ? (() => {
    const x = latestGeometry.x + plotLeft;
    const rightAligned = x > width - 130;
    const partial = latestKnown.views.knownCount < latestKnown.views.totalCount;
    return `<text class="trend-latest-label${partial ? " is-partial" : ""}" x="${(x + (rightAligned ? -9 : 9)).toFixed(2)}" y="${Math.max(14, latestGeometry.y - 10).toFixed(2)}" text-anchor="${rightAligned ? "end" : "start"}">最新 ${escapeHtml(formatExact(latestKnown.views.median))}</text>`;
  })() : "";
  const focusTargets = points.map((point, index) => {
    const state = classifyTrendPoint(point);
    const slotWidth = Math.max(28, step);
    const x = xAt(index);
    const left = x - slotWidth / 2;
    const tooltipAbsolute = Math.max(8, Math.min(width - 246, x - 119));
    const tooltipLeft = tooltipAbsolute - left;
    const coverage = metricCoverageLabel(point.views);
    const detail = state === "empty"
      ? "当日无发布"
      : state === "unknown"
        ? `发布${point.contentCount}篇 · 阅读数据未知`
        : `累计${formatExact(point.views.total)} · 常规${formatExact(point.views.median)}`;
    const route = trendRoute(query, point.date);
    const aria = `${point.date}，${detail}，${coverage}，查看当天内容`;
    return `<button type="button" class="trend-point-link trend-date-focus" style="left:${left.toFixed(2)}px;width:${slotWidth.toFixed(2)}px;--trend-tooltip-left:${tooltipLeft.toFixed(2)}px" data-trend-focus data-trend-date="${escapeHtml(point.date)}" data-trend-route="${escapeHtml(route)}" data-route="${escapeHtml(route)}" aria-label="${escapeHtml(aria)}">
      <span class="trend-date-tooltip"><strong>${escapeHtml(`${point.date.slice(5)} · 发布${point.contentCount}篇`)}</strong><span>${escapeHtml(detail)}</span><small>${escapeHtml(coverage)}</small></span>
    </button>`;
  }).join("");
  const peakMedianText = peakMedian
    ? `完整峰值 ${formatExact(peakMedian.point.views.median)} · ${peakMedian.point.date.slice(5)}`
    : "完整数据不足，暂不标峰值";
  const peakTotalText = peakTotal
    ? `完整峰值 ${formatExact(peakTotal.point.views.total)} · ${peakTotal.point.date.slice(5)}`
    : "完整数据不足，暂不标峰值";
  return `<div class="trend-scroll" tabindex="0" aria-label="趋势图，可横向滚动"><div class="trend-stage" style="width:${width}px">
    <div class="trend-legend" aria-label="图例"><span><i class="legend-line"></i>单篇常规阅读</span><span><i class="legend-total"></i>当前累计阅读</span><span><i class="legend-volume"></i>发布量</span><span><i class="legend-missing"></i>缺失或部分覆盖</span></div>
    <div class="trend-panel-label"><div><strong>单篇常规阅读</strong><span>按发布日期分组，截至本次采样</span></div><div class="trend-panel-stats"><span>${latestKnown ? `最新 ${formatExact(latestKnown.views.median)} · ${latestKnown.date.slice(5)}` : "暂无已知值"}</span><span>${escapeHtml(peakMedianText)}</span></div></div>
    <svg class="trend-svg trend-svg-primary" viewBox="0 0 ${width} ${medianHeight}" role="img" aria-label="按发布日期分组、截至本次采样的单篇常规阅读">
      ${plotGrid(medianGeometry.maximum, medianHeight, medianTop, medianBottom)}
      ${medianPaths}${medianMarks}${latestLabel}
    </svg>
    <div class="trend-panel-label trend-panel-label-secondary"><div><strong>当前累计播放/阅读</strong><span>按发布日期分组，不代表历史每日新增</span></div><div class="trend-panel-stats"><span>${escapeHtml(peakTotalText)}</span><span>橙色表示部分覆盖或未知</span></div></div>
    <svg class="trend-svg trend-svg-total" viewBox="0 0 ${width} ${totalHeight}" role="img" aria-label="按发布日期分组、截至本次采样的当前累计播放阅读柱状图">
      ${plotGrid(totalMaximum, totalHeight, totalTop, totalBottom)}
      ${totalMarks}
    </svg>
    <div class="trend-panel-label trend-panel-label-secondary"><div><strong>发布量</strong><span>与上方视图共享同一发布日期位置</span></div><div class="trend-panel-stats"><span>最高 ${formatExact(peakContent?.contentCount)}篇 · ${escapeHtml(peakContent?.date?.slice(5) || "暂无")}</span></div></div>
    <svg class="trend-svg trend-svg-volume" viewBox="0 0 ${width} ${volumeHeight}" role="img" aria-label="按发布日期分组的内容发布量">
      ${plotGrid(volumeMaximum, volumeHeight, volumeTop, volumeBottom, "篇")}
      ${volumeMarks}${dateLabels}
    </svg>
    ${focusTargets}
  </div></div>`;
};

const categoryComposition = (query) => {
  const contractPoints = state.summary.trends?.publishCohortCurrent?.points || [];
  const dateKeys = contractPoints.map((point) => point.date);
  if (dateKeys.length < 14) return "";
  const comparisonQuery = new URLSearchParams(query);
  comparisonQuery.delete("category");
  comparisonQuery.delete("publishedDate");
  const records = filterRecords(state.records, comparisonQuery);
  const categoryIds = Object.keys(CATEGORY_LABELS);
  const comparison = buildClassificationComparison(records, dateKeys, categoryIds);
  const delta = buildClassificationDelta(comparison);
  const activeCategory = query.get("category") || "";
  const maximum = Math.max(1, ...delta.rows.flatMap((row) => [row.latestCount, row.previousCount]));
  const growth = delta.leadingGrowth;
  const leader = delta.leadingCategory;
  const growthCopy = growth?.countDelta > 0
    ? `<strong>${escapeHtml(CATEGORY_LABELS[growth.categoryId])}</strong><small><span class="${changeClass(growth.countDelta)}">${formatSignedExact(growth.countDelta, "篇")}</span>，是本期主要增量</small>`
    : `<strong>分类结构平稳</strong><small>本期没有明显增长分类</small>`;
  const rows = delta.rows.map((row) => {
    const categoryLabel = CATEGORY_LABELS[row.categoryId];
    const colorSlot = CATEGORY_COLOR_SLOTS[row.categoryId];
    const latestWidth = row.latestCount / maximum * 100;
    const previousWidth = row.previousCount / maximum * 100;
    const label = `${categoryLabel}，最近7日${row.latestCount}篇，此前7日${row.previousCount}篇，变化${formatSignedExact(row.countDelta, "篇")}`;
    return `<button type="button" class="comparison-row" data-category-trend="${escapeHtml(row.categoryId)}" aria-pressed="${activeCategory === row.categoryId}" aria-label="${escapeHtml(label)}" style="--comparison-color:var(--category-${colorSlot})">
      <span class="comparison-category"><span class="composition-swatch category-${colorSlot}"></span><strong>${escapeHtml(categoryLabel)}</strong>${activeCategory === row.categoryId ? "<small>当前已筛选</small>" : ""}</span>
      <span class="comparison-period"><span class="comparison-number"><strong>${formatExact(row.latestCount)}篇</strong><small>${formatPercent(row.latestShare)}</small></span><span class="comparison-track"><span class="comparison-fill is-current" style="width:${latestWidth.toFixed(1)}%"></span></span></span>
      <span class="comparison-period"><span class="comparison-number"><strong>${formatExact(row.previousCount)}篇</strong><small>${formatPercent(row.previousShare)}</small></span><span class="comparison-track"><span class="comparison-fill is-previous" style="width:${previousWidth.toFixed(1)}%"></span></span></span>
      <span class="comparison-delta"><strong class="${changeClass(row.countDelta)}">${formatSignedExact(row.countDelta, "篇")}</strong><small class="${changeClass(row.shareDelta)}">${formatSignedPercent(row.shareDelta, "个百分点")}</small></span>
    </button>`;
  }).join("");
  return `<section class="section composition-section"><div class="section-header"><div><h2>最近7日 vs 此前7日</h2><span>分类发布结构对比</span></div><span>${escapeHtml(comparison.latest7.from)} 至 ${escapeHtml(comparison.latest7.to)}</span></div>
    <div class="comparison-insights" aria-label="两期对比结论">
      <div><span>最近7日发布</span><strong>${formatExact(comparison.latest7.contentCount)}篇</strong><small>较此前7日 <span class="${changeClass(delta.contentDelta)}">${formatSignedExact(delta.contentDelta, "篇")} / ${formatSignedPercent(delta.contentChange)}</span></small></div>
      <div><span>活跃账号</span><strong>${formatExact(comparison.latest7.activeSourceCount)}个</strong><small>此前${formatExact(comparison.previous7.activeSourceCount)}个 · <span class="${changeClass(delta.activeSourceDelta)}">${formatSignedExact(delta.activeSourceDelta, "个")}</span></small></div>
      <div><span>增长最多</span>${growthCopy}</div>
      <div><span>本期主要分类</span><strong>${escapeHtml(CATEGORY_LABELS[leader?.categoryId] || "暂无")}</strong><small>${formatExact(leader?.latestCount)}篇 · 占${formatPercent(leader?.latestShare)}</small></div>
    </div>
    <div class="comparison-matrix"><div class="comparison-head" aria-hidden="true"><span>分类</span><span>最近7日</span><span>此前7日</span><span>增减</span></div>${rows}</div>
    <div class="comparison-period-meta"><span>最近7日：${escapeHtml(comparison.latest7.from)} 至 ${escapeHtml(comparison.latest7.to)} · 阅读已知${formatExact(comparison.latest7.views.knownCount)} / ${formatExact(comparison.latest7.views.totalCount)}篇</span><span>此前7日：${escapeHtml(comparison.previous7.from)} 至 ${escapeHtml(comparison.previous7.to)} · 阅读已知${formatExact(comparison.previous7.views.knownCount)} / ${formatExact(comparison.previous7.views.totalCount)}篇</span></div>
    <div class="trend-disclosure">两期账号构成、内容发布时间与指标覆盖不同；当前累计数据只反映采样时可见值，不代表内容效果升降，也不用于因果判断。</div></section>`;
};

const renderIncrementTrend = (query, days, dateKeys) => {
  const byDate = new Map((state.summary.trends?.snapshotIncrement || []).map((point) => [point.date, point]));
  const points = dateKeys.map((date) => byDate.get(date) || { date, views: null, status: "NO_SNAPSHOT" });
  const available = points.filter((point) => Number.isFinite(point.views));
  if (!available.length) {
    return `<div class="baseline-note"><strong>真实新增趋势尚未形成</strong><span>需要相邻两次11账号完整成功快照。缺失日期保持空档，周一合并区间只记录一个点，不拆分周末数值。</span></div>`;
  }
  const width = days === 7 ? 720 : 1320;
  const geometry = buildLineGeometry(points, (point) => point.views, { width: width - 44, height: 220, top: 18, bottom: 30 });
  const paths = geometry.paths.map((path) => `<path class="trend-line trend-line-total" d="${pathData(path)}"></path>`).join("");
  return `<div class="trend-scroll" tabindex="0" aria-label="真实新增趋势图，可横向滚动"><div class="trend-stage" style="width:${width}px"><svg class="trend-svg" viewBox="0 0 ${width} 220" role="img" aria-label="相邻完整快照之间的真实新增播放阅读">${paths}</svg></div></div>`;
};

const trendChart = (query) => {
  const days = query.get("trend") === "7" ? 7 : 30;
  const mode = query.get("trendMode") === "increment" ? "increment" : "cohort";
  const contract = state.summary.trends?.publishCohortCurrent;
  const contractPoints = selectTrendPoints(contract?.points || [], days);
  const dateKeys = contractPoints.map((point) => point.date);
  const filteredRecords = filterRecords(state.records, query);
  const points = buildFilteredPublishCohort(filteredRecords, dateKeys);
  const contentCount = points.reduce((sum, point) => sum + point.contentCount, 0);
  const knownViews = points.reduce((sum, point) => sum + point.views.knownCount, 0);
  const knownViewTotal = points.reduce((sum, point) => sum + (point.views.total || 0), 0);
  const totalViews = knownViews ? knownViewTotal : contentCount ? null : 0;
  const coverage = contentCount ? knownViews / contentCount : null;
  const unknownViews = Math.max(0, contentCount - knownViews);
  const peakContent = [...points].sort((left, right) => right.contentCount - left.contentCount)[0];
  const rangeLabel = points.length ? `${points[0].date} 至 ${points.at(-1).date}` : "暂无日期";
  const collectionCoverage = state.summary.rolling30Days?.collectionCoverage;
  const collectionNote = collectionCoverage?.status === "COMPLETE"
    ? `${collectionCoverage.completeSources}个来源均已覆盖到窗口起点或平台末尾`
    : `当前可见快照 · ${collectionCoverage?.completeSources ?? 0} / ${collectionCoverage?.expectedSources ?? state.summary.coverage.expectedAccounts}个来源已证明完整覆盖`;
  const rangeControls = `<div class="trend-controls"><div class="segmented" aria-label="趋势口径"><button type="button" data-trend-mode="cohort" aria-pressed="${mode === "cohort"}">按发布日期</button><button type="button" data-trend-mode="increment" aria-pressed="${mode === "increment"}">真实新增</button></div><div class="segmented" aria-label="趋势时间范围"><button type="button" data-trend="7" aria-pressed="${days === 7}">近7日</button><button type="button" data-trend="30" aria-pressed="${days === 30}">近30日</button></div></div>`;
  const body = mode === "cohort"
    ? `${contractPoints.length ? renderPublishTrendPlot(points, query, days) : `<div class="empty-state">暂无发布日期趋势契约</div>`}<div class="trend-footnote">按发布日期分组，展示截至本次采样的当前累计表现，不代表历史日新增。末日数据截至${formatFullDateTime(state.summary.period.observedTo)}。${escapeHtml(collectionNote)}。</div>`
    : renderIncrementTrend(query, days, dateKeys);
  return `<section class="section trend-workbench"><div class="section-header"><div><h2>发布与阅读表现</h2><span>${mode === "cohort" ? rangeLabel : "相邻完整快照真实新增"}</span></div>${rangeControls}</div>
    <div class="trend-summary" aria-label="当前筛选的数据摘要">
      <div class="trend-kpi is-primary"><span>发布内容</span><strong>${formatExact(contentCount)}篇</strong><small>${days}日范围内的发布总量</small></div>
      <div class="trend-kpi"><span>当前可见播放/阅读</span><strong>${formatExact(totalViews)}</strong><small>来自${formatExact(knownViews)}篇已知内容</small></div>
      <div class="trend-kpi"><span>数据完整度</span><strong>${Number.isFinite(coverage) ? formatPercent(coverage) : "暂无"}</strong><small>${formatExact(knownViews)}篇已知 · ${formatExact(unknownViews)}篇未显示</small><span class="coverage-meter" aria-hidden="true"><span style="width:${Number.isFinite(coverage) ? Math.max(0, Math.min(100, coverage * 100)).toFixed(1) : 0}%"></span></span></div>
      <div class="trend-kpi"><span>发布高峰</span><strong>${formatExact(peakContent?.contentCount)}篇</strong><small>${escapeHtml(peakContent?.date || "暂无日期")}</small></div>
    </div>
    ${body}
  </section>`;
};

const rollingAccountTable = () => {
  const rolling = state.summary.rolling30Days;
  if (!rolling) return "";
  const platformLabels = new Map(state.summary.platforms.map((platform) => [platform.platformId, platform.platformLabel]));
  const complete = rolling.collectionCoverage?.status === "COMPLETE";
  const coverageText = complete
    ? `采集窗口完整 · ${rolling.collectionCoverage.completeSources}个来源`
    : `窗口待补采 · 已证明${rolling.collectionCoverage?.completeSources ?? 0}个 / 共${rolling.collectionCoverage?.expectedSources ?? rolling.accounts.length}个来源`;
  return `<section class="section"><div class="section-header"><div><h2>${complete ? "近30日账号汇总" : "近30日可见内容汇总"}</h2><span>${escapeHtml(rolling.window.from)} 至 ${escapeHtml(rolling.window.to)} · 末日截至采样时刻</span></div><span>${escapeHtml(coverageText)}</span></div>${complete ? "" : `<div class="trend-coverage-warning">当前快照未证明全部账号已翻页到窗口起点或平台末尾，本表仅用于调查，不作为完整30日结论或部署依据。</div>`}<div class="table-scroll"><table class="data-table account-trend-table">
    <thead><tr><th>平台 / 账号</th><th class="number">发布内容</th><th class="number">累计播放/阅读</th><th class="number">单篇平均</th><th class="number">单篇常规阅读</th><th>阅读指标覆盖</th><th class="number">共同互动率</th><th>采集窗口</th><th class="number">数据优秀</th></tr></thead>
    <tbody>${rolling.accounts.map((account) => `<tr><td><strong>${escapeHtml(platformLabels.get(account.platformId) || account.platformId)}</strong><small>${escapeHtml(account.accountName)}</small></td><td class="number">${formatExact(account.contentCount)}</td><td class="number">${formatExact(account.views.total)}</td><td class="number">${formatExact(account.views.average)}</td><td class="number">${formatExact(account.views.median)}</td><td><strong>${escapeHtml(metricCoverageLabel(account.views))}</strong><small>${Number.isFinite(account.views.coverage) ? formatPercent(account.views.coverage) : "暂无"}</small></td><td class="number">${formatPercent(account.interaction.rate)}<small>已知${account.interaction.knownCount}篇 / 共${account.interaction.totalCount}篇</small></td><td><strong>${account.collectionCoverage?.status === "COMPLETE" ? "完整" : "待补采"}</strong><small>${Number.isInteger(account.collectionCoverage?.pagesFetched) ? `${account.collectionCoverage.pagesFetched}页` : "暂无翻页证据"}</small></td><td class="number">${formatExact(account.highPerformanceCount)}</td></tr>`).join("")}</tbody>
  </table></div></section>`;
};

const sortedRecords = (records, sort) => [...records].sort((a, b) => {
  if (sort === "delta") return (b.deltas.views || 0) - (a.deltas.views || 0);
  if (sort === "relative") {
    return Number(b.comparison?.credibleHighPerformance) - Number(a.comparison?.credibleHighPerformance)
      || Number(a.comparison?.lowBase) - Number(b.comparison?.lowBase)
      || (b.comparison?.medianMultiple || 0) - (a.comparison?.medianMultiple || 0);
  }
  if (sort === "published") return b.publishedAt.localeCompare(a.publishedAt);
  return (b.metrics.views || 0) - (a.metrics.views || 0);
});

const renderTable = (records, query) => {
  const sort = query.get("sort") || "views";
  const rows = sortedRecords(records, sort);
  const detailRoute = (record) => {
    const detailQuery = new URLSearchParams(query);
    detailQuery.set("date", state.reportDate);
    return makeRoute("content", record.key, detailQuery);
  };
  if (!rows.length) return `<div class="empty-state">当前筛选条件下没有内容</div>`;
  return `<div class="table-scroll"><table class="data-table">
    <thead><tr>
      <th>内容</th><th>平台 / 账号</th><th>分类</th>
      <th class="number"><button class="sort-button" data-sort="views">累计播放/阅读</button></th>
      <th class="number"><button class="sort-button" data-sort="delta">区间增量</button></th>
      <th class="number">互动率</th>
      <th class="number"><button class="sort-button" data-sort="relative">同类表现</button></th>
      <th>定位</th>
    </tr></thead>
    <tbody>${rows.map((record) => `<tr>
      <td class="table-title"><a href="${escapeHtml(record.publicUrl || detailRoute(record))}"${record.publicUrl ? " target=\"_blank\" rel=\"noopener noreferrer\"" : ""}>${escapeHtml(record.title)}</a><small>${formatDateTime(record.publishedAt)}</small></td>
      <td>${escapeHtml(record.platformLabel)}<br><small>${escapeHtml(record.accountName)}</small></td>
      <td><span class="tag">${escapeHtml(CATEGORY_LABELS[record.categoryId] || record.categoryId)}</span>${record.comparison?.credibleHighPerformance ? " <span class=\"high-flag\">数据优秀</span>" : ""}${record.comparison?.lowBase ? " <span class=\"low-base-flag\">参考价值低</span>" : ""}${record.comparison?.basis === "PLATFORM_AGE_FALLBACK" ? " <span class=\"fallback-flag\">同平台同期参考</span>" : ""}</td>
      <td class="number">${formatExact(record.metrics.views)}</td>
      <td class="number ${record.deltas.views > 0 ? "metric-positive" : ""}">${formatExact(record.deltas.views)}</td>
      <td class="number">${formatPercent(record.commonInteractionRate)}</td>
      <td class="number performance-cell">${performanceCell(record.comparison)}</td>
      <td><div class="row-actions"><button type="button" class="button-action" data-route="${escapeHtml(detailRoute(record))}">详情</button>${record.publicUrl ? `<a class="text-action" href="${escapeHtml(record.publicUrl)}" target="_blank" rel="noopener noreferrer">原文</a>` : ""}${record.adminUrl ? `<a class="text-action" href="${escapeHtml(record.adminUrl)}" target="_blank" rel="noopener noreferrer" title="需要平台登录">后台</a>` : ""}</div></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
};

const heading = (title, description) => `<div class="page-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="heading-actions"><span class="status-chip ${statusClass(state.summary.status)}">${statusLabel(state.summary.status)}</span></div></div>`;

const renderOverview = (route) => {
  const filtered = filterRecords(state.records, route.query);
  const periodLabel = state.summary.period.kind === "BASELINE"
    ? "首次累计基线"
    : state.summary.period.kind === "WEEKEND_72H" ? "周五至周日合并" : "连续快照区间";
  app.innerHTML = `${heading("经营数据总览", `${state.summary.reportDate} / ${periodLabel}`)}
    ${executiveSummary()}${metricStrip()}
    <div class="dashboard-grid">
      <section class="section"><div class="section-header"><h2>分类表现与发布量</h2><span>同类表现仅使用可比较样本</span></div>${barList(state.summary.categories, { labelKey: "categoryLabel", valueKey: "trustedRelativeIndex", colorKey: "categoryId", routeView: "category", routeIdKey: "categoryId" })}</section>
      <section class="section"><div class="section-header"><h2>数据表现优秀内容</h2><span>实际数据优先 · 点击查看依据</span></div>${topSignals(filtered)}</section>
    </div>
    ${qualityBand()}
    <section class="section operation-section"><div class="section-header"><h2>运营筛选</h2><span>平台、账号、分类、发布日期与比较质量</span></div>${renderFilters(route.query, { resultCount: filtered.length })}</section>
    ${trendChart(route.query)}
    ${categoryComposition(route.query)}
    ${rollingAccountTable()}
    <section class="section"><div class="section-header"><h2>内容明细</h2><span>${filtered.length} 篇</span></div>${renderTable(filtered.slice(0, 20), route.query)}</section>`;
};

const renderPlatform = (route) => {
  const platformId = route.id || route.query.get("platform") || state.summary.platforms[0]?.platformId;
  const platform = state.summary.platforms.find((item) => item.platformId === platformId);
  if (!platform) return renderEmpty("暂无平台数据");
  const records = filterRecords(state.records, route.query, { platform: platformId });
  const aggregates = state.summary.platformCategories.filter((item) => item.platformId === platformId);
  app.innerHTML = `${heading(platform.platformLabel, "查看该平台四类内容的累计数据、区间增量和同类表现")}
    ${renderFilters(route.query, { hidePlatform: true, resultCount: records.length })}${qualityBand()}
    <section class="section"><div class="section-header"><h2>分类比较</h2><span>仅使用可比较样本</span></div>${barList(aggregates, { labelKey: "categoryLabel", valueKey: "trustedRelativeIndex", colorKey: "categoryId", routeView: "category", routeIdKey: "categoryId" })}</section>
    <section class="section"><div class="section-header"><h2>平台内容</h2><span>${records.length} 篇</span></div>${renderTable(records, route.query)}</section>`;
};

const renderCategory = (route) => {
  const categoryId = route.id || route.query.get("category") || state.summary.categories[0]?.categoryId;
  const records = filterRecords(state.records, route.query, { category: categoryId });
  const aggregates = state.summary.platformCategories.filter((item) => item.categoryId === categoryId);
  app.innerHTML = `${heading(CATEGORY_LABELS[categoryId] || categoryId, "比较同一类内容在不同平台的实际数据和同类表现")}
    ${renderFilters(route.query, { hideCategory: true, resultCount: records.length })}${qualityBand()}
    <section class="section"><div class="section-header"><h2>跨平台同类表现</h2><span>仅使用可比较样本</span></div>${barList(aggregates, { labelKey: "platformLabel", labelTitle: "平台", valueKey: "trustedRelativeIndex", routeView: "platform", routeIdKey: "platformId" })}</section>
    <section class="section"><div class="section-header"><h2>分类内容</h2><span>${records.length} 篇</span></div>${renderTable(records, route.query)}</section>`;
};

const renderContents = (route) => {
  const records = filterRecords(state.records, route.query);
  app.innerHTML = `${heading("内容明细", "按标题、平台、账号、分类、发布日期和表现状态定位内容")}
    ${renderFilters(route.query, { resultCount: records.length })}
    <section class="section"><div class="section-header"><h2>全部内容</h2><span>${records.length} 篇</span></div>${renderTable(records, route.query)}</section>`;
};

const renderContent = (route) => {
  const record = state.records.find((item) => item.key === route.id);
  if (!record) return renderEmpty("没有找到这篇内容");
  const reasons = record.comparison?.reasons?.length ? record.comparison.reasons.join("；") : "未达到高表现门槛或样本不足";
  const comparison = record.comparison || {};
  const performanceLabel = comparison.credibleHighPerformance
    ? "数据表现优秀"
    : comparison.lowBase && comparison.highPerformance ? "数据较高，但常规阅读量过小"
      : comparison.status === "INSUFFICIENT_SAMPLE" ? "暂不可比" : "接近常规表现";
  const comparabilityNote = comparison.lowBase
    ? `参考价值低：同类常规阅读量低于 ${formatExact(comparison.lowBaseThreshold)}`
    : comparison.status === "SCORABLE" ? "可用于比较" : "参考内容不足";
  const backQuery = new URLSearchParams(route.query);
  backQuery.set("date", state.reportDate);
  app.innerHTML = `<div class="detail-title"><div class="detail-meta"><span>${escapeHtml(record.platformLabel)}</span><span>${escapeHtml(record.accountName)}</span><span>${escapeHtml(CATEGORY_LABELS[record.categoryId] || record.categoryId)}</span></div><h1>${escapeHtml(record.title)}</h1><div class="row-actions">${record.publicUrl ? `<a class="text-action" href="${escapeHtml(record.publicUrl)}" target="_blank" rel="noopener noreferrer">打开原文</a>` : ""}${record.adminUrl ? `<a class="text-action" href="${escapeHtml(record.adminUrl)}" target="_blank" rel="noopener noreferrer" title="需要平台登录">打开后台</a>` : ""}<button class="button-action" data-route="${escapeHtml(makeRoute("contents", null, backQuery))}">返回明细</button></div></div>
    <div class="detail-grid">
      <section class="section"><div class="section-header"><h2>数据表现</h2><span>${escapeHtml(performanceLabel)}</span></div><dl class="definition-list">
        <div class="definition-row"><dt>累计播放/阅读</dt><dd>${formatExact(record.metrics.views)}</dd></div>
        <div class="definition-row"><dt>区间增量</dt><dd>${formatExact(record.deltas.views)} / ${record.interval.hours ?? "--"} 小时</dd></div>
        <div class="definition-row"><dt>点赞 / 评论</dt><dd>${formatExact(record.metrics.likes)} / ${formatExact(record.metrics.comments)}</dd></div>
        <div class="definition-row"><dt>收藏 / 分享</dt><dd>${formatExact(record.metrics.favorites)} / ${formatExact(record.metrics.shares)}</dd></div>
        <div class="definition-row"><dt>共同互动率</dt><dd>${formatPercent(record.commonInteractionRate)}</dd></div>
        <div class="definition-row"><dt>采样时间</dt><dd>${formatDateTime(record.observedAt)}</dd></div>
      </dl></section>
      <section class="section"><div class="section-header"><h2>比较与分类</h2><span>参考${comparison.sampleSize ?? 0}篇内容</span></div><dl class="definition-list">
        <div class="definition-row"><dt>本篇阅读量</dt><dd>${formatExact(record.metrics.views)}</dd></div>
        <div class="definition-row"><dt>同类常规阅读量</dt><dd>${formatExact(comparison.median)}</dd></div>
        <div class="definition-row"><dt>领先 / 落后幅度</dt><dd>${escapeHtml(formatPerformance(comparison.medianMultiple))}</dd></div>
        <div class="definition-row"><dt>参考内容数</dt><dd>${formatExact(comparison.sampleSize)}篇</dd></div>
        <div class="definition-row"><dt>比较范围</dt><dd>${escapeHtml(basisLabel(comparison.basis))}${comparison.basis === "PLATFORM_AGE_FALLBACK" ? "（同类参考不足，改用同平台同期内容）" : ""}</dd></div>
        <div class="definition-row"><dt>可比性说明</dt><dd>${escapeHtml(comparabilityNote)}</dd></div>
        <div class="definition-row"><dt>判断原因</dt><dd>${escapeHtml(reasons)}</dd></div>
        <div class="definition-row"><dt>分类依据</dt><dd>${escapeHtml(record.classification?.reason || "--")}</dd></div>
        <div class="definition-row"><dt>标签</dt><dd>${record.tags?.length ? record.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(" ") : "--"}</dd></div>
      </dl></section>
    </div>`;
};

const renderEmpty = (message) => { app.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`; };

const render = async () => {
  const normalized = normalizeLegacyRoute(routeState());
  const route = normalized.route;
  if (normalized.changed) history.replaceState(null, "", makeRoute(route.view, route.id, route.query));
  const requestedDate = route.query.get("date") || state.index?.latest;
  try {
    if (requestedDate && requestedDate !== state.reportDate) await loadReport(requestedDate);
    syncHeader();
    if (!state.summary) return renderEmpty("暂无日报数据");
    if (route.view === "platform") renderPlatform(route);
    else if (route.view === "category") renderCategory(route);
    else if (route.view === "contents") renderContents(route);
    else if (route.view === "content") renderContent(route);
    else renderOverview(route);
    app.focus({ preventScroll: true });
  } catch (error) {
    state.error = error;
    app.innerHTML = `<div class="error-state"><div><strong>日报载入失败</strong><br>${escapeHtml(error.message)}</div></div>`;
  }
};

const setTrendDateFocus = (target, persist = false) => {
  const stage = target?.closest(".trend-stage");
  if (!stage) return;
  const date = target.dataset.trendDate;
  stage.classList.add("has-active-date");
  stage.querySelectorAll("[data-trend-date]").forEach((element) => {
    element.classList.toggle("is-active", element.dataset.trendDate === date);
    if (element.matches("[data-trend-focus]")) {
      element.classList.toggle("is-selected", persist && element === target);
    }
  });
};

const clearTrendDateFocus = (stage) => {
  if (!stage || stage.querySelector(".trend-date-focus.is-selected")) return;
  stage.classList.remove("has-active-date");
  stage.querySelectorAll("[data-trend-date]").forEach((element) => element.classList.remove("is-active"));
};

app.addEventListener("pointerover", (event) => {
  const target = event.target.closest("[data-trend-focus]");
  if (target && !target.contains(event.relatedTarget)) setTrendDateFocus(target);
});

app.addEventListener("pointerout", (event) => {
  const target = event.target.closest("[data-trend-focus]");
  if (target && !target.contains(event.relatedTarget)) clearTrendDateFocus(target.closest(".trend-stage"));
});

app.addEventListener("focusin", (event) => {
  const target = event.target.closest("[data-trend-focus]");
  if (target) setTrendDateFocus(target);
});

app.addEventListener("focusout", (event) => {
  const target = event.target.closest("[data-trend-focus]");
  if (target && !target.contains(event.relatedTarget)) clearTrendDateFocus(target.closest(".trend-stage"));
});

app.addEventListener("click", (event) => {
  const trendFocusTarget = event.target.closest("[data-trend-focus]");
  if (trendFocusTarget) {
    event.preventDefault();
    const touchLike = window.matchMedia("(hover: none)").matches;
    if (touchLike && !trendFocusTarget.classList.contains("is-selected")) {
      setTrendDateFocus(trendFocusTarget, true);
      return;
    }
    location.hash = trendFocusTarget.dataset.trendRoute;
    return;
  }
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    event.preventDefault();
    location.hash = routeTarget.dataset.route;
    return;
  }
  const sortTarget = event.target.closest("[data-sort]");
  if (sortTarget) setQuery("sort", sortTarget.dataset.sort);
  const trendTarget = event.target.closest("[data-trend]");
  if (trendTarget) setQuery("trend", trendTarget.dataset.trend);
  const trendModeTarget = event.target.closest("[data-trend-mode]");
  if (trendModeTarget) setQuery("trendMode", trendModeTarget.dataset.trendMode);
  const categoryTarget = event.target.closest("[data-category-trend]");
  if (categoryTarget) {
    const selected = routeState().query.get("category");
    setQuery("category", selected === categoryTarget.dataset.categoryTrend ? "" : categoryTarget.dataset.categoryTrend);
  }
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const stage = event.target.closest(".trend-stage");
    if (stage) {
      stage.querySelectorAll(".is-selected").forEach((element) => element.classList.remove("is-selected"));
      clearTrendDateFocus(stage);
    }
    return;
  }
  if (event.key !== " ") return;
  const routeTarget = event.target.closest("a[data-route]");
  if (!routeTarget) return;
  event.preventDefault();
  location.hash = routeTarget.dataset.route;
});

app.addEventListener("change", async (event) => {
  const target = event.target.closest("[data-filter]");
  if (!target) return;
  if (target.dataset.filter === "date") {
    const route = routeState();
    route.query.set("date", target.value);
    location.hash = makeRoute(route.view, route.id, route.query);
  } else setQuery(target.dataset.filter, target.value);
});

let searchTimer;
app.addEventListener("input", (event) => {
  const target = event.target.closest('[data-filter="search"]');
  if (!target) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => setQuery("search", target.value.trim()), 250);
});

window.addEventListener("hashchange", render);

try {
  state.index = await fetchJson("./data/index.json");
  if (!location.hash) location.hash = makeRoute("overview", null, new URLSearchParams({ date: state.index.latest }));
  await render();
} catch (error) {
  state.error = error;
  app.innerHTML = `<div class="error-state"><div><strong>日报入口不可用</strong><br>${escapeHtml(error.message)}</div></div>`;
}
