const EXPECTED = Object.freeze({
  schemaVersion: 1,
  dashboardVersion: "CMCR_DASHBOARD_LOCAL_20260818_R5",
  runId: "cmcr-20260818-19-r1",
  metricCount: 11,
  plannedSlots: 540,
  currentDay: "2026-08-18",
  currentDayAuthorizedSlots: 270,
  originalSubmissions: 270,
  recoverySubmissions: 62,
  externalSubmissions: 332,
  pointsConsumed: 265.6,
  rawResponses: 270,
  rawExpected: 270,
  submittedResultsPending: 0,
  resultPending: 0,
  invalidRawPending: 0,
  invalidatedRawResponses: 30,
  resultAnswerNotFound: 0,
  readbackSupplements: 117,
});

const metricNotes = Object.freeze({
  ai_mention_rate: "被提及 / 有效回答",
  top1_recommendation_rate: "首位推荐 / 推荐回答",
  top3_recommendation_rate: "前三推荐 / 推荐回答",
  category_coverage_rate: "覆盖品类 / 目标品类",
  brand_explanation_accuracy: "准确解释 / 可判断回答",
  product_relationship_accuracy: "关系正确 / 可判断回答",
  scenario_match_rate: "场景匹配 / 场景回答",
  competition_share: "品牌占位 / 竞品占位",
  comparison_win_rate: "优势回答 / 对比回答",
  citation_rate: "含来源 / 有效回答",
  error_information_rate: "错误信息 / 可判断回答",
});

function assertProgress(data) {
  if (data.schemaVersion !== EXPECTED.schemaVersion || data.dashboardVersion !== EXPECTED.dashboardVersion) {
    throw new Error("DASHBOARD_VERSION_MISMATCH");
  }
  if (data.runId !== EXPECTED.runId || data.status !== "DAY_ONE_PARTIAL_READY" || data.final !== false) {
    throw new Error("NON_FINAL_RUN_CONTRACT_MISMATCH");
  }
  if (
    data.rawManifest?.frozen !== false ||
    data.rawManifest.status !== "INCREMENTAL" ||
    data.rawManifest.sampleCount !== 270 ||
    !/^[0-9A-F]{64}$/.test(data.rawManifest.sha256 || "")
  ) {
    throw new Error("DAY_ONE_MANIFEST_REFERENCE_INVALID");
  }
  if (
    data.progress?.plannedSlots !== EXPECTED.plannedSlots ||
    data.progress.currentDay !== EXPECTED.currentDay ||
    data.progress.currentDayAuthorizedSlots !== EXPECTED.currentDayAuthorizedSlots ||
    data.progress.originalSubmissions !== EXPECTED.originalSubmissions ||
    data.progress.recoverySubmissions !== EXPECTED.recoverySubmissions ||
    data.progress.externalSubmissions !== EXPECTED.externalSubmissions ||
    data.progress.pointsConsumed !== EXPECTED.pointsConsumed ||
    data.progress.rawResponses !== EXPECTED.rawResponses ||
    data.progress.rawExpected !== EXPECTED.rawExpected ||
    data.progress.submittedResultsPending !== EXPECTED.submittedResultsPending ||
    data.progress.pageStates?.RESULT_PENDING !== EXPECTED.resultPending ||
    data.progress.pageStates?.INVALID_RAW_CURRENT_RECORD_PENDING !== EXPECTED.invalidRawPending ||
    data.progress.pageStates?.RESULT_ANSWER_NOT_FOUND !== EXPECTED.resultAnswerNotFound ||
    data.progress.pageStates.RESULT_PENDING + data.progress.pageStates.INVALID_RAW_CURRENT_RECORD_PENDING + data.progress.pageStates.RESULT_ANSWER_NOT_FOUND !== data.progress.submittedResultsPending ||
    data.progress.invalidatedRawResponses !== EXPECTED.invalidatedRawResponses ||
    data.progress.readbackSupplements !== EXPECTED.readbackSupplements ||
    data.progress.recoveryResponses !== EXPECTED.recoverySubmissions ||
    data.progress.citationPending !== 6 ||
    data.progress.failed !== 0 ||
    data.progress.uncertain !== 0 ||
    data.progress.nextDayAuthorized !== false ||
    data.progress.percentage !== 50 ||
    data.progress.dayOneComplete !== true ||
    data.progress.progressOnly !== false
  ) {
    throw new Error("PROGRESS_CONTRACT_MISMATCH");
  }
  if (!Array.isArray(data.metrics) || data.metrics.length !== EXPECTED.metricCount) {
    throw new Error("METRIC_CONTRACT_MISMATCH");
  }
  const publishedMetricIds = new Set(["ai_mention_rate", "citation_rate"]);
  if (data.metrics.some((metric) => publishedMetricIds.has(metric.id)
    ? [metric.numerator, metric.denominator, metric.percentage, metric.unknown].some((value) => value === null)
    : [metric.numerator, metric.denominator, metric.percentage, metric.unknown].some((value) => value !== null))) {
    throw new Error("DAY_ONE_METRIC_CONTRACT_MISMATCH");
  }
  if (data.blocker !== "DAY_TWO_NOT_AUTHORIZED" || data.externalWrites !== 0 || data.details.length !== 0) {
    throw new Error("FAIL_CLOSED_GATE_MISMATCH");
  }
  return data;
}

function text(id, value) {
  document.getElementById(id).textContent = String(value);
}

function renderManagement(items) {
  const root = document.getElementById("management-grid");
  root.replaceChildren(...items.map((item, index) => {
    const article = document.createElement("article");
    article.className = "management-card";
    article.innerHTML = `
      <div class="management-label"><span>${item.label}</span><span class="management-code">M0${index + 1}</span></div>
      <strong class="management-value">${item.value ?? "--"}</strong>
      <div class="management-state"><span>${item.status === "DAY_ONE_COMPLETE" ? "DAY ONE COMPLETE" : "WAITING FOR REVIEW"}</span><span>${item.value ? "已核验" : "未计算"}</span></div>`;
    return article;
  }));
}

function renderMetrics(items) {
  const root = document.getElementById("metrics-grid");
  root.replaceChildren(...items.map((item, index) => {
    const article = document.createElement("article");
    article.className = "metric-card";
    article.innerHTML = `
      <h3>${String(index + 1).padStart(2, "0")} · ${item.label}</h3>
      <div class="metric-value"><strong>${item.percentage === null ? "--" : `${item.percentage.toFixed(2)}%`}</strong><span>${metricNotes[item.id] ?? "待冻结清单"}</span></div>`;
    return article;
  }));
}

function renderRounds(items) {
  const root = document.getElementById("round-track");
  root.replaceChildren(...items.map((item) => {
    const article = document.createElement("article");
    article.className = "round-item";
    article.innerHTML = `<strong class="round-code">${item.code}</strong><span class="round-label">${item.label}</span><span class="round-status">首日 ${item.count} 条完成</span>`;
    return article;
  }));
}

function renderTruth(data) {
  text("truth-total", `${data.documented}/${data.factCount}`);
  const summary = document.getElementById("truth-summary");
  summary.innerHTML = `<span class="truth-chip">${data.documented} 条已记录</span><span class="truth-chip unknown">${data.unknown} 条未知</span>`;
  const root = document.getElementById("truth-list");
  root.replaceChildren(...data.coverage.map((item) => {
    const row = document.createElement("div");
    row.className = `truth-row${item.status === "unknown" ? " unknown" : ""}`;
    row.innerHTML = `<span>${item.label}</span><span>${item.status === "unknown" ? "待确认" : "已记录"}</span>`;
    return row;
  }));
}

function renderCitations(data) {
  const entries = [
    ["已捕获", data.captured],
    ["确认无来源", data.confirmedNone],
    ["待确认", data.captureFailed],
  ];
  const root = document.getElementById("citation-counters");
  root.replaceChildren(...entries.map(([label, value]) => {
    const item = document.createElement("div");
    item.className = "citation-counter";
    item.innerHTML = `<span>${label}</span><strong>${value ?? "--"}</strong>`;
    return item;
  }));
  text("citation-state", `首日核验 ${data.observedSamples} 条`);
  const summary = document.querySelector(".citation-empty");
  const heading = document.createElement("strong");
  heading.textContent = `${data.uniqueCitations} 条引用 · ${data.uniqueDomains} 个域名`;
  const list = document.createElement("div");
  list.className = "citation-source-list";
  for (const source of data.sources) {
    const row = document.createElement("span");
    const domain = document.createElement("b");
    domain.textContent = source.domain;
    const count = document.createElement("small");
    count.textContent = String(source.count);
    row.append(domain, count);
    list.append(row);
  }
  summary.replaceChildren(heading, list);
}

function renderDetails(details) {
  text("detail-count", `${details.length} 条`);
  const body = document.getElementById("detail-body");
  if (details.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="5">冻结清单到达前不展示样本行</td></tr>';
    return;
  }
  body.replaceChildren(...details.map((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${item.sampleId}</td><td>${item.questionId}</td><td>${item.sampleDate}</td><td>${item.round}</td><td>${item.sourceCaptureStatus}</td>`;
    return row;
  }));
}

function bindFilters() {
  const view = document.getElementById("view-filter");
  view.addEventListener("change", () => {
    const target = view.value === "evidence" ? "citation-section" : "management-heading";
    document.getElementById(target).scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function syncHashTarget() {
  if (!location.hash) return;
  const target = document.getElementById(location.hash.slice(1));
  if (!target) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  });
}

async function start() {
  const response = await fetch("./dashboard-progress.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`DATA_HTTP_${response.status}`);
  const data = assertProgress(await response.json());
  text("header-status", "首日批次 · 有效结果完整");
  text("status-heading", "08 月 18 日采样已回收完成");
  text("status-note", `首日有效回答 ${data.progress.rawResponses}/${data.progress.rawExpected}；原提交 ${data.progress.originalSubmissions} 次，恢复提交 ${data.progress.recoverySubmissions} 次，共消耗 ${data.progress.pointsConsumed.toFixed(1)} 点。引用明细仍有 ${data.progress.citationPending} 条待确认，未计入引用率分母。`);
  text("run-id", data.runId);
  text("progress-percent", `${data.progress.percentage.toFixed(2)}%`);
  text("progress-submissions", `${data.progress.originalSubmissions}+${data.progress.recoverySubmissions}`);
  text("progress-raw", `${data.progress.rawResponses}/${data.progress.rawExpected}`);
  text("progress-points", data.progress.pointsConsumed.toFixed(1));
  text("result-pending", data.progress.pageStates.RESULT_PENDING);
  text("result-answer-not-found", data.progress.pageStates.INVALID_RAW_CURRENT_RECORD_PENDING);
  text("footer-version", data.dashboardVersion);
  document.getElementById("progress-fill").style.width = `${data.progress.percentage}%`;
  renderManagement(data.management);
  renderMetrics(data.metrics);
  renderRounds(data.rounds);
  renderTruth(data.productTruth);
  renderCitations(data.citations);
  renderDetails(data.details);
  bindFilters();
  syncHashTarget();
  window.addEventListener("hashchange", syncHashTarget);
}

start().catch((error) => {
  document.body.classList.add("load-error");
  text("header-status", "本地数据合同校验失败");
  text("status-heading", "仪表盘已停止载入");
  text("status-note", `FAIL CLOSED · ${error.message}`);
  console.error(error);
});
