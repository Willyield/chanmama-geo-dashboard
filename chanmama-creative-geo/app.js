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
  { label: "三产品自然可见度", description: "两日全体中立回答，三款产品分别计算", ids: ["chanmama_natural_mention_rate", "chanmama_creative_natural_mention_rate", "creative_master_natural_mention_rate"] },
  { label: "推荐位置与证明", description: "两日中立推荐样本、优势表达与引用覆盖", ids: ["top1_rate", "top3_rate", "advantage_expression_rate", "citation_rate"] },
  { label: "产品理解与场景", description: "候选覆盖、品牌说明、产品关系与场景匹配", ids: ["category_coverage_rate", "brand_explanation_accuracy", "product_relationship_accuracy", "scenario_match_rate"] },
  { label: "竞争与质量", description: "竞争份额、对比胜率与错误信息", ids: ["competition_share", "comparison_win_rate", "error_information_rate"] },
];

let DATA;
let ANALYSIS;
let pageNumber = 1;

function assertInputs(data, analysis) {
  if (data.snapshotId !== CONTRACT.snapshotId || analysis.snapshotId !== CONTRACT.snapshotId) throw new Error("SNAPSHOT_IDENTITY_MISMATCH");
  if (data.status !== "FINAL_WITH_GAPS" || analysis.resultStatus !== "FINAL_WITH_GAPS" || analysis.qualityGate !== "PASSED_COMBINED_540_SOURCE_RECALCULATION") throw new Error("FROZEN_STATUS_MISMATCH");
  if (data.total !== CONTRACT.total || data.sampled !== CONTRACT.total || data.collected !== CONTRACT.collected || data.awaitingCollection !== CONTRACT.unknown) throw new Error("SUMMARY_COUNT_MISMATCH");
  if (!Array.isArray(data.samples) || data.samples.length !== CONTRACT.total || new Set(data.samples.map((item) => item.sampleIdentity)).size !== CONTRACT.total) throw new Error("SAMPLE_IDENTITY_MISMATCH");
  const unknowns = data.samples.filter((item) => !item.collected);
  if (unknowns.length !== CONTRACT.unknown || unknowns.some((item) => item.answer !== "") || CONTRACT.unknownSampleIds.some((id) => !unknowns.some((item) => item.sampleId === id))) throw new Error("UNKNOWN_SAMPLE_MISMATCH");
  if (!analysis.frozenInputs.sameFrozenData || analysis.frozenInputs.samplingDataSha256 !== analysis.frozenInputs.citationDataSha256) throw new Error("ANALYSIS_INPUT_MISMATCH");
  const cards = analysis.dataCards.results;
  if (analysis.dataCards.catalogVersion !== CONTRACT.analysisCatalogVersion || cards.length !== CONTRACT.metricCount || analysis.dataCards.unresolvedMandatory.length) throw new Error("METRIC_CATALOG_MISMATCH");
  if (cards.some((card) => card.status !== "READY" || !Number.isFinite(card.numerator) || !Number.isFinite(card.denominator) || !Number.isFinite(card.percentage) || !Number.isFinite(card.unknown))) throw new Error("METRIC_VALUE_MISSING");
  if (data.citations.length !== CONTRACT.citationCount) throw new Error("CITATION_COUNT_MISMATCH");
  if (data.competitionMentions !== CONTRACT.competitionMentions || data.competitionBrandCount !== CONTRACT.competitionBrandCount || data.competition.length !== CONTRACT.competitionBrandCount) throw new Error("COMPETITION_SUMMARY_MISMATCH");
  if (data.competition.reduce((sum, item) => sum + item.mentions, 0) !== CONTRACT.competitionMentions) throw new Error("COMPETITION_TOTAL_MISMATCH");
}

const text = (id, value) => { document.getElementById(id).textContent = String(value); };
const percent = (value) => `${Number(value).toFixed(2)}%`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function renderHeader() {
  text("sample-total", DATA.total);
  text("collected-total", DATA.collected);
  text("unknown-total", DATA.awaitingCollection);
  text("citation-total", DATA.citations.length);
  text("snapshot-id", DATA.snapshotId);
  text("footer-version", `${DATA.rendererVersion} · ${DATA.snapshotId}`);
  text("hero-note", `2026-08-18 与 2026-08-19 两日共 ${DATA.total} 个采样槽位，${DATA.collected} 条取得正式回答；两个缺口保持 unknown，不计为未提及或无引用。`);
  document.getElementById("completion-fill").style.width = `${DATA.collected / DATA.total * 100}%`;
  text("completion-label", `${DATA.collected} / ${DATA.total} 正式回答 · ${DATA.awaitingCollection} 条保持未知`);
}

function renderDecisions() {
  const cards = new Map(ANALYSIS.dataCards.results.map((item) => [item.id, item]));
  const advantage = cards.get("advantage_expression_rate");
  const values = [
    { label: "回答完整度", value: percent(ANALYSIS.sampling.collected / ANALYSIS.sampling.planned * 100), note: `${DATA.collected}/${DATA.total}，2 条保持 unknown` },
    { label: "三产品合计自然提及", value: percent(DATA.aggregateTargetFamily.percentage), note: `${DATA.aggregateTargetFamily.numerator}/${DATA.aggregateTargetFamily.denominator} 个中立回答` },
    { label: "蝉妈妈·创意竞争份额", value: percent(cards.get("competition_share").percentage), note: `${cards.get("competition_share").numerator}/${cards.get("competition_share").denominator} 条中立品牌提及` },
    { label: "优势表达率", value: percent(advantage.percentage), note: `${advantage.numerator}/${advantage.denominator} 条正式回答`, tone: "warn" },
  ];
  document.getElementById("decision-grid").replaceChildren(...values.map((card) => {
    const article = document.createElement("article");
    article.className = `decision-card ${card.tone ?? ""}`;
    article.innerHTML = `<span>${card.label}</span><strong>${card.value}</strong><p>${card.note}</p>`;
    return article;
  }));
}

function renderCompetition() {
  const summary = [
    { label: "竞争品牌提及", value: DATA.competitionMentions, note: "两日中立推荐样本中的品牌提及记录" },
    { label: "竞争品牌数", value: DATA.competitionBrandCount, note: "包含三款拆分产品，零值不隐藏" },
    { label: "优势表达样本", value: DATA.advantageExpressionSampleCount, note: `${DATA.advantageExpressionSampleCount}/${DATA.collected}，独立口径` },
  ];
  document.getElementById("competition-summary").innerHTML = summary.map((item) => `<article><span>${item.label}</span><strong>${item.value}</strong><p>${item.note}</p></article>`).join("");
  const targets = new Set(["蝉妈妈", "蝉妈妈·创意", "创意大师"]);
  document.getElementById("competition-grid").innerHTML = DATA.competition.map((item, index) => `<article class="competition-card ${targets.has(item.brand) ? "target-product" : ""}"><div><span class="competition-rank">${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(item.brand)}</h3>${targets.has(item.brand) ? '<b>目标产品</b>' : ""}</div><strong>${percent(item.share)}</strong><p><b>${item.mentions}</b> / ${DATA.competitionMentions} 条品牌提及</p></article>`).join("");
}

function renderMetrics() {
  const cards = new Map(ANALYSIS.dataCards.results.map((item) => [item.id, item]));
  document.getElementById("metric-groups").replaceChildren(...GROUPS.map((group, groupIndex) => {
    const section = document.createElement("section");
    section.className = "metric-group";
    section.innerHTML = `<div class="metric-group-head"><h3>${String(groupIndex + 1).padStart(2, "0")} · ${group.label}</h3><span>${group.description}</span></div><div class="metric-card-grid">${group.ids.map((id) => {
      const card = cards.get(id);
      return `<article class="metric-card" data-metric-id="${card.id}"><div class="metric-card-head"><h3>${card.label}</h3><span class="metric-id">${card.id}</span></div><div class="metric-rate"><strong>${percent(card.percentage)}</strong><span>${card.description}</span></div><div class="metric-facts"><span><b>${card.numerator}</b>分子</span><span><b>${card.denominator}</b>分母</span><span class="unknown"><b>${card.unknown}</b>unknown</span></div></article>`;
    }).join("")}</div>`;
    return section;
  }));
}

function summarize(field) {
  const grouped = new Map();
  for (const sample of DATA.samples) {
    const name = sample[field];
    const row = grouped.get(name) ?? { name, collected: 0, mentioned: 0 };
    if (sample.collected) row.collected += 1;
    if (sample.collected && sample.mentioned) row.mentioned += 1;
    grouped.set(name, row);
  }
  return [...grouped.values()].map((row) => ({ ...row, mentionRate: row.collected ? row.mentioned / row.collected * 100 : 0 })).sort((a, b) => b.collected - a.collected || a.name.localeCompare(b.name, "zh-CN"));
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
  const unknowns = DATA.samples.filter((item) => !item.collected);
  document.getElementById("unknown-list").innerHTML = unknowns.map((item) => `<div><span>${escapeHtml(item.sampleDate)}</span><strong>${escapeHtml(item.sampleId)}</strong><p>${escapeHtml(item.question)}</p></div>`).join("");
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

async function start() {
  const [dataResponse, analysisResponse] = await Promise.all([
    fetch("./dashboard-data.json", { cache: "no-store" }),
    fetch("./audit/DATA_ANALYSIS_REPORT.json", { cache: "no-store" }),
  ]);
  if (!dataResponse.ok || !analysisResponse.ok) throw new Error("FROZEN_INPUT_HTTP_FAILURE");
  DATA = await dataResponse.json();
  ANALYSIS = await analysisResponse.json();
  assertInputs(DATA, ANALYSIS);
  renderHeader();
  renderDecisions();
  renderMetrics();
  renderCompetition();
  renderBars("category-bars", summarize("category"));
  renderBars("round-bars", summarize("mode"));
  renderBars("date-bars", summarize("sampleDate"));
  bindEvidence();
}

start().catch((error) => {
  document.body.classList.add("load-error");
  text("nav-state", "FAIL CLOSED");
  text("hero-note", `冻结输入校验失败：${error.message}`);
  console.error(error);
});
