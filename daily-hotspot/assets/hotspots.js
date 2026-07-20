import {
  detailSection,
  escapeHtml,
  factGrid,
  firstLine,
  formatDateTime,
  icon,
  listHtml,
  renderDecisionStrip,
  renderEmpty,
  renderPageHeading,
  renderSummaryBand,
  sourceLinksHtml,
  splitLines,
  statusChip,
  uniqueOptions,
} from "./ui.js";

export const hotspotViews = [
  { id: "overview", label: "热点总览" },
  { id: "meeting", label: "会议视图" },
  { id: "execution", label: "执行清单" },
  { id: "scan", label: "平台扫描" },
  { id: "archive", label: "每日归档" },
  { id: "rules", label: "评分说明" },
];

export const hotspotFilterDefaults = { search: "", grade: "all", type: "all" };

function gradeClass(grade) {
  return `status-${String(grade || "d").toLowerCase()}`;
}

function filterCandidates(candidates, filters) {
  const search = String(filters.search || "").trim().toLowerCase();
  return candidates.filter((candidate) => {
    const matchesSearch = !search || [candidate.name, candidate.signal, candidate.actionReason, candidate.recommended, candidate.evidence]
      .some((value) => String(value || "").toLowerCase().includes(search));
    const matchesGrade = filters.grade === "all" || candidate.gradeCode === filters.grade;
    const matchesType = filters.type === "all" || candidate.type === filters.type;
    return matchesSearch && matchesGrade && matchesType;
  });
}

function renderToolbar(data, filters, count) {
  const types = uniqueOptions(data.candidates.map((candidate) => candidate.type));
  return `<div class="toolbar">
    <div class="filter-group">
      <label class="search-box">${icon("search")}<input type="search" data-filter="search" value="${escapeHtml(filters.search)}" placeholder="搜索热点、信号或动作"></label>
      <label class="filter-select">${icon("gauge")}<select data-filter="grade" aria-label="筛选等级">
        <option value="all">全部等级</option>
        ${["S", "A", "B", "C", "D"].map((grade) => `<option value="${grade}" ${filters.grade === grade ? "selected" : ""}>L-${grade}</option>`).join("")}
      </select></label>
      <label class="filter-select">${icon("layers-3")}<select data-filter="type" aria-label="筛选热点类型">
        <option value="all">全部类型</option>
        ${types.map((type) => `<option value="${escapeHtml(type)}" ${filters.type === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
      </select></label>
    </div>
    <span class="result-count">${count} / ${data.candidates.length} 条</span>
  </div>`;
}

function renderOverviewTable(candidates) {
  if (!candidates.length) return `<div class="data-region">${renderEmpty("当前筛选条件下没有热点")}</div>`;
  const rows = candidates.map((candidate) => `<tr data-open-id="${escapeHtml(candidate.id)}">
    <td>${statusChip(candidate.grade, gradeClass(candidate.gradeCode))}<span class="cell-secondary">${escapeHtml(candidate.followDecision)}</span></td>
    <td><span class="cell-primary">${escapeHtml(candidate.name)}</span><span class="cell-secondary">${escapeHtml(candidate.type)}<br>${escapeHtml(candidate.status)}</span></td>
    <td>${statusChip(candidate.sourceLevel, candidate.sourceLevel.startsWith("E3") ? "status-pass" : "")}${sourceLinksHtml(candidate.sourceLinks, 1)}</td>
    <td><div class="score-block"><span class="score-value">${escapeHtml(candidate.totalScore)}</span><span class="score-unit">/100</span></div><span class="cell-secondary">${escapeHtml(candidate.downgradeReason)}</span></td>
    <td><span class="cell-primary">${escapeHtml(candidate.actionReason)}</span></td>
    <td><span class="cell-primary">${escapeHtml(candidate.recommended)}</span><span class="cell-secondary">明确不做：${escapeHtml(firstLine(candidate.notRecommended))}</span></td>
    <td><span class="cell-primary">${escapeHtml(firstLine(candidate.evidence))}</span><span class="cell-secondary">${escapeHtml(candidate.risk)}｜${escapeHtml(candidate.publishedAt)}</span></td>
  </tr>`).join("");
  const mobile = candidates.map((candidate) => `<article class="mobile-item" data-open-id="${escapeHtml(candidate.id)}">
    <div class="mobile-item-header">${statusChip(candidate.grade, gradeClass(candidate.gradeCode))}<span class="mono">${escapeHtml(candidate.totalScore)}</span></div>
    <h3>${escapeHtml(candidate.name)}</h3>
    <div class="mobile-facts">
      <div class="mobile-fact"><span>来源</span><strong>${escapeHtml(candidate.sourceLevel)}</strong></div>
      <div class="mobile-fact"><span>类型</span><strong>${escapeHtml(candidate.type)}</strong></div>
    </div>
    <p>${escapeHtml(candidate.actionReason)}</p>
    <p><strong>立即动作：</strong>${escapeHtml(candidate.recommended)}</p>
    ${sourceLinksHtml(candidate.sourceLinks, 1)}
  </article>`).join("");
  return `<div class="data-region">
    <div class="data-table-wrap"><table class="data-table">
      <colgroup><col style="width:10%"><col style="width:17%"><col style="width:12%"><col style="width:8%"><col style="width:20%"><col style="width:20%"><col style="width:13%"></colgroup>
      <thead><tr><th>最终等级</th><th>热点</th><th>来源</th><th>总评分</th><th>为什么值得追</th><th>立即动作</th><th>核心证据</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="mobile-list">${mobile}</div>
  </div>`;
}

function renderMeeting(data) {
  const candidates = [...data.candidates]
    .filter((candidate) => candidate.finalValue >= 3)
    .sort((a, b) => b.finalValue - a.finalValue || b.totalScore - a.totalScore);
  if (!candidates.length) return renderEmpty("本期没有需要进入会议决策的热点");
  const rows = candidates.map((candidate) => `<tr data-open-id="${escapeHtml(candidate.id)}">
    <td>${statusChip(candidate.grade, gradeClass(candidate.gradeCode))}<span class="cell-primary">${escapeHtml(candidate.name)}</span></td>
    <td><div class="score-block"><span class="score-value">${escapeHtml(candidate.totalScore)}</span><span class="score-unit">/100</span></div></td>
    <td><span class="cell-primary">${escapeHtml(candidate.actionReason)}</span></td>
    <td><span class="cell-primary">${escapeHtml(candidate.recommended)}</span></td>
    <td><span class="cell-primary">${escapeHtml(candidate.notRecommended)}</span><span class="cell-secondary">${escapeHtml(candidate.downgradeReason)}</span></td>
  </tr>`).join("");
  const mobile = candidates.map((candidate) => `<article class="mobile-item" data-open-id="${escapeHtml(candidate.id)}">
    <div class="mobile-item-header">${statusChip(candidate.grade, gradeClass(candidate.gradeCode))}<strong class="mono">${candidate.totalScore}</strong></div>
    <h3>${escapeHtml(candidate.name)}</h3>
    <p><strong>为什么追：</strong>${escapeHtml(candidate.actionReason)}</p>
    <p><strong>怎么做：</strong>${escapeHtml(candidate.recommended)}</p>
    <p><strong>边界：</strong>${escapeHtml(candidate.notRecommended)}</p>
  </article>`).join("");
  return `<section class="section-band"><div class="section-title"><h2>本期会议决策</h2><span>${candidates.length} 条进入会议</span></div>
    <div class="data-table-wrap"><table class="data-table" style="min-width:900px">
      <colgroup><col style="width:22%"><col style="width:9%"><col style="width:25%"><col style="width:25%"><col style="width:19%"></colgroup>
      <thead><tr><th>等级 / 热点</th><th>评分</th><th>为什么追</th><th>具体执行</th><th>执行边界</th></tr></thead><tbody>${rows}</tbody>
    </table></div><div class="mobile-list">${mobile}</div>
  </section>`;
}

function renderExecution(data) {
  if (!data.actions.length) return renderEmpty("本期没有执行清单");
  const byId = new Map(data.candidates.map((candidate) => [candidate.id, candidate]));
  const rows = data.actions.map((action) => `<tr data-open-id="${escapeHtml(action.hotspotId)}">
    <td><span class="cell-primary">${escapeHtml(byId.get(action.hotspotId)?.name || action.hotspotId)}</span><span class="cell-secondary">${escapeHtml(action.actionType)}</span></td>
    <td><span class="cell-primary">${escapeHtml(action.task)}</span></td>
    <td><span class="cell-primary">${escapeHtml(action.owner)}</span><span class="cell-secondary">协作：${escapeHtml(action.collaborators)}</span></td>
    <td class="mono">${escapeHtml(formatDateTime(action.deadline))}</td>
    <td><span class="cell-primary">${escapeHtml(action.deliverable)}</span><span class="cell-secondary">验收：${escapeHtml(action.acceptance)}</span></td>
    <td><span class="cell-primary">${escapeHtml(action.stopCondition)}</span></td>
    <td>${statusChip(action.status || "待开始", action.status === "已完成" ? "status-pass" : "")}</td>
  </tr>`).join("");
  const mobile = data.actions.map((action) => `<article class="mobile-item" data-open-id="${escapeHtml(action.hotspotId)}">
    <div class="mobile-item-header">${statusChip(action.actionType)}${statusChip(action.status || "待开始")}</div>
    <h3>${escapeHtml(byId.get(action.hotspotId)?.name || action.hotspotId)}</h3>
    <p>${escapeHtml(action.task)}</p>
    <div class="mobile-facts"><div class="mobile-fact"><span>主责</span><strong>${escapeHtml(action.owner)}</strong></div><div class="mobile-fact"><span>交付物</span><strong>${escapeHtml(action.deliverable)}</strong></div></div>
  </article>`).join("");
  return `<section class="section-band"><div class="section-title"><h2>执行清单</h2><span>${data.actions.length} 项动作</span></div>
    <div class="data-table-wrap"><table class="data-table" style="min-width:1260px">
      <colgroup><col style="width:18%"><col style="width:22%"><col style="width:13%"><col style="width:12%"><col style="width:16%"><col style="width:13%"><col style="width:6%"></colgroup>
      <thead><tr><th>热点 / 动作类型</th><th>任务</th><th>主责与协作</th><th>时间</th><th>交付与验收</th><th>停止条件</th><th>状态</th></tr></thead><tbody>${rows}</tbody>
    </table></div><div class="mobile-list">${mobile}</div>
  </section>`;
}

function renderScan(data) {
  if (!data.scanLogs.length) return renderEmpty("本期没有平台扫描记录");
  const rows = data.scanLogs.map((log) => `<tr>
    <td><span class="cell-primary">${escapeHtml(log.platform)}</span>${log.url ? `<div>${sourceLinksHtml([{ url: log.url, domain: "打开页面", label: log.page }], 1)}</div>` : ""}</td>
    <td>${statusChip(log.status, log.status.includes("未") ? "status-conflict" : "status-pass")}<span class="cell-secondary">${escapeHtml(log.evidenceLevel)}</span></td>
    <td><span class="cell-primary">${escapeHtml(log.page)}</span><span class="cell-secondary mono">${escapeHtml(log.observedAt)}</span></td>
    <td><span class="cell-primary">${escapeHtml(log.signal)}</span></td>
    <td><span class="cell-primary">${escapeHtml(log.limitation)}</span></td>
    <td><span class="cell-primary">${escapeHtml(log.nextAction)}</span></td>
  </tr>`).join("");
  return `<section class="section-band"><div class="section-title"><h2>平台扫描日志</h2><span>${data.scanLogs.length} 个来源</span></div>
    <div class="data-table-wrap" style="display:block"><table class="data-table" style="min-width:1180px">
      <colgroup><col style="width:16%"><col style="width:12%"><col style="width:18%"><col style="width:25%"><col style="width:15%"><col style="width:14%"></colgroup>
      <thead><tr><th>平台 / 页面</th><th>覆盖与证据</th><th>位置 / 时间</th><th>取得信号</th><th>限制</th><th>下一步</th></tr></thead><tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

function renderArchive(index) {
  return `<section class="section-band"><div class="section-title"><h2>每日历史快照</h2><span>日期文件发布后不跨日覆盖</span></div>
    <div class="archive-grid">${index.dates.map((item) => `<button type="button" class="archive-item" data-route-date="${escapeHtml(item.date)}">
      <time>${escapeHtml(item.date)}</time>
      <p>${item.total} 条热点｜重点追 ${item.priority} 条</p>
      <p>S ${item.gradeCounts.S} · A ${item.gradeCounts.A} · B ${item.gradeCounts.B} · C ${item.gradeCounts.C} · D ${item.gradeCounts.D}</p>
    </button>`).join("")}</div>
  </section>`;
}

function renderRules() {
  const rules = [
    ["流量热度", 10, "实际有多少人关注"], ["上升与持续", 10, "涨得快不快、还能热多久"],
    ["目标人群", 15, "关注者是不是蝉妈妈目标用户"], ["业务关联", 20, "是否直接影响电商经营"],
    ["转化价值", 15, "能否带来注册、咨询或付费"], ["品牌价值", 5, "能否建立行业专业认知"],
    ["GEO价值", 10, "用户会不会持续向 AI 提问"], ["产品承接", 5, "现有页面或功能能否接住"],
    ["执行成本", 5, "分数越高越省资源"], ["响应窗口", 5, "现在开始是否来得及"],
  ];
  return `<section class="section-band"><div class="section-title"><h2>10 项评分口径</h2><span>每项 0-5 分，加权换算为 0-100</span></div>
    <div class="data-table-wrap" style="display:block"><table class="data-table" style="min-width:760px">
      <colgroup><col style="width:22%"><col style="width:12%"><col style="width:66%"></colgroup>
      <thead><tr><th>维度</th><th>权重</th><th>判断问题</th></tr></thead><tbody>${rules.map(([name, weight, detail]) => `<tr><td><span class="cell-primary">${name}</span></td><td class="mono">${weight}%</td><td>${detail}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="drawer-section"><h3>${icon("shield-check")}七项等级上限</h3><p class="drawer-prose">最终等级取分数、信源、类型、业务核心、事实风险、响应窗口和执行准备七项上限中的最低值。证据不足、业务连接弱、窗口已过或执行信息不全时，即使总分较高也必须降级。</p></div>
  </section>`;
}

export function renderHotspotPage({ data, index, view, filters }) {
  const filtered = filterCandidates(data.candidates, filters);
  const counts = data.summary.gradeCounts;
  const heading = renderPageHeading({
    eyebrow: `HOTSPOT INTELLIGENCE / ${data.date}`,
    title: "每日热点",
    subtitle: "从平台一手信号到明确动作，保留证据、边界与历史快照",
    views: hotspotViews,
    activeView: view,
  });
  const summary = renderSummaryBand({
    summary: data.summary.webSummary,
    metrics: [
      { value: data.candidates.length, label: "本期入库" },
      { value: `${counts.S}/${counts.A}`, label: "S级 / A级" },
      { value: counts.B, label: "低成本跟进" },
      { value: data.summary.evidenceE3Count, label: "E3一手证据" },
      { value: data.scanLogs.length, label: "扫描来源" },
    ],
    observedAt: data.observedAt,
    sourceWorkbook: data.sourceWorkbook,
  });
  const decisions = renderDecisionStrip(data.summary.topActions, "id");
  let content;
  if (view === "meeting") content = renderMeeting(data);
  else if (view === "execution") content = renderExecution(data);
  else if (view === "scan") content = renderScan(data);
  else if (view === "archive") content = renderArchive(index);
  else if (view === "rules") content = renderRules();
  else content = `${renderToolbar(data, filters, filtered.length)}${renderOverviewTable(filtered)}`;
  return `${heading}${summary}${decisions}${content}`;
}

export function renderHotspotDetail(candidate) {
  const actionTimeline = candidate.actions.length
    ? `<ul class="timeline">${candidate.actions.map((action) => `<li><time>${escapeHtml(formatDateTime(action.deadline))} · ${escapeHtml(action.status)}</time><strong>${escapeHtml(action.actionType)}｜${escapeHtml(action.task)}</strong><div class="cell-secondary">${escapeHtml(action.owner)} · ${escapeHtml(action.deliverable)}</div></li>`).join("")}</ul>`
    : `<p class="drawer-prose">暂无拆分动作</p>`;
  const sources = candidate.sourceLinks.length
    ? `<div class="source-stack">${candidate.sourceLinks.map((link) => sourceLinksHtml([link], 1)).join("")}</div><p class="drawer-prose">${escapeHtml(candidate.evidence)}</p>`
    : `<p class="drawer-prose">${escapeHtml(candidate.evidence || "来源暂缺")}</p>`;
  const scoreGrid = `<div class="score-grid">${candidate.scoreDetails.map((score) => `<div class="score-row"><span>${escapeHtml(score.name)} · ${score.weight}%</span><span>${score.score}/5</span></div>`).join("")}</div>`;
  const html = `<div class="drawer-actions">
      ${candidate.sourceLinks[0] ? `<a class="command-button primary" href="${escapeHtml(candidate.sourceLinks[0].url)}" target="_blank" rel="noopener noreferrer">${icon("external-link")}打开核心来源</a>` : ""}
      <button class="command-button" type="button" data-drawer-command="copy">${icon("copy")}复制执行摘要</button>
    </div>
    ${detailSection("决策概览", "gauge", factGrid([
      ["最终等级", statusChip(candidate.grade, gradeClass(candidate.gradeCode))],
      ["加权总分", `<span class="mono">${escapeHtml(candidate.totalScore)} / 100</span>`],
      ["信源", escapeHtml(candidate.sourceLevel)],
      ["降级原因", escapeHtml(candidate.downgradeReason)],
      ["发布时间", escapeHtml(candidate.publishedAt)],
      ["主责", escapeHtml(candidate.owner || "暂缺")],
    ]))}
    ${detailSection("为什么值得追", "target", `<p class="drawer-prose">${escapeHtml(candidate.actionReason)}</p>`)}
    ${detailSection("平台信号与事实边界", "radar", `<p class="drawer-prose">${escapeHtml(candidate.signal)}</p><p class="drawer-prose"><strong>不确定项：</strong>${escapeHtml(candidate.uncertainty)}</p>`)}
    ${detailSection("具体执行", "list-checks", `<p class="drawer-prose">${escapeHtml(candidate.actionDetail)}</p><p class="drawer-prose"><strong>明确不做：</strong>${escapeHtml(candidate.notRecommended)}</p>`)}
    ${detailSection("原始证据", "link", sources)}
    ${detailSection("评分拆解", "chart-no-axes-column", scoreGrid)}
    ${detailSection("执行时间线", "route", actionTimeline)}
    ${detailSection("监测指标", "activity", `<p class="drawer-prose">${escapeHtml(candidate.monitor)}</p>`)}
  `;
  const copyText = `【${candidate.grade}｜${candidate.name}】\n总评分：${candidate.totalScore}\n为什么追：${candidate.actionReason}\n具体执行：${candidate.recommended}\n执行边界：${candidate.notRecommended}\n核心来源：${candidate.sourceLinks[0]?.url || "暂缺"}`;
  return { eyebrow: `${candidate.id} · ${candidate.grade}`, title: candidate.name, html, copyText };
}
