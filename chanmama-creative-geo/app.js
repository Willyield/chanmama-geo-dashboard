const EXPECTED = Object.freeze({
  dashboardVersion: "CMCR_CREATIVE_SAMPLING_DASHBOARD_20260819_R3",
  runId: "cmcr-20260818-recapture-20260819-r1",
  rawManifestSha256: "E9503B8F53FDE87305DE6C7D75E29E32EBCBFAB9664251E74B24FE68986534B4",
  sampleCount: 270,
  formalAnswerCount: 269,
  recoverableUnknown: 1,
  pendingSampleId: "CMCR-CMP-20260819-C2-Q0087",
  businessMetricCount: 10,
});

let DATA;

function assertData(data) {
  if (data.dashboardVersion !== EXPECTED.dashboardVersion || data.runId !== EXPECTED.runId) throw new Error("DASHBOARD_IDENTITY_MISMATCH");
  if (data.status !== "FINAL_FROZEN_PARTIAL_WITH_RECOVERABLE_UNKNOWNS" || data.final !== true) throw new Error("FINAL_STATUS_MISMATCH");
  if (data.traceability.rawManifestSha256 !== EXPECTED.rawManifestSha256) throw new Error("RAW_MANIFEST_HASH_MISMATCH");
  if (data.summary.sampleCount !== EXPECTED.sampleCount || data.summary.formalAnswerCount !== EXPECTED.formalAnswerCount || data.summary.recoverableUnknown !== EXPECTED.recoverableUnknown) throw new Error("SUMMARY_COUNT_MISMATCH");
  if (data.summary.formalAnswerCount + data.summary.recoverableUnknown !== data.summary.sampleCount) throw new Error("UNKNOWN_ACCOUNTING_MISMATCH");
  const metrics = data.metricGroups.flatMap((group) => group.metrics);
  const metricIds = metrics.map((metric) => metric.id);
  if (metrics.length !== EXPECTED.businessMetricCount || new Set(metricIds).size !== metrics.length || metricIds.includes("citation_rate")) throw new Error("SAMPLING_METRIC_MODEL_MISMATCH");
  if (metrics.some((metric) => !Number.isFinite(metric.numerator) || !Number.isFinite(metric.denominator) || !Number.isFinite(metric.unknown) || !Number.isFinite(metric.percentage))) throw new Error("METRIC_VALUE_MISSING");
  if (!Array.isArray(data.samples) || data.samples.length !== EXPECTED.sampleCount) throw new Error("SAMPLE_COUNT_MISMATCH");
  const unknowns = data.samples.filter((sample) => sample.status === "recoverable_unknown");
  if (unknowns.length !== 1 || unknowns[0].sampleId !== EXPECTED.pendingSampleId || unknowns[0].answerExcerpt !== "") throw new Error("RECOVERABLE_UNKNOWN_MISMATCH");
  if (data.samples.some((sample) => Object.hasOwn(sample, "citationCount") || Object.hasOwn(sample, "citationStatus"))) throw new Error("CITATION_DATA_MODEL_LEAK");
  return data;
}

function text(id, value) { document.getElementById(id).textContent = String(value); }
function percent(value) { return `${Number(value).toFixed(2)}%`; }

function renderHeader(data) {
  text("nav-state", "FINAL FROZEN · PARTIAL UNKNOWN");
  text("run-id", data.runId);
  text("sample-total", data.summary.sampleCount);
  text("formal-total", data.summary.formalAnswerCount);
  text("unknown-total", data.summary.recoverableUnknown);
  text("submission-total", data.summary.totalExternalSubmissions);
  text("points-total", data.summary.pointsConsumed.toFixed(1));
  const coverage = data.summary.formalAnswerCount / data.summary.sampleCount * 100;
  document.getElementById("completion-fill").style.width = `${coverage}%`;
  text("completion-label", `${data.summary.formalAnswerCount} / ${data.summary.sampleCount} 正式回答 · ${data.summary.recoverableUnknown} 条保持未知`);
  text("hero-note", `270 个非替换冻结样本已完成语义审计。恢复提交 ${data.summary.recoverySubmitted} 次，其中 ${data.summary.recoveryFormalAnswers} 次取得正式回答；唯一未知保持待恢复，不参与任何“无/0”判断。`);
  text("footer-version", data.dashboardVersion);
}

function renderDecisions(data) {
  const target = data.competition.find((item) => item.brand === "蝉妈妈·创意");
  const mention = data.metricGroups.flatMap((group) => group.metrics).find((item) => item.id === "ai_mention_rate");
  const cards = [
    { tone: "good", label: "正式回答覆盖", value: `${data.summary.formalAnswerCount}/${data.summary.sampleCount}`, note: `${percent(data.summary.formalAnswerCount / data.summary.sampleCount * 100)}，剩余 1 条可恢复未知` },
    { tone: "focus", label: "AI 提及率", value: percent(mention.percentage), note: `${mention.numerator}/${mention.denominator}，未知 ${mention.unknown}` },
    { tone: "risk", label: "目标缺席但竞品出现", value: data.diagnostics.targetAbsentCompetitorPresent, note: "优先补强品牌与场景关联表达" },
    { tone: "unknown", label: "竞争提及份额", value: percent(target.share), note: `${target.mentions} 次目标品牌提及，按适用推荐样本统计` },
  ];
  document.getElementById("decision-grid").replaceChildren(...cards.map((card) => {
    const article = document.createElement("article");
    article.className = `decision-card ${card.tone}`;
    article.innerHTML = `<span>${card.label}</span><strong>${card.value}</strong><p>${card.note}</p>`;
    return article;
  }));
}

function renderMetrics(groups) {
  const root = document.getElementById("metric-groups");
  root.replaceChildren(...groups.map((group, groupIndex) => {
    const section = document.createElement("section");
    section.className = "metric-group";
    const cards = group.metrics.map((metric) => `
      <article class="metric-card">
        <div class="metric-card-head"><h3>${metric.label}</h3><span class="metric-id">${metric.id}</span></div>
        <div class="metric-rate"><strong>${percent(metric.percentage)}</strong><span>${metric.scope}</span></div>
        <div class="metric-facts"><span><b>${metric.numerator}</b>分子</span><span><b>${metric.denominator}</b>分母</span><span class="unknown"><b>${metric.unknown}</b>未知</span></div>
      </article>`).join("");
    section.innerHTML = `<div class="metric-group-head"><h3>${String(groupIndex + 1).padStart(2, "0")} · ${group.label}</h3><span>${group.description}</span></div><div class="metric-card-grid">${cards}</div>`;
    return section;
  }));
}

function renderCompetition(data) {
  const totalMentions = data.competition.reduce((sum, item) => sum + item.mentions, 0);
  const maxMentions = Math.max(...data.competition.map((item) => item.mentions));
  document.getElementById("competition-summary").innerHTML = `
    <span><b>${totalMentions}</b>已识别品牌提及</span>
    <span><b>${data.competition.length}</b>竞争品牌</span>
    <span><b>${data.diagnostics.advantageExpressionCount}</b>优势表达样本</span>`;
  document.getElementById("competition-grid").replaceChildren(...data.competition.map((item, index) => {
    const article = document.createElement("article");
    article.className = `competitor-card${item.brand === "蝉妈妈·创意" ? " target" : ""}`;
    article.innerHTML = `
      <div class="competitor-head"><strong>${item.brand}</strong><span class="competitor-rank">RANK ${String(index + 1).padStart(2, "0")}</span></div>
      <div class="competitor-share"><strong>${percent(item.share)}</strong><span>${item.mentions} 次提及</span></div>
      <div class="share-track" aria-label="相对最高提及量 ${percent(item.mentions / maxMentions * 100)}"><i style="width:${item.mentions / maxMentions * 100}%"></i></div>`;
    return article;
  }));
}

function options(id, values) {
  const select = document.getElementById(id);
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function sampleMatches(sample) {
  const pool = document.getElementById("pool-filter").value;
  const round = document.getElementById("round-filter").value;
  const status = document.getElementById("status-filter").value;
  const query = document.getElementById("search-filter").value.trim().toLocaleLowerCase("zh-CN");
  const haystack = [sample.sampleId, sample.questionId, sample.question, ...sample.brands, ...sample.featureGroups].join(" ").toLocaleLowerCase("zh-CN");
  return (pool === "all" || sample.pool === pool) && (round === "all" || sample.round === round) && (status === "all" || sample.status === status) && (!query || haystack.includes(query));
}

function renderSamples() {
  const rows = DATA.samples.filter(sampleMatches);
  text("visible-count", `显示 ${rows.length} / ${DATA.samples.length} 条`);
  const body = document.getElementById("sample-body");
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">当前筛选没有匹配样本</td></tr>';
    return;
  }
  body.replaceChildren(...rows.map((sample) => {
    const row = document.createElement("tr");
    const evidence = [...sample.featureGroups, ...sample.auditDecisions.map((item) => `${item.metricId}:${item.decision}`)].slice(0, 6);
    row.innerHTML = `
      <td>${sample.sampleId}</td>
      <td><strong>${sample.question}</strong></td>
      <td><div class="sample-meta"><span>${sample.pool}</span><span>${sample.category}</span><span>${sample.round}</span></div></td>
      <td><span class="sample-status ${sample.status === "recoverable_unknown" ? "unknown" : ""}">${sample.status === "formal" ? "正式回答" : "可恢复未知"}</span></td>
      <td><div class="evidence-list">${evidence.length ? evidence.map((item) => `<span>${item}</span>`).join("") : "<span>等待正式对话文本</span>"}</div></td>`;
    return row;
  }));
}

function bindEvidence(data) {
  options("pool-filter", [...new Set(data.samples.map((item) => item.pool))].sort());
  options("round-filter", [...new Set(data.samples.map((item) => item.round))].sort());
  for (const id of ["pool-filter", "round-filter", "status-filter", "search-filter"]) document.getElementById(id).addEventListener("input", renderSamples);
  document.getElementById("reset-filters").addEventListener("click", () => {
    document.getElementById("pool-filter").value = "all";
    document.getElementById("round-filter").value = "all";
    document.getElementById("status-filter").value = "all";
    document.getElementById("search-filter").value = "";
    renderSamples();
  });
  const unknown = data.samples.find((item) => item.status === "recoverable_unknown");
  text("unknown-sample-id", unknown.sampleId);
  text("unknown-question", unknown.question);
  renderSamples();
}

async function start() {
  const response = await fetch("./dashboard-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`DATA_HTTP_${response.status}`);
  DATA = assertData(await response.json());
  renderHeader(DATA);
  renderDecisions(DATA);
  renderMetrics(DATA.metricGroups);
  renderCompetition(DATA);
  bindEvidence(DATA);
}

start().catch((error) => {
  document.body.classList.add("load-error");
  text("nav-state", "FAIL CLOSED");
  text("hero-note", `数据合同校验失败：${error.message}`);
  console.error(error);
});
