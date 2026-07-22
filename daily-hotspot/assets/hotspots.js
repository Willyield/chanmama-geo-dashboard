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
  { id: "meeting", label: "热点视图" },
  { id: "execution", label: "执行清单" },
  { id: "scan", label: "平台扫描" },
  { id: "archive", label: "每日归档" },
  { id: "rules", label: "评分说明" },
];

export const hotspotFilterDefaults = { search: "", domain: "all", grade: "all", type: "all" };

const ACTION_RANK = { S: 5, A: 4, B: 3, C: 2, D: 1 };

const TECH_SCORE_RULES = [
  ["技术突破强度", 20, "是否带来范式、标准、基础能力或明确工作流变化"],
  ["圈层热度与涨速", 15, "相对科技圈日常基线是否快速升温，而非比较大众绝对流量"],
  ["权威与交叉验证", 15, "是否有官方原文、代码/模型/论文和独立验证"],
  ["开发者与市场采用", 15, "是否出现真实集成、企业采用或开发生态扩散"],
  ["行业竞争影响", 10, "是否推动头部公司、细分赛道或产业链调整"],
  ["持续与扩散周期", 10, "影响是一日话题，还是会延续数周乃至产品路线周期"],
  ["应用迁移价值", 10, "能否迁移到可验证的真实场景或基础设施能力"],
  ["响应窗口", 5, "现在介入是否仍有内容与长期承接窗口"],
];

const BUSINESS_SCORE_RULES = [
  ["蝉妈妈目标用户匹配", 20, "是否直接影响商家、达人、内容或广告从业者"],
  ["电商工作流关联", 20, "是否改变内容、投放、直播、选品或经营流程"],
  ["产品与数据承接", 20, "现有页面、榜单、专题或数据能力能否接住"],
  ["GEO问题价值", 15, "是否形成持续、明确且高意图的决策问题"],
  ["转化与品牌价值", 15, "是否带来访问、注册、咨询或行业专业认知"],
  ["执行准备与成本", 10, "是否已有素材、页面、人群和监测条件可快速验证"],
];

function gradeClass(grade) {
  return `status-${String(grade || "d").toLowerCase()}`;
}

function isTechnology(candidate) {
  return candidate.domain === "technology" || candidate.scoring_model === "tech_v1" || candidate.scoringModel === "tech_v1";
}

function candidateDomain(candidate) {
  return isTechnology(candidate) ? "technology" : "commerce";
}

function actionCode(candidate) {
  const value = candidate.action_level || candidate.actionLevel || candidate.gradeCode || candidate.grade || "D";
  const match = String(value).toUpperCase().match(/(?:L-)?([SABCD])/);
  return match?.[1] || "D";
}

function actionLabel(candidate) {
  if (isTechnology(candidate)) return candidate.action_level || candidate.actionLevel || `L-${actionCode(candidate)}`;
  return candidate.grade || `L-${actionCode(candidate)}`;
}

function sourceTier(candidate) {
  return candidate.source_tier || candidate.sourceTier || candidate.sourceLevel || "信源待核";
}

function techImpactScore(candidate) {
  return candidate.tech_impact_score ?? candidate.techImpactScore ?? null;
}

function techLevel(candidate) {
  return candidate.tech_level || candidate.techLevel || "T-待核";
}

function businessFitScore(candidate) {
  return candidate.business_fit_score ?? candidate.businessFitScore ?? null;
}

function scoreNumber(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : -1;
}

function sortCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    const actionDifference = (ACTION_RANK[actionCode(b)] || 0) - (ACTION_RANK[actionCode(a)] || 0);
    if (actionDifference) return actionDifference;
    const primaryA = isTechnology(a) ? businessFitScore(a) : a.totalScore;
    const primaryB = isTechnology(b) ? businessFitScore(b) : b.totalScore;
    const primaryDifference = scoreNumber(primaryB) - scoreNumber(primaryA);
    if (primaryDifference) return primaryDifference;
    if (isTechnology(a) && isTechnology(b)) return scoreNumber(techImpactScore(b)) - scoreNumber(techImpactScore(a));
    return String(a.id || "").localeCompare(String(b.id || ""), "zh-CN");
  });
}

function techChange(candidate) {
  return candidate.technology_change || candidate.technologyChange || candidate.signal || "技术变化待补";
}

function chanmamaRelevance(candidate) {
  return candidate.chanmama_relevance || candidate.chanmamaRelevance || candidate.actionReason || "业务关联待核";
}

function nextStep(candidate) {
  return candidate.next_step || candidate.nextStep || candidate.recommended || "继续验证";
}

function explicitlyNotDoing(candidate) {
  return candidate.explicitly_not_doing || candidate.explicitlyNotDoing || candidate.notRecommended || "不做高成本动作";
}

function normalizeEvidenceLinks(value) {
  const items = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  return items.filter((item) => item && typeof item === "object" && item.url).map((item) => ({
    url: item.url,
    domain: item.domain || item.platform || item.source || "证据页面",
    label: item.label || item.page || item.title || item.platform || "查看证据",
  }));
}

function evidenceText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(evidenceText).filter(Boolean).join("；");
  if (!value || typeof value !== "object" || value.url) return "";
  return value.text || value.summary || value.evidence || value.signal || "";
}

function officialEvidence(candidate) {
  return candidate.official_evidence ?? candidate.officialEvidence ?? candidate.sourceLinks ?? [];
}

function circleEvidence(candidate) {
  return candidate.circle_evidence ?? candidate.circleEvidence ?? candidate.adoption_signals ?? candidate.adoptionSignals ?? "";
}

function renderEvidencePreview(label, value, fallback = "待补") {
  const links = normalizeEvidenceLinks(value);
  const text = evidenceText(value);
  return `<div class="evidence-preview"><span class="field-kicker">${escapeHtml(label)}</span>${links.length ? sourceLinksHtml(links, 1) : `<span class="cell-secondary">${escapeHtml(firstLine(text || fallback))}</span>`}</div>`;
}

function renderEvidenceGroup(label, value, fallback = "待补") {
  const links = normalizeEvidenceLinks(value);
  const text = evidenceText(value);
  return `<div class="evidence-group"><span class="field-kicker">${escapeHtml(label)}</span>${links.length ? sourceLinksHtml(links, links.length) : ""}${text ? `<p class="drawer-prose">${escapeHtml(text)}</p>` : !links.length ? `<p class="drawer-prose">${escapeHtml(fallback)}</p>` : ""}</div>`;
}

function renderTechnologyScores(candidate, compact = false) {
  const tScore = techImpactScore(candidate);
  const bScore = businessFitScore(candidate);
  const tValue = tScore == null ? "待核" : tScore;
  const bValue = bScore == null ? "待核" : bScore;
  return `<div class="score-triad${compact ? " is-compact" : ""}" aria-label="科技影响 ${escapeHtml(techLevel(candidate))} ${escapeHtml(tValue)} 分，业务承接 ${escapeHtml(bValue)} 分，最终执行 ${escapeHtml(actionLabel(candidate))}">
    <span><small>T</small><strong>${escapeHtml(techLevel(candidate))}</strong><em>${escapeHtml(tValue)}</em></span>
    <span><small>B</small><strong>承接</strong><em>${escapeHtml(bValue)}</em></span>
    <span><small>L</small><strong>${escapeHtml(actionLabel(candidate))}</strong><em>执行</em></span>
  </div>`;
}

function renderCandidateScore(candidate, includeReason = true) {
  if (isTechnology(candidate)) return renderTechnologyScores(candidate);
  return `<div class="score-block"><span class="score-value">${escapeHtml(candidate.totalScore)}</span><span class="score-unit">/100</span></div>${includeReason ? `<span class="cell-secondary">${escapeHtml(candidate.downgradeReason)}</span>` : ""}`;
}

function filterCandidates(candidates, filters) {
  const search = String(filters.search || "").trim().toLowerCase();
  return candidates.filter((candidate) => {
    const matchesSearch = !search || [candidate.name, candidate.signal, candidate.actionReason, candidate.recommended, candidate.evidence,
      techChange(candidate), chanmamaRelevance(candidate), nextStep(candidate), evidenceText(circleEvidence(candidate))]
      .some((value) => String(value || "").toLowerCase().includes(search));
    const matchesDomain = (filters.domain || "all") === "all" || candidateDomain(candidate) === filters.domain;
    const matchesGrade = filters.grade === "all" || actionCode(candidate) === filters.grade;
    const matchesType = filters.type === "all" || candidate.type === filters.type;
    return matchesSearch && matchesDomain && matchesGrade && matchesType;
  });
}

function renderToolbar(data, filters, count) {
  const types = uniqueOptions(data.candidates.map((candidate) => candidate.type));
  const domainCounts = data.candidates.reduce((counts, candidate) => {
    counts[candidateDomain(candidate)] += 1;
    return counts;
  }, { commerce: 0, technology: 0 });
  const domains = [
    ["all", "全部", data.candidates.length],
    ["commerce", "电商经营", domainCounts.commerce],
    ["technology", "科技圈", domainCounts.technology],
  ];
  return `<div class="toolbar">
    <div class="filter-group">
      <fieldset class="domain-segment" aria-label="筛选热点领域">
        <legend class="visually-hidden">热点领域</legend>
        ${domains.map(([value, label, domainCount]) => `<label><input type="radio" name="hotspot-domain" data-filter="domain" value="${value}" ${(filters.domain || "all") === value ? "checked" : ""}><span>${label}<b>${domainCount}</b></span></label>`).join("")}
      </fieldset>
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
  const rows = candidates.map((candidate) => `<tr data-open-id="${escapeHtml(candidate.id)}" data-domain="${candidateDomain(candidate)}">
    <td>${statusChip(actionLabel(candidate), gradeClass(actionCode(candidate)))}<span class="cell-secondary">${escapeHtml(candidate.followDecision || (isTechnology(candidate) ? "按业务承接执行" : ""))}</span></td>
    <td><span class="cell-primary">${escapeHtml(candidate.name)}</span><span class="cell-secondary">${escapeHtml(candidate.type)}<br>${escapeHtml(candidate.status)}</span></td>
    <td>${statusChip(sourceTier(candidate), String(sourceTier(candidate)).startsWith("E3") ? "status-pass" : "")}${sourceLinksHtml(candidate.sourceLinks || normalizeEvidenceLinks(officialEvidence(candidate)), 1)}</td>
    <td>${renderCandidateScore(candidate)}</td>
    <td>${isTechnology(candidate) ? `<span class="field-kicker">技术变化</span><span class="cell-primary">${escapeHtml(techChange(candidate))}</span><span class="cell-secondary"><strong>与蝉妈妈有关：</strong>${escapeHtml(chanmamaRelevance(candidate))}</span>` : `<span class="cell-primary">${escapeHtml(candidate.actionReason)}</span>`}</td>
    <td><span class="cell-primary">${escapeHtml(isTechnology(candidate) ? nextStep(candidate) : candidate.recommended)}</span><span class="cell-secondary">明确不做：${escapeHtml(firstLine(isTechnology(candidate) ? explicitlyNotDoing(candidate) : candidate.notRecommended))}</span></td>
    <td>${isTechnology(candidate) ? `<div class="evidence-pair">${renderEvidencePreview("官方", officialEvidence(candidate), "官方证据未取得")}${renderEvidencePreview("圈层", circleEvidence(candidate), "圈层验证待补")}</div>` : `<span class="cell-primary">${escapeHtml(firstLine(candidate.evidence))}</span><span class="cell-secondary">${escapeHtml(candidate.risk)}｜${escapeHtml(candidate.publishedAt)}</span>`}</td>
  </tr>`).join("");
  const mobile = candidates.map((candidate) => `<article class="mobile-item" data-open-id="${escapeHtml(candidate.id)}" data-domain="${candidateDomain(candidate)}">
    <div class="mobile-item-header">${statusChip(actionLabel(candidate), gradeClass(actionCode(candidate)))}${isTechnology(candidate) ? renderTechnologyScores(candidate, true) : `<span class="mono">${escapeHtml(candidate.totalScore)}</span>`}</div>
    <h3>${escapeHtml(candidate.name)}</h3>
    <div class="mobile-facts">
      <div class="mobile-fact"><span>来源</span><strong>${escapeHtml(sourceTier(candidate))}</strong></div>
      <div class="mobile-fact"><span>类型</span><strong>${escapeHtml(candidate.type)}</strong></div>
    </div>
    ${isTechnology(candidate) ? `<p><strong>技术变化：</strong>${escapeHtml(techChange(candidate))}</p><p><strong>与蝉妈妈有关：</strong>${escapeHtml(chanmamaRelevance(candidate))}</p><p><strong>下一步：</strong>${escapeHtml(nextStep(candidate))}</p><p class="execution-boundary"><strong>明确不做：</strong>${escapeHtml(explicitlyNotDoing(candidate))}</p><div class="mobile-evidence">${renderEvidencePreview("官方", officialEvidence(candidate), "官方证据未取得")}${renderEvidencePreview("圈层", circleEvidence(candidate), "圈层验证待补")}</div>` : `<p>${escapeHtml(candidate.actionReason)}</p><p><strong>立即动作：</strong>${escapeHtml(candidate.recommended)}</p>${sourceLinksHtml(candidate.sourceLinks, 1)}`}
  </article>`).join("");
  return `<div class="data-region">
    <div class="data-table-wrap"><table class="data-table">
      <colgroup><col style="width:10%"><col style="width:16%"><col style="width:11%"><col style="width:13%"><col style="width:20%"><col style="width:18%"><col style="width:12%"></colgroup>
      <thead><tr><th>最终等级</th><th>热点</th><th>来源</th><th>评分</th><th>关键变化 / 为什么追</th><th>下一步 / 立即动作</th><th>官方及圈层证据</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="mobile-list">${mobile}</div>
  </div>`;
}

function renderMeeting(data) {
  const candidates = sortCandidates(data.candidates.filter((candidate) => (candidate.finalValue ?? ACTION_RANK[actionCode(candidate)] ?? 0) >= 3));
  if (!candidates.length) return renderEmpty("本期没有需要进入会议决策的热点");
  const rows = candidates.map((candidate) => `<tr data-open-id="${escapeHtml(candidate.id)}">
    <td>${statusChip(actionLabel(candidate), gradeClass(actionCode(candidate)))}<span class="cell-primary">${escapeHtml(candidate.name)}</span></td>
    <td>${renderCandidateScore(candidate, false)}</td>
    <td><span class="cell-primary">${escapeHtml(isTechnology(candidate) ? techChange(candidate) : candidate.actionReason)}</span>${isTechnology(candidate) ? `<span class="cell-secondary">与蝉妈妈有关：${escapeHtml(chanmamaRelevance(candidate))}</span>` : ""}</td>
    <td><span class="cell-primary">${escapeHtml(isTechnology(candidate) ? nextStep(candidate) : candidate.recommended)}</span></td>
    <td><span class="cell-primary">${escapeHtml(isTechnology(candidate) ? explicitlyNotDoing(candidate) : candidate.notRecommended)}</span><span class="cell-secondary">${escapeHtml(candidate.downgradeReason || "")}</span></td>
  </tr>`).join("");
  const mobile = candidates.map((candidate) => `<article class="mobile-item" data-open-id="${escapeHtml(candidate.id)}">
    <div class="mobile-item-header">${statusChip(actionLabel(candidate), gradeClass(actionCode(candidate)))}${isTechnology(candidate) ? renderTechnologyScores(candidate, true) : `<strong class="mono">${candidate.totalScore}</strong>`}</div>
    <h3>${escapeHtml(candidate.name)}</h3>
    ${isTechnology(candidate) ? `<p><strong>技术变化：</strong>${escapeHtml(techChange(candidate))}</p><p><strong>与蝉妈妈有关：</strong>${escapeHtml(chanmamaRelevance(candidate))}</p><p><strong>下一步：</strong>${escapeHtml(nextStep(candidate))}</p><p><strong>明确不做：</strong>${escapeHtml(explicitlyNotDoing(candidate))}</p><div class="mobile-evidence">${renderEvidencePreview("官方", officialEvidence(candidate), "官方证据未取得")}${renderEvidencePreview("圈层", circleEvidence(candidate), "圈层验证待补")}</div>` : `<p><strong>为什么追：</strong>${escapeHtml(candidate.actionReason)}</p><p><strong>怎么做：</strong>${escapeHtml(candidate.recommended)}</p><p><strong>边界：</strong>${escapeHtml(candidate.notRecommended)}</p>`}
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

function renderRuleTable(title, subtitle, rules) {
  return `<div class="rule-table-block"><div class="rule-table-heading"><h3>${escapeHtml(title)}</h3><span>${escapeHtml(subtitle)}</span></div>
    <div class="data-table-wrap rules-table-wrap"><table class="data-table rules-table">
      <colgroup><col style="width:24%"><col style="width:12%"><col style="width:64%"></colgroup>
      <thead><tr><th>维度</th><th>权重</th><th>判断问题</th></tr></thead><tbody>${rules.map(([name, weight, detail]) => `<tr><td><span class="cell-primary">${escapeHtml(name)}</span></td><td class="mono">${weight}%</td><td>${escapeHtml(detail)}</td></tr>`).join("")}</tbody>
    </table></div></div>`;
}

function renderRules() {
  const commerceRules = [
    ["流量热度", 10, "实际有多少人关注"], ["上升与持续", 10, "涨得快不快、还能热多久"],
    ["目标人群", 15, "关注者是不是蝉妈妈目标用户"], ["业务关联", 20, "是否直接影响电商经营"],
    ["转化价值", 15, "能否带来注册、咨询或付费"], ["品牌价值", 5, "能否建立行业专业认知"],
    ["GEO价值", 10, "用户会不会持续向 AI 提问"], ["产品承接", 5, "现有页面或功能能否接住"],
    ["执行成本", 5, "分数越高越省资源"], ["响应窗口", 5, "现在开始是否来得及"],
  ];
  return `<section class="section-band rules-panel"><div class="section-title"><h2>双轨评分口径</h2><span>两个模型独立计算，不混成一个总分</span></div>
    <section class="model-rule" aria-labelledby="commerce-model-title">
      <div class="model-rule-heading"><div><span class="model-code">commerce_v1</span><h3 id="commerce-model-title">电商经营热点</h3></div><p>沿用原 10 项加权总分与 S/A/B/C/D 执行动作等级，历史数据不重算。</p></div>
      ${renderRuleTable("电商经营总分", "每项 0-5 分，加权换算为 0-100", commerceRules)}
      <div class="rule-note"><strong>等级封顶：</strong>最终等级取分数、信源、类型、业务核心、事实风险、响应窗口和执行准备七项上限中的最低值。</div>
    </section>
    <section class="model-rule" aria-labelledby="tech-model-title">
      <div class="model-rule-heading"><div><span class="model-code">tech_v1</span><h3 id="tech-model-title">科技圈双轨评分</h3></div><p>T-score 判断科技圈本身的重要性；B-score 判断蝉妈妈是否值得行动；最终 L 级只负责资源投入。</p></div>
      ${renderRuleTable("科技影响分 T-score", "T-S 85+｜T-A 70-84｜T-B 55-69｜T-C 40-54｜T-D 低于 40", TECH_SCORE_RULES)}
      ${renderRuleTable("业务承接分 B-score", "目标用户、电商工作流、产品/GEO与执行准备单独判断", BUSINESS_SCORE_RULES)}
      <div class="rule-note"><strong>最终执行：</strong>L-S 要求 T≥85、B≥80、E3、两项独立验证及完整承接与监测；L-A 为 T≥70 且 B≥65，或 T≥55 且 B≥80；L-B 以内容与数据验证为主。</div>
      <div class="rule-note"><strong>硬性封顶：</strong>E1 最高 T-C/L-C，E2 最高 T-B/L-B；B&lt;35 或没有自然业务关联时最高 L-C；没有成熟页面、埋点和准确人群时，不投广告、不全量召回。</div>
    </section>
  </section>`;
}

export function renderHotspotPage({ data, index, view, filters }) {
  const filtered = sortCandidates(filterCandidates(data.candidates, filters));
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
  const actionTimeline = (candidate.actions || []).length
    ? `<ul class="timeline">${candidate.actions.map((action) => `<li><time>${escapeHtml(formatDateTime(action.deadline))} · ${escapeHtml(action.status)}</time><strong>${escapeHtml(action.actionType)}｜${escapeHtml(action.task)}</strong><div class="cell-secondary">${escapeHtml(action.owner)} · ${escapeHtml(action.deliverable)}</div></li>`).join("")}</ul>`
    : `<p class="drawer-prose">暂无拆分动作</p>`;
  const primarySources = (candidate.sourceLinks || []).length ? candidate.sourceLinks : normalizeEvidenceLinks(officialEvidence(candidate));
  const groupedSourceUrls = new Set([
    ...normalizeEvidenceLinks(officialEvidence(candidate)),
    ...normalizeEvidenceLinks(circleEvidence(candidate)),
  ].map((link) => link.url));
  const otherSources = primarySources.filter((link) => !groupedSourceUrls.has(link.url));
  const sources = primarySources.length
    ? `<div class="source-stack">${primarySources.map((link) => sourceLinksHtml([link], 1)).join("")}</div><p class="drawer-prose">${escapeHtml(candidate.evidence)}</p>`
    : `<p class="drawer-prose">${escapeHtml(candidate.evidence || "来源暂缺")}</p>`;
  const renderScoreGrid = (details, ruleFallback) => {
    const rows = Array.isArray(details)
      ? details
      : details && typeof details === "object"
        ? Object.entries(details).map(([name, value], index) => ({ name, score: value?.score ?? value, weight: value?.weight ?? ruleFallback[index]?.[1] ?? "-" }))
        : [];
    if (!rows.length) return `<p class="drawer-prose">评分拆解待补</p>`;
    return `<div class="score-grid">${rows.map((score, index) => `<div class="score-row"><span>${escapeHtml(score.name || score.label || ruleFallback[index]?.[0] || `维度 ${index + 1}`)} · ${escapeHtml(score.weight ?? ruleFallback[index]?.[1] ?? "-")}%</span><span>${escapeHtml(score.score ?? score.value ?? "-")}/5</span></div>`).join("")}</div>`;
  };
  const renderStructuredNotes = (value, fallback) => {
    if (!value) return `<p class="drawer-prose">${escapeHtml(fallback)}</p>`;
    if (typeof value === "string") return `<p class="drawer-prose">${escapeHtml(value)}</p>`;
    const lines = Array.isArray(value)
      ? value.map((item) => typeof item === "string" ? item : item.reason || item.label || JSON.stringify(item))
      : Object.entries(value).map(([key, item]) => `${key}：${typeof item === "object" ? item.reason || item.label || JSON.stringify(item) : item}`);
    return listHtml(lines, fallback);
  };
  const scoreGrid = renderScoreGrid(candidate.scoreDetails || [], []);
  const techScoreGrid = renderScoreGrid(candidate.tech_score_details || candidate.techScoreDetails || candidate.tech_scores || candidate.techScores, TECH_SCORE_RULES);
  const businessScoreGrid = renderScoreGrid(candidate.business_score_details || candidate.businessScoreDetails || candidate.business_scores || candidate.businessScores, BUSINESS_SCORE_RULES);
  const technology = isTechnology(candidate);
  const coreSource = primarySources[0];
  const html = `<div class="drawer-actions">
      ${coreSource ? `<a class="command-button primary" href="${escapeHtml(coreSource.url)}" target="_blank" rel="noopener noreferrer">${icon("external-link")}打开核心来源</a>` : ""}
      <button class="command-button" type="button" data-drawer-command="copy">${icon("copy")}复制执行摘要</button>
    </div>
    ${technology ? detailSection("决策概览", "gauge", factGrid([
      ["最终执行等级", statusChip(actionLabel(candidate), gradeClass(actionCode(candidate)))],
      ["科技影响", `<span class="mono">${escapeHtml(techLevel(candidate))} · ${escapeHtml(techImpactScore(candidate) ?? "待核")} / 100</span>`],
      ["业务承接", `<span class="mono">${escapeHtml(businessFitScore(candidate) ?? "待核")} / 100</span>`],
      ["信源", escapeHtml(sourceTier(candidate))],
      ["评分模型", "tech_v1"],
      ["发布时间", escapeHtml(candidate.publishedAt || "待核")],
    ])) : detailSection("决策概览", "gauge", factGrid([
      ["最终等级", statusChip(actionLabel(candidate), gradeClass(actionCode(candidate)))],
      ["加权总分", `<span class="mono">${escapeHtml(candidate.totalScore)} / 100</span>`],
      ["信源", escapeHtml(sourceTier(candidate))],
      ["降级原因", escapeHtml(candidate.downgradeReason)],
      ["发布时间", escapeHtml(candidate.publishedAt)],
      ["主责", escapeHtml(candidate.owner || "暂缺")],
    ]))}
    ${technology ? `${detailSection("一句话技术变化", "radar", `<p class="drawer-prose">${escapeHtml(techChange(candidate))}</p>`)}
      ${detailSection("为什么与蝉妈妈有关", "target", `<p class="drawer-prose">${escapeHtml(chanmamaRelevance(candidate))}</p>`)}
      ${detailSection("下一步与明确不做", "list-checks", `<p class="drawer-prose">${escapeHtml(candidate.actionDetail || nextStep(candidate))}</p><p class="drawer-prose"><strong>明确不做：</strong>${escapeHtml(explicitlyNotDoing(candidate))}</p>`)}
      ${detailSection("官方及圈层证据", "link", `<div class="drawer-evidence-pair">${renderEvidenceGroup("官方一手", officialEvidence(candidate), "官方证据未取得")}${renderEvidenceGroup("圈层验证", circleEvidence(candidate), "圈层验证待补")}${otherSources.length ? renderEvidenceGroup("其他原始来源", otherSources) : ""}</div>`)}
      ${detailSection("科技影响分拆解", "chart-no-axes-column", techScoreGrid)}
      ${detailSection("业务承接分拆解", "chart-no-axes-column", businessScoreGrid)}
      ${detailSection("评分理由与封顶", "shield-check", `<div class="structured-note"><strong>评分理由</strong>${renderStructuredNotes(candidate.score_reasons || candidate.scoreReasons, "评分理由待补")}</div><div class="structured-note"><strong>封顶原因</strong>${renderStructuredNotes(candidate.score_caps || candidate.scoreCaps, candidate.downgradeReason || "未触发额外封顶")}</div>`)}
    ` : `${detailSection("为什么值得追", "target", `<p class="drawer-prose">${escapeHtml(candidate.actionReason)}</p>`)}
      ${detailSection("平台信号与事实边界", "radar", `<p class="drawer-prose">${escapeHtml(candidate.signal)}</p><p class="drawer-prose"><strong>不确定项：</strong>${escapeHtml(candidate.uncertainty)}</p>`)}
      ${detailSection("具体执行", "list-checks", `<p class="drawer-prose">${escapeHtml(candidate.actionDetail)}</p><p class="drawer-prose"><strong>明确不做：</strong>${escapeHtml(candidate.notRecommended)}</p>`)}
      ${detailSection("原始证据", "link", sources)}
      ${detailSection("评分拆解", "chart-no-axes-column", scoreGrid)}
    `}
    ${detailSection("执行时间线", "route", actionTimeline)}
    ${detailSection("监测指标", "activity", `<p class="drawer-prose">${escapeHtml(candidate.monitor)}</p>`)}
  `;
  const copyText = technology
    ? `【${actionLabel(candidate)}｜${candidate.name}】\n科技影响：${techLevel(candidate)} · ${techImpactScore(candidate) ?? "待核"}\n业务承接：${businessFitScore(candidate) ?? "待核"}\n技术变化：${techChange(candidate)}\n与蝉妈妈有关：${chanmamaRelevance(candidate)}\n下一步：${nextStep(candidate)}\n明确不做：${explicitlyNotDoing(candidate)}\n核心来源：${coreSource?.url || "暂缺"}`
    : `【${actionLabel(candidate)}｜${candidate.name}】\n总评分：${candidate.totalScore}\n为什么追：${candidate.actionReason}\n具体执行：${candidate.recommended}\n执行边界：${candidate.notRecommended}\n核心来源：${coreSource?.url || "暂缺"}`;
  return { eyebrow: `${candidate.id} · ${actionLabel(candidate)}`, title: candidate.name, html, copyText };
}
