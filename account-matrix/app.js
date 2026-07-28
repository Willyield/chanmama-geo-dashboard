const CATEGORY_LABELS = {
  brand_product: "品牌产品",
  current_hotspot: "时事热点",
  ranking_data: "榜单数据",
  tutorial_method: "教程方法",
  industry_insight: "行业洞察",
  competitor_comparison: "竞品对比",
  unclassified: "待分类",
};

const CATEGORY_COLOR_SLOTS = {
  brand_product: 1,
  current_hotspot: 2,
  ranking_data: 3,
  tutorial_method: 4,
  industry_insight: 5,
  competitor_comparison: 6,
  unclassified: 1,
};

const BASIS_LABELS = {
  PLATFORM_CATEGORY_AGE: "同平台、同分类、同发布阶段",
  PLATFORM_AGE_FALLBACK: "同平台、同发布阶段",
};

const AGE_LABELS = {
  age_0_1: "0-1天",
  age_2_3: "2-3天",
  age_4_7: "4-7天",
  age_8_14: "8-14天",
  age_15_30: "15-30天",
  age_over_30: "30天以上",
  age_unknown: "发布时间未知",
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
  : "--";
const formatExact = (value) => Number.isFinite(value) ? new Intl.NumberFormat("zh-CN").format(value) : "--";
const formatPercent = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%` : "--";
const formatMultiple = (value) => Number.isFinite(value) ? `${value.toFixed(1)}×` : "--";
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value)) : "--";

const basisLabel = (basis) => BASIS_LABELS[basis] || "比较口径不可用";

const comparisonSummary = (record) => {
  const comparison = record.comparison;
  if (!comparison || comparison.status === "INSUFFICIENT_SAMPLE") {
    return `样本不足 · ${comparison?.sampleSize ?? 0}篇样本`;
  }
  const parts = [];
  if (Number.isFinite(comparison.medianMultiple)) {
    parts.push(`约为${basisLabel(comparison.basis)}中位数的${formatMultiple(comparison.medianMultiple)}`);
  }
  parts.push(`${comparison.sampleSize}篇样本`);
  if (comparison.basis === "PLATFORM_AGE_FALLBACK") parts.push("回退口径");
  if (comparison.lowBase) parts.push("低基数");
  return parts.join(" · ");
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
  reportMeta.textContent = `${state.summary.reportDate} / ${state.summary.period.kind === "WEEKEND_72H" ? "周末合并" : "日报"} / ${formatDateTime(state.summary.generatedAt)} 更新`;
  headerStatus.innerHTML = `<span class="status-chip ${statusClass(state.summary.status)}">${statusLabel(state.summary.status)}</span>`;
};

const filterRecords = (records, query, forced = {}) => {
  const filters = {
    platform: forced.platform || query.get("platform") || "",
    source: query.get("source") || "",
    category: forced.category || query.get("category") || "",
    age: query.get("age") || "",
    high: query.get("high") || "",
    quality: query.get("quality") || "",
    search: (query.get("search") || "").trim().toLowerCase(),
  };
  return records.filter((record) => {
    if (filters.platform && record.platformId !== filters.platform) return false;
    if (filters.source && record.sourceId !== filters.source) return false;
    if (filters.category && record.categoryId !== filters.category) return false;
    if (filters.age && record.id !== filters.age) return false;
    if (filters.high === "yes" && !record.comparison?.credibleHighPerformance) return false;
    if (filters.high === "no" && record.comparison?.credibleHighPerformance) return false;
    if (filters.quality === "low_base" && !record.comparison?.lowBase) return false;
    if (filters.quality === "fallback" && record.comparison?.basis !== "PLATFORM_AGE_FALLBACK") return false;
    if (filters.quality === "insufficient" && record.comparison?.status !== "INSUFFICIENT_SAMPLE") return false;
    if (filters.search && !`${record.title} ${record.accountName} ${record.platformLabel}`.toLowerCase().includes(filters.search)) return false;
    return true;
  });
};

const optionList = (items, selected, emptyLabel) => [
  `<option value="">${escapeHtml(emptyLabel)}</option>`,
  ...items.map(({ value, label }) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`),
].join("");

const renderFilters = (query, { hidePlatform = false, hideCategory = false } = {}) => {
  const platforms = [...new Map(state.records.map((record) => [record.platformId, record.platformLabel])).entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  const sources = [...new Map(state.records.map((record) => [record.sourceId, `${record.platformLabel} / ${record.accountName}`])).entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  const categories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
  const ages = Object.entries(AGE_LABELS).filter(([value]) => value !== "age_unknown").map(([value, label]) => ({ value, label }));
  const dates = (state.index?.reports || []).map((report) => ({ value: report.reportDate, label: `${report.reportDate} / ${statusLabel(report.status)}` }));
  return `<div class="filter-bar" aria-label="日报筛选">
    <div class="filter-field"><label for="filter-date">日期</label><select id="filter-date" data-filter="date">${optionList(dates, state.reportDate, "选择日期")}</select></div>
    ${hidePlatform ? "" : `<div class="filter-field"><label for="filter-platform">平台</label><select id="filter-platform" data-filter="platform">${optionList(platforms, query.get("platform") || "", "全部平台")}</select></div>`}
    <div class="filter-field"><label for="filter-source">账号</label><select id="filter-source" data-filter="source">${optionList(sources, query.get("source") || "", "全部账号")}</select></div>
    ${hideCategory ? "" : `<div class="filter-field"><label for="filter-category">分类</label><select id="filter-category" data-filter="category">${optionList(categories, query.get("category") || "", "全部分类")}</select></div>`}
    <div class="filter-field"><label for="filter-age">发布龄</label><select id="filter-age" data-filter="age">${optionList(ages, query.get("age") || "", "全部发布龄")}</select></div>
    <div class="filter-field"><label for="filter-high">可信高表现</label><select id="filter-high" data-filter="high"><option value="">全部状态</option><option value="yes"${query.get("high") === "yes" ? " selected" : ""}>仅可信高表现</option><option value="no"${query.get("high") === "no" ? " selected" : ""}>排除可信高表现</option></select></div>
    <div class="filter-field"><label for="filter-quality">比较质量</label><select id="filter-quality" data-filter="quality"><option value="">全部口径</option><option value="low_base"${query.get("quality") === "low_base" ? " selected" : ""}>仅低基数</option><option value="fallback"${query.get("quality") === "fallback" ? " selected" : ""}>仅回退口径</option><option value="insufficient"${query.get("quality") === "insufficient" ? " selected" : ""}>仅样本不足</option></select></div>
    <div class="filter-field"><label for="filter-search">搜索</label><input id="filter-search" data-filter="search" type="search" value="${escapeHtml(query.get("search") || "")}" placeholder="标题、平台或账号"></div>
  </div>`;
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
  const summary = `数据质量：账号 ${coverage.collectedAccounts}/${coverage.expectedAccounts} · 可信可比 ${totals.credibleScorableCount}/${totals.contentCount} 篇 · ${partialAccounts.length} 个来源受限`;
  const detail = messages.join("；") || "全部来源采集完整";
  return `<details class="quality-panel ${state.summary.status === "INCIDENT" ? "danger" : state.summary.status === "PARTIAL" ? "warning" : ""}"><summary><span>${escapeHtml(summary)}</span><span>查看详情</span></summary><div class="quality-detail">${escapeHtml(detail)}。缺失来源不进入确定比较；受限来源仅展示可验证字段。</div></details>`;
};

const executiveSummary = () => {
  const summary = state.summary;
  const totals = summary.totals;
  const baseline = summary.period.kind === "BASELINE";
  const best = summary.bestCategory;
  const overallTitle = baseline ? "首次基线已建立" : summary.status === "FULL" ? "本期采集完整" : "本期数据部分受限";
  const overallText = baseline
    ? `已覆盖 ${summary.coverage.collectedAccounts}/${summary.coverage.expectedAccounts} 个账号、${totals.contentCount} 篇内容；连续快照形成前暂不判断涨跌。`
    : `本期新增播放/阅读 ${formatNumber(totals.totalViewDelta)}，新增互动 ${formatNumber(totals.commonInteractionDelta)}。`;
  const opportunityTitle = best && best.trustedRelativeIndex > 1
    ? `${best.categoryLabel}相对表现领先`
    : best ? `${best.categoryLabel}样本最具参考性` : "分类样本仍在积累";
  const opportunityText = best
    ? `${best.contentCount}篇内容中有${best.credibleScorableCount}篇可信可比，整体约为本平台同阶段基线的${formatMultiple(best.trustedRelativeIndex)}。`
    : "尚无分类达到至少5篇非低基数可比样本，暂不输出分类冠军。";
  const riskTitle = `${summary.coverage.partialAccounts.length}个来源部分受限`;
  const riskText = `可信可比内容 ${totals.credibleScorableCount}/${totals.contentCount} 篇；低基数 ${totals.lowBaseCount} 篇、回退口径 ${totals.fallbackCount} 篇。`;
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
    <div class="metric-cell"><span class="metric-label">覆盖账号</span><strong class="metric-value">${state.summary.coverage.collectedAccounts}/${state.summary.coverage.expectedAccounts}</strong><small class="metric-note">完整率 ${formatPercent(state.summary.coverage.percentage)}</small></div>
    <div class="metric-cell"><span class="metric-label">${baseline ? "累计播放/阅读" : "区间新增播放/阅读"}</span><strong class="metric-value ${!baseline && totals.totalViewDelta > 0 ? "metric-positive" : ""}">${formatNumber(baseline ? totals.totalViews : totals.totalViewDelta)}</strong><small class="metric-note">${baseline ? "首日累计基线" : `累计 ${formatNumber(totals.totalViews)}`}</small></div>
    <div class="metric-cell"><span class="metric-label">内容总数</span><strong class="metric-value">${formatExact(totals.contentCount)}</strong><small class="metric-note">共同互动 ${formatExact(totals.commonInteractions)}</small></div>
    <div class="metric-cell"><span class="metric-label">可信高表现</span><strong class="metric-value">${formatExact(totals.credibleHighPerformanceCount)}</strong><small class="metric-note">已排除低基数信号</small></div>
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
  return `<div class="bar-list"><div class="bar-head" aria-hidden="true"><span>${escapeHtml(labelTitle)}</span><span>发布量</span><span>篇数</span><span>相对</span></div>${rankedItems.map((item, index) => {
    const width = Math.max(1, ((item[countKey] || 0) / maximum) * 100);
    const colorSlot = colorKey ? CATEGORY_COLOR_SLOTS[item[colorKey]] : null;
    const fillColor = colorSlot ? `var(--category-${colorSlot})` : "var(--signal)";
    const query = new URLSearchParams({ date: state.reportDate });
    return `<button class="bar-row" type="button" data-route="${escapeHtml(makeRoute(routeView, item[routeIdKey], query))}">
      <span class="bar-name">${escapeHtml(item[labelKey])}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${width.toFixed(1)}%;background:${fillColor}"></span></span>
      <span class="bar-count">${formatExact(item[countKey])}篇</span>
      <span class="bar-index">${formatMultiple(item[valueKey])}</span>
    </button>`;
  }).join("") || `<div class="empty-state">暂无可比较数据</div>`}</div>`;
};

const topSignals = (records) => {
  const recordMap = new Map(records.map((record) => [record.key, record]));
  const items = state.summary.topContents.map((key) => recordMap.get(key)).filter(Boolean).slice(0, 3);
  return `<div class="content-signals">${items.map((record, index) => `<div class="signal-row">
    <span class="signal-index">${String(index + 1).padStart(2, "0")}</span>
    <div class="signal-title"><button type="button" data-route="${escapeHtml(makeRoute("content", record.key, new URLSearchParams({ date: state.reportDate })))}"><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.platformLabel)} / ${escapeHtml(record.accountName)} / ${escapeHtml(CATEGORY_LABELS[record.categoryId] || record.categoryId)}</small><small class="signal-explanation">${escapeHtml(comparisonSummary(record))}</small></button></div>
    <span class="signal-score"><strong>${formatExact(record.metrics.views)}</strong><small>播放/阅读</small></span>
  </div>`).join("") || `<div class="empty-state">当前没有排除低基数后的可信高表现内容</div>`}</div>`;
};

const trendChart = (query) => {
  if (state.summary.period.kind === "BASELINE") {
    return `<section class="section"><div class="section-header"><h2>播放/阅读趋势</h2><span>等待连续快照</span></div><div class="baseline-note"><strong>首次基线已建立</strong><span>第二次成功快照后开始显示真实区间增量，不反推历史变化。</span></div></section>`;
  }
  const days = query.get("trend") === "7" ? 7 : 30;
  const items = (state.summary.trend || []).slice(-days);
  const maximum = Math.max(1, ...items.map((item) => item.totalViewDelta || 0));
  return `<section class="section"><div class="section-header"><h2>新增播放/阅读趋势</h2><div class="segmented" aria-label="趋势时间范围"><button type="button" data-trend="7" aria-pressed="${days === 7}">7日</button><button type="button" data-trend="30" aria-pressed="${days === 30}">30日</button></div></div>
    <div class="trend-chart">${items.map((item) => {
      const height = Math.max(1, ((item.totalViewDelta || 0) / maximum) * 100);
      return `<div class="trend-column ${item.periodKind === "WEEKEND_72H" ? "weekend" : ""}" title="${escapeHtml(item.reportDate)} / 新增 ${formatExact(item.totalViewDelta)}"><div class="trend-bar"><span style="height:${height.toFixed(1)}%"></span></div><small>${escapeHtml(item.reportDate.slice(5))}</small></div>`;
    }).join("") || `<div class="empty-state">第二次成功快照后形成趋势</div>`}</div></section>`;
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
      <th>内容</th><th>平台 / 账号</th><th>分类 / 发布龄</th>
      <th class="number"><button class="sort-button" data-sort="views">累计播放/阅读</button></th>
      <th class="number"><button class="sort-button" data-sort="delta">区间增量</button></th>
      <th class="number">互动率</th>
      <th class="number"><button class="sort-button" data-sort="relative">相对指数</button></th>
      <th>定位</th>
    </tr></thead>
    <tbody>${rows.map((record) => `<tr>
      <td class="table-title"><a href="${escapeHtml(record.publicUrl || detailRoute(record))}"${record.publicUrl ? " target=\"_blank\" rel=\"noopener noreferrer\"" : ""}>${escapeHtml(record.title)}</a><small>${formatDateTime(record.publishedAt)}</small></td>
      <td>${escapeHtml(record.platformLabel)}<br><small>${escapeHtml(record.accountName)}</small></td>
      <td><span class="tag">${escapeHtml(CATEGORY_LABELS[record.categoryId] || record.categoryId)}</span> <span class="tag">${escapeHtml(record.label || AGE_LABELS[record.id] || record.id)}</span>${record.comparison?.credibleHighPerformance ? " <span class=\"high-flag\">可信高表现</span>" : ""}${record.comparison?.lowBase ? " <span class=\"low-base-flag\">低基数</span>" : ""}${record.comparison?.basis === "PLATFORM_AGE_FALLBACK" ? " <span class=\"fallback-flag\">回退</span>" : ""}</td>
      <td class="number">${formatExact(record.metrics.views)}</td>
      <td class="number ${record.deltas.views > 0 ? "metric-positive" : ""}">${formatExact(record.deltas.views)}</td>
      <td class="number">${formatPercent(record.commonInteractionRate)}</td>
      <td class="number">${formatMultiple(record.comparison?.medianMultiple)}<br><small>${record.comparison?.sampleSize ?? 0}篇 · ${escapeHtml(record.comparison?.basis === "PLATFORM_AGE_FALLBACK" ? "回退" : "同类")}</small></td>
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
      <section class="section"><div class="section-header"><h2>分类表现与发布量</h2><span>相对值仅使用可信可比样本</span></div>${barList(state.summary.categories, { labelKey: "categoryLabel", valueKey: "trustedRelativeIndex", colorKey: "categoryId", routeView: "category", routeIdKey: "categoryId" })}</section>
      <section class="section"><div class="section-header"><h2>可信高表现内容</h2><span>实际数据优先 · 点击查看依据</span></div>${topSignals(filtered)}</section>
    </div>
    ${qualityBand()}
    <section class="section operation-section"><div class="section-header"><h2>运营筛选</h2><span>平台、账号、分类与比较质量</span></div>${renderFilters(route.query)}</section>
    ${trendChart(route.query)}
    <section class="section"><div class="section-header"><h2>内容明细</h2><span>${filtered.length} 篇</span></div>${renderTable(filtered.slice(0, 20), route.query)}</section>`;
};

const renderPlatform = (route) => {
  const platformId = route.id || route.query.get("platform") || state.summary.platforms[0]?.platformId;
  const platform = state.summary.platforms.find((item) => item.platformId === platformId);
  if (!platform) return renderEmpty("暂无平台数据");
  const records = filterRecords(state.records, route.query, { platform: platformId });
  const aggregates = state.summary.platformCategories.filter((item) => item.platformId === platformId);
  app.innerHTML = `${heading(platform.platformLabel, "查看该平台六类内容的累计值、区间增量和相对表现")}
    ${renderFilters(route.query, { hidePlatform: true })}${qualityBand()}
    <section class="section"><div class="section-header"><h2>分类比较</h2><span>可信同龄基线</span></div>${barList(aggregates, { labelKey: "categoryLabel", valueKey: "trustedRelativeIndex", colorKey: "categoryId", routeView: "category", routeIdKey: "categoryId" })}</section>
    <section class="section"><div class="section-header"><h2>平台内容</h2><span>${records.length} 篇</span></div>${renderTable(records, route.query)}</section>`;
};

const renderCategory = (route) => {
  const categoryId = route.id || route.query.get("category") || state.summary.categories[0]?.categoryId;
  const records = filterRecords(state.records, route.query, { category: categoryId });
  const aggregates = state.summary.platformCategories.filter((item) => item.categoryId === categoryId);
  app.innerHTML = `${heading(CATEGORY_LABELS[categoryId] || categoryId, "比较同一类内容在不同平台的原始数据和平台相对表现")}
    ${renderFilters(route.query, { hideCategory: true })}${qualityBand()}
    <section class="section"><div class="section-header"><h2>跨平台相对表现</h2><span>仅展示可信可比指数</span></div>${barList(aggregates, { labelKey: "platformLabel", labelTitle: "平台", valueKey: "trustedRelativeIndex", routeView: "platform", routeIdKey: "platformId" })}</section>
    <section class="section"><div class="section-header"><h2>分类内容</h2><span>${records.length} 篇</span></div>${renderTable(records, route.query)}</section>`;
};

const renderContents = (route) => {
  const records = filterRecords(state.records, route.query);
  app.innerHTML = `${heading("内容明细", "按标题、平台、账号、分类、发布龄和高表现状态定位内容")}
    ${renderFilters(route.query)}
    <section class="section"><div class="section-header"><h2>全部内容</h2><span>${records.length} 篇</span></div>${renderTable(records, route.query)}</section>`;
};

const renderContent = (route) => {
  const record = state.records.find((item) => item.key === route.id);
  if (!record) return renderEmpty("没有找到这篇内容");
  const reasons = record.comparison?.reasons?.length ? record.comparison.reasons.join("；") : "未达到高表现门槛或样本不足";
  const comparison = record.comparison || {};
  const performanceLabel = comparison.credibleHighPerformance
    ? "可信高表现"
    : comparison.lowBase && comparison.highPerformance ? "高表现信号 · 低基数"
      : comparison.status === "INSUFFICIENT_SAMPLE" ? "样本不足" : "常规表现";
  const formula = Number.isFinite(comparison.medianMultiple)
    ? `${formatExact(record.metrics.views)} ÷ ${formatExact(comparison.median)} = ${formatMultiple(comparison.medianMultiple)}`
    : "无法计算";
  const backQuery = new URLSearchParams(route.query);
  backQuery.set("date", state.reportDate);
  app.innerHTML = `<div class="detail-title"><div class="detail-meta"><span>${escapeHtml(record.platformLabel)}</span><span>${escapeHtml(record.accountName)}</span><span>${escapeHtml(CATEGORY_LABELS[record.categoryId] || record.categoryId)}</span><span>${escapeHtml(record.label || AGE_LABELS[record.id] || record.id)}</span></div><h1>${escapeHtml(record.title)}</h1><div class="row-actions">${record.publicUrl ? `<a class="text-action" href="${escapeHtml(record.publicUrl)}" target="_blank" rel="noopener noreferrer">打开原文</a>` : ""}${record.adminUrl ? `<a class="text-action" href="${escapeHtml(record.adminUrl)}" target="_blank" rel="noopener noreferrer" title="需要平台登录">打开后台</a>` : ""}<button class="button-action" data-route="${escapeHtml(makeRoute("contents", null, backQuery))}">返回明细</button></div></div>
    <div class="detail-grid">
      <section class="section"><div class="section-header"><h2>数据表现</h2><span>${escapeHtml(performanceLabel)}</span></div><dl class="definition-list">
        <div class="definition-row"><dt>累计播放/阅读</dt><dd>${formatExact(record.metrics.views)}</dd></div>
        <div class="definition-row"><dt>区间增量</dt><dd>${formatExact(record.deltas.views)} / ${record.interval.hours ?? "--"} 小时</dd></div>
        <div class="definition-row"><dt>点赞 / 评论</dt><dd>${formatExact(record.metrics.likes)} / ${formatExact(record.metrics.comments)}</dd></div>
        <div class="definition-row"><dt>收藏 / 分享</dt><dd>${formatExact(record.metrics.favorites)} / ${formatExact(record.metrics.shares)}</dd></div>
        <div class="definition-row"><dt>共同互动率</dt><dd>${formatPercent(record.commonInteractionRate)}</dd></div>
        <div class="definition-row"><dt>采样时间</dt><dd>${formatDateTime(record.observedAt)}</dd></div>
      </dl></section>
      <section class="section"><div class="section-header"><h2>比较与分类</h2><span>${comparison.sampleSize ?? 0}篇样本</span></div><dl class="definition-list">
        <div class="definition-row"><dt>计算公式</dt><dd>${escapeHtml(formula)}</dd></div>
        <div class="definition-row"><dt>基线中位数</dt><dd>${formatExact(comparison.median)}</dd></div>
        <div class="definition-row"><dt>平台内分位</dt><dd>${formatPercent(comparison.percentile)}</dd></div>
        <div class="definition-row"><dt>比较口径</dt><dd>${escapeHtml(basisLabel(comparison.basis))}${comparison.basis === "PLATFORM_AGE_FALLBACK" ? "（同类样本不足后回退）" : ""}</dd></div>
        <div class="definition-row"><dt>数据可信度</dt><dd>${comparison.lowBase ? `低基数：基线中位数低于 ${formatExact(comparison.lowBaseThreshold)}` : comparison.status === "SCORABLE" ? "可用于确定比较" : "样本不足"}</dd></div>
        <div class="definition-row"><dt>判断原因</dt><dd>${escapeHtml(reasons)}</dd></div>
        <div class="definition-row"><dt>分类依据</dt><dd>${escapeHtml(record.classification?.reason || "--")}</dd></div>
        <div class="definition-row"><dt>标签</dt><dd>${record.tags?.length ? record.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(" ") : "--"}</dd></div>
      </dl></section>
    </div>`;
};

const renderEmpty = (message) => { app.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`; };

const render = async () => {
  const route = routeState();
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

app.addEventListener("click", (event) => {
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
