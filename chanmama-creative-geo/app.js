const CONTRACT = Object.freeze({
  snapshotId: "CREATIVE-FINAL_WITH_GAPS-540-538-R5",
  total: 540,
  collected: 538,
  unknown: 2,
  unknownSampleIds: ["CMCR-CMP-20260819-C2-Q0087", "CMCR-S-20260819-C2-Q0092"],
  citationCount: 7042,
  analysisCatalogVersion: "GEO-DASHBOARD-CARDS-20260820-R1",
  metricCount: 14,
  competitionMentions: 209,
  competitionBrandCount: 16,
});

const GROUPS = [
  { label: "品牌表现", description: "三款产品独立计算自然提及率", ids: ["chanmama_natural_mention_rate", "chanmama_creative_natural_mention_rate", "creative_master_natural_mention_rate"] },
  { label: "推荐与证据", description: "推荐位置、优势表达与引用覆盖", ids: ["top1_rate", "top3_rate", "advantage_expression_rate", "citation_rate"] },
  { label: "认知质量", description: "解释、关系和业务场景是否准确", ids: ["category_coverage_rate", "brand_explanation_accuracy", "product_relationship_accuracy", "scenario_match_rate"] },
  { label: "竞争与复核", description: "竞争份额、对比结论与错误信息", ids: ["competition_share", "comparison_win_rate", "error_information_rate"] },
];

let DATA;
let SUMMARY;
let ANALYSIS;
let pageNumber = 1;

function assertSummary(summary, analysis) {
  if (summary.snapshotId !== CONTRACT.snapshotId || analysis.snapshotId !== CONTRACT.snapshotId) throw new Error("SNAPSHOT_IDENTITY_MISMATCH");
  if (summary.status !== "FINAL_WITH_GAPS" || analysis.resultStatus !== "FINAL_WITH_GAPS" || analysis.qualityGate !== "PASSED_COMBINED_540_SOURCE_RECALCULATION") throw new Error("FROZEN_STATUS_MISMATCH");
  if (summary.total !== CONTRACT.total || summary.sampled !== CONTRACT.total || summary.collected !== CONTRACT.collected || summary.awaitingCollection !== CONTRACT.unknown) throw new Error("SUMMARY_COUNT_MISMATCH");
  if (summary.citationCount !== CONTRACT.citationCount || summary.competitionMentions !== CONTRACT.competitionMentions || summary.competitionBrandCount !== CONTRACT.competitionBrandCount || summary.competition.length !== CONTRACT.competitionBrandCount) throw new Error("SUMMARY_RECONCILIATION_MISMATCH");
  if (summary.unknowns.length !== CONTRACT.unknown || CONTRACT.unknownSampleIds.some((id) => !summary.unknowns.some((item) => item.sampleId === id))) throw new Error("SUMMARY_UNKNOWN_MISMATCH");
  const cards = analysis.dataCards.results;
  if (analysis.dataCards.catalogVersion !== CONTRACT.analysisCatalogVersion || cards.length !== CONTRACT.metricCount || analysis.dataCards.unresolvedMandatory.length) throw new Error("METRIC_CATALOG_MISMATCH");
  if (cards.some((card) => card.status !== "READY" || !Number.isFinite(card.numerator) || !Number.isFinite(card.denominator) || !Number.isFinite(card.percentage) || !Number.isFinite(card.unknown))) throw new Error("METRIC_VALUE_MISSING");
}

function assertFullData(data) {
  if (data.snapshotId !== CONTRACT.snapshotId || data.status !== "FINAL_WITH_GAPS") throw new Error("FULL_DATA_IDENTITY_MISMATCH");
  if (data.total !== CONTRACT.total || data.sampled !== CONTRACT.total || data.collected !== CONTRACT.collected || data.awaitingCollection !== CONTRACT.unknown) throw new Error("FULL_DATA_COUNT_MISMATCH");
  if (!Array.isArray(data.samples) || data.samples.length !== CONTRACT.total || new Set(data.samples.map((item) => item.sampleIdentity)).size !== CONTRACT.total) throw new Error("SAMPLE_IDENTITY_MISMATCH");
  const unknowns = data.samples.filter((item) => !item.collected);
  if (unknowns.length !== CONTRACT.unknown || unknowns.some((item) => item.answer !== "") || CONTRACT.unknownSampleIds.some((id) => !unknowns.some((item) => item.sampleId === id))) throw new Error("UNKNOWN_SAMPLE_MISMATCH");
  if (data.citations.length !== CONTRACT.citationCount) throw new Error("CITATION_COUNT_MISMATCH");
  if (data.competitionMentions !== CONTRACT.competitionMentions || data.competitionBrandCount !== CONTRACT.competitionBrandCount || data.competition.length !== CONTRACT.competitionBrandCount) throw new Error("COMPETITION_SUMMARY_MISMATCH");
  if (data.competition.reduce((sum, item) => sum + item.mentions, 0) !== CONTRACT.competitionMentions) throw new Error("COMPETITION_TOTAL_MISMATCH");
}

const text = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = String(value); };
const percent = (value) => `${Number(value).toFixed(2)}%`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function renderHeader() {
  text("sample-total", SUMMARY.total);
  text("collected-total", SUMMARY.collected);
  text("unknown-total", SUMMARY.awaitingCollection);
  text("citation-total", SUMMARY.citationCount);
  text("snapshot-id", SUMMARY.snapshotId);
  text("footer-version", `${SUMMARY.rendererVersion} · ${SUMMARY.snapshotId}`);
  text("hero-note", `2026-08-18 与 2026-08-19 两日共 ${SUMMARY.total} 个采样槽位，${SUMMARY.collected} 条取得正式回答；两个缺口保持 unknown，不计为未提及或无引用。`);
}

function renderCompetition() {
  const targets = new Set(["蝉妈妈", "蝉妈妈·创意", "创意大师"]);
  const maxMentions = Math.max(...SUMMARY.competition.map((item) => item.mentions), 1);
  document.getElementById("competition-grid").innerHTML = SUMMARY.competition.map((item) => `<div class="competition-row ${targets.has(item.brand) ? "target" : ""}" data-competition-brand="${escapeHtml(item.brand)}"><span class="brand" title="${escapeHtml(item.brand)}">${escapeHtml(item.brand)}</span><span class="track"><i class="fill" style="width:${item.mentions / maxMentions * 100}%"></i></span><span class="number">${item.mentions} · ${percent(item.share)}</span></div>`).join("");
}

function renderMetrics() {
  const cards = new Map(ANALYSIS.dataCards.results.map((item) => [item.id, item]));
  document.getElementById("metric-groups").replaceChildren(...GROUPS.map((group) => {
    const [primaryId, ...rowIds] = group.ids;
    const primary = cards.get(primaryId);
    const article = document.createElement("article");
    article.className = "decision-card";
    article.innerHTML = `<div class="decision-head"><div class="decision-title"><strong>${group.label}</strong><span>${group.description}</span></div><span class="metric-state">冻结结果</span></div><div class="decision-primary" data-metric-id="${primary.id}"><span class="value">${percent(primary.percentage)}</span><span class="caption">${primary.label} · ${primary.numerator}/${primary.denominator} · unknown ${primary.unknown}</span></div><div class="decision-rows">${rowIds.map((id) => {
      const card = cards.get(id);
      return `<div class="decision-row" data-metric-id="${card.id}"><div><span>${card.label}</span><small>${card.numerator}/${card.denominator} · unknown ${card.unknown}</small></div><strong>${percent(card.percentage)}</strong></div>`;
    }).join("")}</div>`;
    return article;
  }));
}

function renderBars(id, rows) {
  const max = Math.max(1, ...rows.map((row) => row.collected));
  document.getElementById(id).innerHTML = rows.map((row) => `<div class="bar-row"><span class="bar-label" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span><span class="bar-track"><i style="width:${row.collected / max * 100}%"></i></span><span class="bar-value">${row.mentioned}/${row.collected} · ${percent(row.mentionRate)}</span></div>`).join("");
}

function optionValues(id, values) {
  const select = document.getElementById(id);
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function filteredSamples() {
  const date = document.getElementById("date-filter").value;
  const category = document.getElementById("category-filter").value;
  const round = document.getElementById("round-filter").value;
  const status = document.getElementById("status-filter").value;
  const query = document.getElementById("search-filter").value.trim().toLocaleLowerCase("zh-CN");
  return DATA.samples.filter((sample) => (date === "all" || sample.sampleDate === date) && (category === "all" || sample.category === category) && (round === "all" || sample.mode === round) && (status === "all" || (status === "collected" ? sample.collected : !sample.collected)) && (!query || [sample.sampleIdentity, sample.sampleId, sample.question, sample.answer].join(" ").toLocaleLowerCase("zh-CN").includes(query)));
}

function renderSamples() {
  const rows = filteredSamples();
  const pageSize = Number(document.getElementById("page-size").value);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  pageNumber = Math.min(pageNumber, pages);
  const start = (pageNumber - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  text("visible-count", `显示 ${rows.length} / ${DATA.samples.length} 条`);
  text("row-range", rows.length ? `第 ${start + 1}-${Math.min(start + pageSize, rows.length)} 条` : "无匹配结果");
  text("page-label", `${pageNumber} / ${pages}`);
  document.getElementById("page-prev").disabled = pageNumber <= 1;
  document.getElementById("page-next").disabled = pageNumber >= pages;
  document.getElementById("sample-body").innerHTML = pageRows.map((sample) => `<tr><td><strong>${escapeHtml(sample.sampleDate)}</strong><br>${escapeHtml(sample.sampleId)}</td><td class="question-cell"><strong>${escapeHtml(sample.question)}</strong>${sample.answer ? `<details class="answer-detail"><summary>查看正式回答</summary><p>${escapeHtml(sample.answer)}</p></details>` : ""}</td><td>${escapeHtml(sample.category)}<br>${escapeHtml(sample.mode)}</td><td><span class="sample-status ${sample.collected ? "" : "unknown"}">${sample.collected ? "正式回答" : "保持未知"}</span></td><td>${sample.collected ? (sample.mentioned ? "提及" : "未提及") : "-"}<br>${sample.citationCount} 条引用</td></tr>`).join("") || '<tr><td colspan="5">当前筛选没有样本</td></tr>';
}

function bindEvidence() {
  optionValues("date-filter", DATA.samplingDates);
  optionValues("category-filter", DATA.filters.categories);
  optionValues("round-filter", DATA.filters.modes);
  for (const id of ["date-filter", "category-filter", "round-filter", "status-filter", "search-filter"]) document.getElementById(id).addEventListener("input", () => { pageNumber = 1; renderSamples(); });
  document.getElementById("page-size").addEventListener("change", () => { pageNumber = 1; renderSamples(); });
  document.getElementById("page-prev").addEventListener("click", () => { pageNumber -= 1; renderSamples(); });
  document.getElementById("page-next").addEventListener("click", () => { pageNumber += 1; renderSamples(); });
  document.getElementById("reset-filters").addEventListener("click", () => {
    for (const id of ["date-filter", "category-filter", "round-filter", "status-filter"]) document.getElementById(id).value = "all";
    document.getElementById("search-filter").value = "";
    pageNumber = 1;
    renderSamples();
  });
  renderSamples();
}

function renderUnknowns() {
  document.getElementById("unknown-list").innerHTML = SUMMARY.unknowns.map((item) => `<div class="unknown-item"><span>${escapeHtml(item.sampleDate)} · 保持 unknown</span><strong>${escapeHtml(item.sampleId)}</strong><p>${escapeHtml(item.question)}</p></div>`).join("");
}

function setSampleControlsDisabled(disabled) {
  for (const id of ["date-filter", "category-filter", "round-filter", "status-filter", "search-filter", "reset-filters", "page-prev", "page-next", "page-size"]) document.getElementById(id).disabled = disabled;
}

async function loadSamples() {
  const response = await fetch("./dashboard-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("FULL_DATA_HTTP_FAILURE");
  DATA = await response.json();
  assertFullData(DATA);
  bindEvidence();
  setSampleControlsDisabled(false);
  document.body.classList.add("samples-ready");
}

async function start() {
  const [summaryResponse, analysisResponse] = await Promise.all([
    fetch("./dashboard-summary.json", { cache: "no-store" }),
    fetch("./audit/DATA_ANALYSIS_REPORT.json", { cache: "no-store" }),
  ]);
  if (!summaryResponse.ok || !analysisResponse.ok) throw new Error("SUMMARY_INPUT_HTTP_FAILURE");
  SUMMARY = await summaryResponse.json();
  ANALYSIS = await analysisResponse.json();
  assertSummary(SUMMARY, ANALYSIS);
  renderHeader();
  renderMetrics();
  renderCompetition();
  renderBars("category-bars", SUMMARY.distributions.category);
  renderBars("round-bars", SUMMARY.distributions.mode);
  renderBars("date-bars", SUMMARY.distributions.sampleDate);
  renderUnknowns();
  text("visible-count", `正在加载 ${SUMMARY.total} 条样本明细…`);
  setSampleControlsDisabled(true);
  requestAnimationFrame(() => loadSamples().catch((error) => {
    console.error(error);
    text("visible-count", "样本明细加载失败，请刷新重试");
    document.body.classList.add("samples-load-error");
  }));
}

start().catch((error) => {
  console.error(error);
  document.body.classList.add("load-error");
  const badge = document.querySelector(".checkpoint-badge");
  if (badge) badge.textContent = "FAIL CLOSED";
  text("hero-note", `冻结输入校验失败：${error.message}`);
});
