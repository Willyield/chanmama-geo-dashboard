import {
  detailSection,
  escapeHtml,
  factGrid,
  formatDateTime,
  icon,
  listHtml,
  renderEmpty,
  renderPageHeading,
  safeUrl,
  statusChip,
  uniqueOptions,
} from "./ui.js";

export const creatorViews = [
  { id: "overview", label: "今日决策" },
  { id: "quality", label: "优质达人" },
  { id: "topics", label: "热点雷达" },
  { id: "candidates", label: "全部候选" },
  { id: "evidence", label: "证据与规则" },
];

export const creatorFilterDefaults = {
  search: "",
  action: "all",
  disposition: "all",
  track: "all",
  refetch: "all",
};

const DISPOSITION_CLASS = {
  READY_FOR_MANUAL_ROUND1: "status-pass",
  FAIL_AUTOMATED_GATE: "status-conflict",
  WATCH_SAMPLE_LT15: "status-watch",
  NO_MATCHED_API_EVIDENCE: "status-d",
};

const DISPOSITION_ORDER = {
  READY_FOR_MANUAL_ROUND1: 0,
  WATCH_SAMPLE_LT15: 1,
  NO_MATCHED_API_EVIDENCE: 2,
  FAIL_AUTOMATED_GATE: 3,
};

const ACTION_META = {
  EXECUTE: { label: "优先使用", className: "status-pass", rank: 0 },
  CONDITIONAL: { label: "条件使用", className: "status-watch", rank: 1 },
  WATCH: { label: "重点观察", className: "status-watch", rank: 2 },
  TOPIC_SCOUT: { label: "话题侦察", className: "status-watch", rank: 3 },
  BACKFILL: { label: "优先补证", className: "status-watch", rank: 4 },
  REFERENCE: { label: "机构参考", className: "status-d", rank: 5 },
  DEPRIORITIZE: { label: "降级/排除", className: "status-conflict", rank: 6 },
  POOL: { label: "候选池留档", className: "status-d", rank: 7 },
  UNKNOWN: { label: "证据不足", className: "status-d", rank: 8 },
};

const GATE_RULES = [
  ["90 天有效作品", ">= 15 条", "validVideos90d"],
  ["电商运营相关占比", ">= 60%", "relevantRatio"],
  ["核心实操内容占比", ">= 40%", "corePracticeLowerBound"],
  ["60 天相关作品", ">= 6 条", "relatedVideos60d"],
  ["最近相关作品", "<= 30 天", "latestRelatedAgeDays"],
];

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstValue(...values) {
  return values.find((value) => value != null && value !== "");
}

function formatFollowers(value) {
  const number = numberOrNull(value);
  if (number == null) return "缺失";
  if (number >= 100000000) return `${(number / 100000000).toFixed(1).replace(/\.0$/, "")} 亿`;
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 1 : 2).replace(/\.0+$/, "")} 万`;
  return number.toLocaleString("zh-CN");
}

function formatMetric(value) {
  const number = numberOrNull(value);
  return number == null ? "缺失" : number.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function formatDelta(value) {
  const number = numberOrNull(value);
  return number == null ? "缺失" : `${number >= 0 ? "+" : ""}${number.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function formatPercent(value) {
  const number = numberOrNull(value);
  if (number == null) return "缺失";
  const percent = Math.abs(number) <= 1 ? number * 100 : number;
  return `${percent.toFixed(percent >= 10 ? 0 : 1).replace(/\.0$/, "")}%`;
}

function formatScore(value) {
  const number = numberOrNull(value);
  return number == null ? "待评分" : number.toFixed(number % 1 ? 1 : 0);
}

function formatPercentile(value) {
  const number = numberOrNull(value);
  if (number == null) return "同行分位缺失";
  const percentile = Math.abs(number) <= 1 ? number * 100 : number;
  return `P${Math.round(percentile)}`;
}

function formatConfidence(value) {
  if (value == null || value === "") return "低";
  if (typeof value === "number") return formatPercent(value);
  return String(value);
}

function confidenceGrade(value) {
  const formatted = formatConfidence(value);
  const grade = formatted.split(/[：:]/, 1)[0].trim();
  return grade.length <= 12 ? grade : "见证据说明";
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeAction(value, label = "") {
  const token = `${value || ""} ${label || ""}`.toLowerCase();
  if (/topic_scout|话题侦察/.test(token)) return "TOPIC_SCOUT";
  if (/backfill|补证/.test(token)) return "BACKFILL";
  if (/reference|机构参考|权威源/.test(token)) return "REFERENCE";
  if (/pool_only|候选池|留档/.test(token)) return "POOL";
  if (/deprior|downgrade|reject|exclude|stop|淘汰|排除|降级|低优先/.test(token)) return "DEPRIORITIZE";
  if (/conditional|条件使用/.test(token)) return "CONDITIONAL";
  if (/keep_watch|watch|observe|观察/.test(token)) return "WATCH";
  if (/execute|use_now|include|直接使用|优先使用|立即执行/.test(token)) return "EXECUTE";
  return "UNKNOWN";
}

function thresholdFailures(metrics) {
  const failures = [];
  if (metrics.sampleSize != null && metrics.sampleSize < 15) failures.push(`有效样本 ${metrics.sampleSize} 条，低于 15 条`);
  if (metrics.relevanceRatio != null && metrics.relevanceRatio < 0.6) failures.push(`相关内容 ${formatPercent(metrics.relevanceRatio)}，低于 60%`);
  if (metrics.corePracticeRatio != null && metrics.corePracticeRatio < 0.4) failures.push(`核心实操 ${formatPercent(metrics.corePracticeRatio)}，低于 40%`);
  if (metrics.freshnessDays != null && metrics.freshnessDays > 30) failures.push(`最近相关内容距今 ${formatMetric(metrics.freshnessDays)} 天，超过 30 天`);
  return failures;
}

function fallbackCreatorDecision(candidate) {
  const gates = candidate?.gates || {};
  const metrics = {
    relevanceRatio: numberOrNull(gates.relevantRatio),
    corePracticeRatio: numberOrNull(gates.corePracticeLowerBound),
    medianLikes: null,
    medianDeep: null,
    medianSaveShare: null,
    peerPercentile: null,
    breakoutRate: null,
    stability: null,
    freshnessDays: numberOrNull(gates.latestRelatedAgeDays),
    sampleSize: numberOrNull(gates.validVideos90d),
  };
  const failures = thresholdFailures(metrics);
  if (numberOrNull(gates.relatedVideos60d) != null && Number(gates.relatedVideos60d) < 6) {
    failures.push(`60 天相关作品 ${gates.relatedVideos60d} 条，低于 6 条`);
  }
  failures.push(...asArray(gates.automatedFailures).map((item) => `自动门槛：${item}`));
  const gaps = [];
  if (metrics.corePracticeRatio == null) gaps.push("核心实操占比待核");
  if (!numberOrNull(candidate?.refetch?.successfulVideos)) gaps.push(`复取成功 0/${formatMetric(candidate?.refetch?.targetVideos)}`);
  if (metrics.peerPercentile == null) gaps.push("缺少同体量同行分位");
  const eligible = failures.length === 0 && metrics.sampleSize != null && metrics.relevanceRatio != null && metrics.corePracticeRatio != null && metrics.freshnessDays != null;
  const action = failures.length ? "DEPRIORITIZE" : candidate?.autoDisposition === "READY_FOR_MANUAL_ROUND1" ? "WATCH" : "UNKNOWN";
  return {
    creatorId: candidate?.id,
    nickname: candidate?.nickname,
    profileUrl: candidate?.profileUrl,
    followers: candidate?.followers,
    action,
    actionLabel: ACTION_META[action].label,
    score: null,
    evidenceGrade: eligible ? "C" : "D",
    eligibilityPass: eligible,
    hardFailures: uniqueStrings(failures),
    metrics,
    reasons: eligible ? ["通过即时资格门槛，仍需补齐体量归一化表现后再决定是否优先使用"] : [],
    gaps: uniqueStrings(gaps),
    realtimeHotspots: [],
  };
}

function normalizeCreatorDecision(record, candidate) {
  const fallback = fallbackCreatorDecision(candidate || record);
  const rawMetrics = record?.metrics || {};
  const rawGates = record?.gates || {};
  const metrics = {
    relevanceRatio: numberOrNull(firstValue(rawMetrics.relevanceRatio, rawGates.relevant_ratio, fallback.metrics.relevanceRatio)),
    corePracticeRatio: numberOrNull(firstValue(rawMetrics.corePracticeRatio, rawGates.core_practice_title_lower_bound, fallback.metrics.corePracticeRatio)),
    medianLikes: numberOrNull(rawMetrics.medianLikes),
    medianDeep: numberOrNull(rawMetrics.medianDeep),
    medianSaveShare: numberOrNull(rawMetrics.medianSaveShare),
    peerPercentile: numberOrNull(firstValue(rawMetrics.peerPercentile, rawMetrics.deepPeerPercentile)),
    breakoutRate: numberOrNull(rawMetrics.breakoutRate),
    stability: firstValue(rawMetrics.stability, record?.scoreParts?.S, null),
    freshnessDays: numberOrNull(firstValue(rawMetrics.freshnessDays, rawGates.latest_related_age_days, fallback.metrics.freshnessDays)),
    sampleSize: numberOrNull(firstValue(rawMetrics.sampleSize, rawGates.valid_videos_90d, fallback.metrics.sampleSize)),
  };
  const hardFailures = record ? uniqueStrings(asArray(record.hardFailures)) : uniqueStrings(thresholdFailures(metrics));
  const hasQualificationEvidence = metrics.sampleSize != null && metrics.relevanceRatio != null && metrics.corePracticeRatio != null && metrics.freshnessDays != null;
  const eligibilityPass = record?.eligibilityPass === true && hardFailures.length === 0
    ? true
    : record?.eligibilityPass === false
      ? false
      : hardFailures.length === 0 && hasQualificationEvidence;
  let action = normalizeAction(record?.action, record?.actionLabel);
  if (action === "UNKNOWN") action = fallback.action;
  const meta = ACTION_META[action] || ACTION_META.UNKNOWN;
  return {
    ...fallback,
    ...record,
    creatorId: firstValue(record?.creatorId, candidate?.id, fallback.creatorId),
    nickname: firstValue(record?.nickname, candidate?.nickname, fallback.nickname, "未命名达人"),
    profileUrl: firstValue(record?.profileUrl, candidate?.profileUrl, fallback.profileUrl),
    followers: firstValue(record?.followers, candidate?.followers, fallback.followers),
    action,
    actionLabel: firstValue(record?.actionLabel, meta.label),
    evidenceGrade: firstValue(record?.evidenceGrade, record?.confidence, fallback.evidenceGrade, "D"),
    confidence: firstValue(record?.confidence, record?.evidenceGrade, fallback.evidenceGrade, "D"),
    eligibilityPass,
    hardFailures,
    metrics,
    reasons: uniqueStrings(firstValue(record?.reasons, record?.reason, fallback.reasons, [])),
    gaps: uniqueStrings(firstValue(record?.gaps, record?.decisionNote, record?.reasonCodes, fallback.gaps, [])),
    realtimeHotspots: asArray(firstValue(record?.realtimeHotspots, fallback.realtimeHotspots, [])),
  };
}

function normalizeTopic(topic, index) {
  return {
    ...topic,
    id: firstValue(topic?.id, topic?.topicId, `TOPIC-${String(index + 1).padStart(2, "0")}`),
    name: firstValue(topic?.name, topic?.topic, topic?.title, "未命名话题"),
    stage: firstValue(topic?.stage, "待判断"),
    decision: firstValue(topic?.decision, "继续观察"),
    confidence: firstValue(topic?.confidence, "低"),
    normalizedVelocity: numberOrNull(topic?.normalizedVelocity),
    independentCreators: numberOrNull(topic?.independentCreators),
    maxCreatorContribution: numberOrNull(topic?.maxCreatorContribution),
    recent72hLifetimeInteractions: numberOrNull(firstValue(topic?.recent72hLifetimeInteractions, topic?.recent72hInteractions)),
    recent72hLifetimeDeepInteractions: numberOrNull(firstValue(topic?.recent72hLifetimeDeepInteractions, topic?.recent72hDeepInteractions)),
    evidenceVideos: asArray(topic?.evidenceVideos),
    whyNow: firstValue(topic?.whyNow, "缺少增长与扩散说明"),
    angle: firstValue(topic?.angle, "待形成生产角度"),
    risk: firstValue(topic?.risk, "证据尚不完整"),
    stopCondition: firstValue(topic?.stopCondition, "下一轮没有新增独立创作者或增速回落即停止"),
    nextCheck: firstValue(topic?.nextCheck, "下一轮快照复核"),
  };
}

function normalizeBrief(brief, index) {
  return {
    ...brief,
    id: firstValue(brief?.id, `BRIEF-${String(index + 1).padStart(2, "0")}`),
    priority: firstValue(brief?.priority, index + 1),
    status: firstValue(brief?.status, "待补证"),
    topic: firstValue(brief?.topic, "未命名议题"),
    title: firstValue(brief?.title, "待形成标题"),
    hook: firstValue(brief?.hook, "待形成开头"),
    audience: firstValue(brief?.audience, "电商运营团队"),
    format: firstValue(brief?.format, "短视频"),
    owner: firstValue(brief?.owner, "待分配"),
    deadline: firstValue(brief?.deadline, "待安排"),
    publishWindow: firstValue(brief?.publishWindow, "证据达标后"),
    evidence: asArray(brief?.evidence),
    risk: firstValue(brief?.risk, "证据不足时不得确定性表述"),
    stopCondition: firstValue(brief?.stopCondition, "关键证据未补齐则停止发布"),
    nextAction: firstValue(brief?.nextAction, "补齐证据并复核"),
  };
}

function normalizeDecision(data) {
  const raw = data?.decision || {};
  const candidates = asArray(data?.candidates);
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const records = new Map();
  for (const record of asArray(raw.creatorDecisions)) {
    const id = firstValue(record?.creatorId, record?.id);
    if (id) records.set(id, record);
  }
  for (const record of asArray(raw.downgraded)) {
    const id = firstValue(record?.creatorId, record?.id);
    if (id) records.set(id, { ...(records.get(id) || {}), ...record, action: "DEPRIORITIZE", actionLabel: firstValue(record?.actionLabel, "降级/排除") });
  }
  const creatorDecisions = candidates.map((candidate) => normalizeCreatorDecision(records.get(candidate.id), candidate));
  for (const [id, record] of records) {
    if (!candidateMap.has(id)) creatorDecisions.push(normalizeCreatorDecision(record, null));
  }
  const topicCandidates = asArray(firstValue(raw.topicCandidates, data?.topics, [])).map(normalizeTopic);
  const actionBriefs = asArray(firstValue(raw.actionBriefs, data?.recommendations, [])).slice(0, 3).map(normalizeBrief);
  const singleVideoSignals = asArray(firstValue(raw.singleVideoSignals, data?.videoSignals, []));
  const executeCreators = creatorDecisions.filter((item) => item.action === "EXECUTE").length;
  const conditionalCreators = creatorDecisions.filter((item) => item.action === "CONDITIONAL").length;
  const watchOnlyCreators = creatorDecisions.filter((item) => item.action === "WATCH").length;
  const scoutCreators = creatorDecisions.filter((item) => item.action === "TOPIC_SCOUT").length;
  const watchCreators = conditionalCreators + watchOnlyCreators;
  const deprioritizedCreators = creatorDecisions.filter((item) => item.action === "DEPRIORITIZE").length;
  const rawSummary = raw.summary || {};
  const summary = {
    executeCreators: numberOrNull(firstValue(rawSummary.executeCreators, executeCreators)) ?? executeCreators,
    conditionalCreators: numberOrNull(firstValue(rawSummary.conditionalCreators, conditionalCreators)) ?? conditionalCreators,
    watchOnlyCreators: numberOrNull(firstValue(rawSummary.watchOnlyCreators, rawSummary.watchCreators, watchOnlyCreators)) ?? watchOnlyCreators,
    scoutCreators: numberOrNull(firstValue(rawSummary.scoutCreators, scoutCreators)) ?? scoutCreators,
    personalReviewed: numberOrNull(firstValue(rawSummary.personalReviewed, rawSummary.reviewedToday)),
    referenceReviewed: numberOrNull(firstValue(rawSummary.referenceReviewed, rawSummary.referenceSources)),
    watchCreators: rawSummary.conditionalCreators != null
      ? (numberOrNull(rawSummary.conditionalCreators) || 0) + (numberOrNull(rawSummary.watchCreators) || 0)
      : numberOrNull(firstValue(rawSummary.watchCreators, watchCreators)) ?? watchCreators,
    deprioritizedCreators: numberOrNull(firstValue(rawSummary.deprioritizedCreators, deprioritizedCreators)) ?? deprioritizedCreators,
    immediateTopics: numberOrNull(firstValue(rawSummary.immediateTopics, topicCandidates.filter((item) => /立即|执行|follow_now/i.test(item.decision)).length)) ?? 0,
    draftTopics: numberOrNull(firstValue(rawSummary.draftTopics, rawSummary.conditionalTopics, actionBriefs.filter((item) => /备稿|draft|prepare/i.test(item.status)).length)) ?? 0,
    observedAt: firstValue(rawSummary.observedAt, raw.decisionAsOf, raw.observedAt, data?.observedAt),
    confidence: firstValue(rawSummary.confidence, raw.confidence, "低"),
  };
  return {
    summary,
    creatorDecisions,
    topicCandidates,
    actionBriefs,
    singleVideoSignals,
    todayConclusion: raw.todayConclusion || null,
    samplingRisk: raw.samplingRisk || null,
    authoritySources: raw.authoritySources || null,
    methodology: firstValue(raw.methodology, data?.methodology, {}),
    limitations: uniqueStrings([...asArray(data?.limitations), ...asArray(raw.limitations)]),
  };
}

function decisionByCreator(decision) {
  return new Map(decision.creatorDecisions.map((item) => [item.creatorId, item]));
}

function actionChip(item) {
  const meta = ACTION_META[item?.action] || ACTION_META.UNKNOWN;
  return statusChip(firstValue(item?.actionLabel, meta.label), meta.className);
}

function gateSignals(candidate) {
  const gates = candidate?.gates || {};
  return [
    { key: "sample", label: "样本", pass: numberOrNull(gates.validVideos90d) != null && Number(gates.validVideos90d) >= 15 },
    { key: "relevance", label: "相关", pass: numberOrNull(gates.relevantRatio) != null && Number(gates.relevantRatio) >= 0.6 },
    { key: "practice", label: "实操", pass: numberOrNull(gates.corePracticeLowerBound) != null && Number(gates.corePracticeLowerBound) >= 0.4 },
    { key: "frequency", label: "频次", pass: numberOrNull(gates.relatedVideos60d) != null && Number(gates.relatedVideos60d) >= 6 },
    { key: "recency", label: "近期", pass: numberOrNull(gates.latestRelatedAgeDays) != null && Number(gates.latestRelatedAgeDays) <= 30 },
    { key: "refetch", label: "表现", pass: Number(candidate?.refetch?.successfulVideos) > 0 },
  ];
}

function renderEvidenceRail(candidate, compact = false) {
  const signals = gateSignals(candidate);
  const passed = signals.filter((item) => item.pass).length;
  return `<div class="evidence-rail${compact ? " is-compact" : ""}" aria-label="证据完整度 ${passed} / ${signals.length}">
    <div class="evidence-rail-track">${signals.map((signal) => `<span class="${signal.pass ? "is-on" : ""}" title="${escapeHtml(signal.label)}：${signal.pass ? "已达标" : "未达标或缺失"}"></span>`).join("")}</div>
    <div class="evidence-rail-labels">${signals.map((signal) => `<span>${escapeHtml(signal.label)}</span>`).join("")}</div>
  </div>`;
}

function decisionConclusion(summary) {
  if (summary.immediateTopics > 0) return `今日有 ${summary.immediateTopics} 个议题可进入生产`;
  if (summary.draftTopics > 0) return `今日无立即发布热点，先完成 ${summary.draftTopics} 个备稿`;
  return "今日无可立即发布热点，执行补证与观察";
}

function renderDecisionLead(decision, data, compact = false) {
  const summary = decision.summary;
  const conclusion = decision.todayConclusion;
  return `<section class="decision-lead${compact ? " is-compact" : ""}">
    <div class="decision-lead-copy">
      <span class="model-code">DECISION SNAPSHOT · ${escapeHtml(formatDateTime(summary.observedAt))}</span>
      <h2>${escapeHtml(firstValue(conclusion?.decision, decisionConclusion(summary)))}</h2>
      <p>${escapeHtml(firstValue(conclusion?.why, summary.immediateTopics > 0 ? "按执行单推进，并持续监测停止条件。" : "没有足够证据时不给伪热点；先做可回收的备稿、补题和跨账号检索。"))}</p>
    </div>
    <div class="decision-kpis" aria-label="今日业务结论">
      <div><strong>${formatMetric(summary.immediateTopics)}</strong><span>立即推进</span></div>
      <div><strong>${formatMetric(summary.draftTopics)}</strong><span>备稿议题</span></div>
      <div><strong>${formatMetric(summary.executeCreators)}</strong><span>优先达人</span></div>
      <div><strong>${formatMetric(summary.watchCreators)}</strong><span>条件 / 观察</span></div>
      <div><strong>${formatMetric(summary.scoutCreators)}</strong><span>话题侦察</span></div>
      <div title="${escapeHtml(formatConfidence(summary.confidence))}"><strong>${escapeHtml(confidenceGrade(summary.confidence))}</strong><span>结论置信</span></div>
    </div>
    <div class="decision-boundary">${icon("shield-alert")}<span><strong>即时业务结论可直接执行</strong>；正式 A/B 白名单仍按完整审计门槛独立验收。当前正式白名单 ${formatMetric((data.summary?.formalWhitelistA || 0) + (data.summary?.formalWhitelistB || 0))}。本轮个人复核 ${formatMetric(summary.personalReviewed)}，机构参考 ${formatMetric(summary.referenceReviewed)}。${conclusion?.nextReview ? ` ${escapeHtml(conclusion.nextReview)}` : ""}</span></div>
  </section>`;
}

function renderEvidenceItem(item, index) {
  if (item && typeof item === "object") {
    const label = firstValue(item.label, item.title, item.source, item.name, `证据 ${index + 1}`);
    const url = firstValue(item.url, item.videoUrl, item.profileUrl);
    const windowLabel = item.evidenceWindow === "RECENT_72H"
      ? "近 72h 发布样本"
      : item.evidenceWindow === "HISTORICAL_90D"
        ? "90 天历史样本"
        : "";
    const source = [windowLabel, firstValue(item.note, item.observedAt, item.metric, "")].filter(Boolean).join(" · ");
    return `<li>${url ? `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}${icon("external-link")}</a>` : `<span>${escapeHtml(label)}</span>`}${source ? `<small>${escapeHtml(String(source))}</small>` : ""}</li>`;
  }
  return `<li><span>${escapeHtml(String(item || `证据 ${index + 1} 待补`))}</span></li>`;
}

function renderActionBriefs(decision) {
  const briefs = decision.actionBriefs.slice(0, 3);
  if (!briefs.length) {
    return `<section class="action-board">
      <div class="action-board-heading"><div><span class="model-code">TODAY / NO-GO</span><h2>今日执行单</h2></div><span>0 / 3</span></div>
      <div class="no-go-row">${icon("circle-alert")}<div><strong>当前没有达到发布条件的选题</strong><p>部门动作：优先补齐高归一化增速视频的标题与同议题账号证据；未出现跨账号扩散前，不包装为热点。</p></div><span class="status-chip status-watch">补证后再决策</span></div>
    </section>`;
  }
  return `<section class="action-board">
    <div class="action-board-heading"><div><span class="model-code">TODAY / MAX 3</span><h2>今日执行单</h2></div><span>${briefs.length} / 3</span></div>
    <div class="action-brief-list">${briefs.map((brief) => `<article class="action-brief-row">
      <div class="brief-order"><span>${String(brief.priority).padStart(2, "0")}</span>${statusChip(brief.status, /立即|发布|execute/i.test(brief.status) ? "status-pass" : "status-watch")}</div>
      <div class="brief-core"><span class="model-code">${escapeHtml(brief.topic)}</span><h3>${escapeHtml(brief.title)}</h3><p>${escapeHtml(brief.hook)}</p><div class="brief-next">${icon("clipboard-check")}<strong>下一步</strong><span>${escapeHtml(brief.nextAction)}</span></div></div>
      <div class="brief-facts">
        <dl><div><dt>受众</dt><dd>${escapeHtml(brief.audience)}</dd></div><div><dt>形式</dt><dd>${escapeHtml(brief.format)}</dd></div><div><dt>负责人 / 截止</dt><dd>${escapeHtml(brief.owner)} · ${escapeHtml(brief.deadline)}</dd></div><div><dt>发布窗口</dt><dd>${escapeHtml(brief.publishWindow)}</dd></div></dl>
      </div>
      <div class="brief-proof"><strong>可追溯证据</strong><ol>${brief.evidence.length ? brief.evidence.map(renderEvidenceItem).join("") : "<li><span>关键证据待补，不进入发布</span></li>"}</ol></div>
      <div class="brief-guard"><div><strong>风险</strong><p>${escapeHtml(brief.risk)}</p></div><div><strong>停止条件</strong><p>${escapeHtml(brief.stopCondition)}</p></div></div>
    </article>`).join("")}</div>
  </section>`;
}

function qualityMetric(value, label, formatter = formatMetric) {
  return `<span><small>${escapeHtml(label)}</small><b>${escapeHtml(formatter(value))}</b></span>`;
}

function qualitySort(a, b) {
  const actionDiff = (ACTION_META[a.action]?.rank ?? 9) - (ACTION_META[b.action]?.rank ?? 9);
  if (actionDiff) return actionDiff;
  return (numberOrNull(b.score) ?? -1) - (numberOrNull(a.score) ?? -1);
}

function renderQualityTable(decision) {
  const rows = decision.creatorDecisions.filter((item) => item.action === "EXECUTE" || item.action === "CONDITIONAL").sort(qualitySort);
  if (!rows.length) return `<section class="section-band">${renderEmpty("当前没有达到即时使用门槛的优质达人", "user-search")}</section>`;
  const desktopRows = rows.map((item) => `<tr data-open-id="${escapeHtml(item.creatorId)}">
    <td>${actionChip(item)}<span class="cell-secondary">置信 ${escapeHtml(item.confidence)} · 证据 ${escapeHtml(item.evidenceGrade)}</span></td>
    <td><span class="cell-primary">${escapeHtml(item.nickname)}</span><span class="cell-secondary mono">${escapeHtml(item.creatorId)} · ${escapeHtml(formatFollowers(item.followers))} 粉</span></td>
    <td><span class="quality-score">${escapeHtml(formatScore(item.score))}</span><span class="cell-secondary">证据代理分 / 100</span></td>
    <td><div class="quality-metric-stack">${qualityMetric(item.metrics.relevanceRatio, "相关", formatPercent)}${qualityMetric(item.metrics.corePracticeRatio, "实操", formatPercent)}${qualityMetric(item.metrics.sampleSize, "样本")}</div></td>
    <td><div class="quality-metric-stack">${qualityMetric(item.metrics.medianLikes, "中位赞")}${qualityMetric(item.metrics.medianDeep, "中位深互动")}${qualityMetric(item.metrics.medianSaveShare, "中位收藏转发")}</div></td>
    <td><span class="cell-primary mono">${escapeHtml(formatPercentile(item.metrics.peerPercentile))}</span><span class="cell-secondary">爆款率 ${escapeHtml(formatPercent(item.metrics.breakoutRate))}</span></td>
    <td><span class="cell-primary">${escapeHtml(String(firstValue(item.metrics.stability, "缺失")))}</span><span class="cell-secondary">最近更新 ${item.metrics.freshnessDays == null ? "缺失" : `${escapeHtml(formatMetric(item.metrics.freshnessDays))} 天前`}</span></td>
    <td><span class="cell-primary">${escapeHtml(firstValue(item.reasons[0], "等待表现证据"))}</span><span class="cell-secondary">${escapeHtml(firstValue(item.gaps[0], "暂无关键缺口"))}</span></td>
  </tr>`).join("");
  const mobileRows = rows.map((item) => `<article class="mobile-item quality-mobile-item" data-open-id="${escapeHtml(item.creatorId)}">
    <div class="mobile-item-header">${actionChip(item)}<span class="quality-score">${escapeHtml(formatScore(item.score))}</span></div>
    <h3>${escapeHtml(item.nickname)}</h3><p>${escapeHtml(firstValue(item.reasons[0], "等待表现证据"))}</p>
    <div class="mobile-facts"><div class="mobile-fact"><span>实操占比</span><strong>${escapeHtml(formatPercent(item.metrics.corePracticeRatio))}</strong></div><div class="mobile-fact"><span>同行表现</span><strong>${escapeHtml(formatPercentile(item.metrics.peerPercentile))}</strong></div></div>
    <span class="cell-secondary">置信 ${escapeHtml(item.confidence)} · ${escapeHtml(firstValue(item.gaps[0], "暂无关键缺口"))}</span>
  </article>`).join("");
  return `<section class="quality-register">
    <div class="section-title"><h2>即时优质达人</h2><span>直接使用 ${decision.summary.executeCreators} · 条件使用 ${decision.summary.conditionalCreators} · 重点观察 ${decision.summary.watchOnlyCreators}（不进入本表）</span></div>
    <div class="quality-principle">${icon("scan-line")}<span>业务处置与理由是主结论；证据代理分只辅助排序，可能低估依赖字幕或画面表达的达人。置信度和关键缺口必须同时查看。</span></div>
    <div class="data-region"><div class="data-table-wrap"><table class="data-table quality-table"><thead><tr><th>业务结论</th><th>达人</th><th>证据代理分</th><th>内容资格</th><th>近期基线</th><th>同行 / 爆款</th><th>稳定 / 新鲜</th><th>结论与缺口</th></tr></thead><tbody>${desktopRows}</tbody></table></div><div class="mobile-list">${mobileRows}</div></div>
  </section>`;
}

function renderTopicEvidence(video, index) {
  if (typeof video === "string") return `<li><span>${escapeHtml(video)}</span></li>`;
  const label = firstValue(video?.title, video?.label, video?.videoId, `证据视频 ${index + 1}`);
  const url = firstValue(video?.url, video?.videoUrl);
  const creator = firstValue(video?.creator, video?.nickname, "来源待补");
  const windowLabel = video?.evidenceWindow === "RECENT_72H" ? "近 72h 发布" : video?.evidenceWindow === "HISTORICAL_90D" ? "90 天历史" : "";
  return `<li>${url ? `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}${icon("external-link")}</a>` : `<span>${escapeHtml(label)}</span>`}<small>${escapeHtml([creator, windowLabel].filter(Boolean).join(" · "))}</small></li>`;
}

function topicDecisionClass(topic) {
  return /立即|执行|follow_now/i.test(topic.decision) ? "status-pass" : /停止|排除|stop/i.test(topic.decision) ? "status-conflict" : "status-watch";
}

function sourceIsBlocked(sourceStatus) {
  return sourceStatus?.captchaConfirmed || /BLOCKED|VERIFICATION/.test(sourceStatus?.scanStatus || "");
}

function renderTopicCandidates(decision, sourceStatus) {
  const topics = decision.topicCandidates;
  if (!topics.length) {
    if (sourceIsBlocked(sourceStatus)) {
      return `<section class="topic-radar-empty"><div><span class="model-code">TOPIC LAYER / SOURCE BLOCKED</span><h2>本轮跨账号热点不可判定</h2><p>平台验证拦截了当前指标复取；缺失值未估填，不能把采集失败解释为没有热点。</p></div>${statusChip("等待补证", "status-watch")}</section>`;
    }
    return `<section class="topic-radar-empty"><div><span class="model-code">TOPIC LAYER / NO-GO</span><h2>当前没有形成跨账号热点候选</h2><p>单视频增长仍保留在下方待核队列，不用单条高互动替代话题扩散结论。</p></div>${statusChip("立即跟进 0", "status-d")}</section>`;
  }
  return `<section class="topic-radar"><div class="section-title"><h2>话题候选</h2><span>${topics.length} 个议题 · 按业务决策排序</span></div><div class="topic-row-list">${topics.map((topic) => {
    return `<article class="topic-row">
    <div class="topic-row-head"><div><span class="model-code">${escapeHtml(topic.id)} · ${escapeHtml(topic.stage)}</span><h3>${escapeHtml(topic.name)}</h3></div><div>${statusChip(topic.decision, topicDecisionClass(topic))}<small>置信 ${escapeHtml(formatConfidence(topic.confidence))}</small></div></div>
    <div class="topic-kpis">${topic.normalizedVelocity != null ? qualityMetric(topic.normalizedVelocity, "归一化速度") : ""}${qualityMetric(topic.recent72hLifetimeInteractions, "72h 发布样本累计互动")}${qualityMetric(topic.recent72hLifetimeDeepInteractions, "72h 发布样本累计深互动")}${qualityMetric(topic.independentCreators, "72h 发布样本账号")}${qualityMetric(topic.maxCreatorContribution, "最大账号贡献", formatPercent)}${qualityMetric(firstValue(topic.recent72hVideos, topic.evidenceVideos.length), "72h 发布样本")}</div>
    <div class="topic-narrative"><div><strong>为什么现在</strong><p>${escapeHtml(topic.whyNow)}</p></div><div><strong>生产角度</strong><p>${escapeHtml(topic.angle)}</p></div><div><strong>下一次检查</strong><p>${escapeHtml(String(topic.nextCheck))}</p></div></div>
    <div class="topic-proof"><strong>跨账号证据</strong><ol>${topic.evidenceVideos.length ? topic.evidenceVideos.map(renderTopicEvidence).join("") : "<li><span>尚无跨账号证据</span></li>"}</ol></div>
    <div class="topic-guard"><span><strong>风险</strong>${escapeHtml(topic.risk)}</span><span><strong>停止条件</strong>${escapeHtml(topic.stopCondition)}</span></div>
  </article>`;
  }).join("")}</div></section>`;
}

function normalizedSignalVelocity(signal) {
  const direct = numberOrNull(signal?.normalizedDeepVelocityPer10kHour);
  if (direct != null) return direct;
  const deep = numberOrNull(signal?.deepIncrement);
  const followers = numberOrNull(signal?.followers);
  const hours = numberOrNull(signal?.elapsedHours);
  return deep != null && followers > 0 && hours > 0 ? deep / followers * 10000 / hours : null;
}

function renderMetricPair(signal, key, label) {
  const current = numberOrNull(signal.current?.[key]);
  const delta = numberOrNull(signal.delta?.[key]);
  return `<div class="signal-metric"><span>${escapeHtml(label)}</span><strong>${formatMetric(current ?? delta)}</strong><em>${current == null ? (delta == null ? "缺失" : "本轮增量") : formatDelta(delta)}</em></div>`;
}

function renderSingleVideoSignals(signalsInput, sourceStatus) {
  const signals = [...asArray(signalsInput)].sort((a, b) => (normalizedSignalVelocity(b) ?? -1) - (normalizedSignalVelocity(a) ?? -1));
  if (!signals.length && sourceIsBlocked(sourceStatus)) return `<section class="section-band"><div class="section-title"><h2>待核单视频</h2><span>本轮不可判定</span></div>${renderEmpty("平台验证拦截，当前单视频信号未取得", "shield-alert")}</section>`;
  if (!signals.length) return `<section class="section-band"><div class="section-title"><h2>待核单视频</h2><span>0 条</span></div>${renderEmpty("当前快照没有单视频增长信号", "activity")}</section>`;
  const visibleSignals = signals.slice(0, 12);
  return `<section class="single-signal-queue">
    <div class="section-title"><h2>待核单视频</h2><span>显示 ${visibleSignals.length} / ${signals.length} 条 · 不等于热点</span></div>
    <div class="single-signal-list">${visibleSignals.map((signal, index) => {
      const velocity = normalizedSignalVelocity(signal);
      return `<article class="single-signal-row">
        <div class="signal-rank"><span>${String(index + 1).padStart(2, "0")}</span><small>归一化排序</small></div>
        <div class="signal-identity"><span class="model-code">${escapeHtml(firstValue(signal.id, signal.videoId, "VIDEO"))} · ${escapeHtml(signal.creatorId)}</span><h3>${escapeHtml(signal.nickname)}</h3><p>${escapeHtml(signal.title || "作品标题未返回")}</p><div class="signal-links"><a class="command-button primary" href="${escapeHtml(safeUrl(signal.videoUrl))}" target="_blank" rel="noopener noreferrer">${icon("play")}查看视频</a><a class="command-button" href="${escapeHtml(safeUrl(signal.profileUrl))}" target="_blank" rel="noopener noreferrer">${icon("user-round")}查看达人</a></div></div>
        <div class="signal-velocity"><small>每万粉每小时深互动增量</small><strong>${velocity == null ? "缺失" : velocity.toFixed(2)}</strong><span>${escapeHtml(formatFollowers(signal.followers))} 粉 · ${escapeHtml(formatMetric(signal.elapsedHours))} 小时</span></div>
        <div class="signal-metric-grid">${renderMetricPair(signal, "digg_count", "点赞")}${renderMetricPair(signal, "comment_count", "评论")}${renderMetricPair(signal, "collect_count", "收藏")}${renderMetricPair(signal, "share_count", "转发")}</div>
        <div class="signal-assessment"><div>${statusChip(firstValue(signal.assessment, signal.semanticStatus === "SEMANTIC_BLOCKED" ? "语义待补" : "单视频续跟"), "status-watch")}<p>${escapeHtml(firstValue(signal.reason, signal.semanticStatus === "SEMANTIC_BLOCKED" ? "互动增速可见，但标题或字幕证据不足，不能聚类为热点。" : "当前仅证明单条视频有互动增量，尚未证明跨账号扩散。"))}</p></div><div><strong>下一步</strong><p>${escapeHtml(firstValue(signal.nextCheck, signal.semanticStatus === "SEMANTIC_BLOCKED" ? "补标题或字幕后做同议题检索；未出现新增主体前不进入热点。" : "复核同龄基线、同行分位和新增独立账号。"))}</p></div></div>
      </article>`;
    }).join("")}</div>
    ${signals.length > visibleSignals.length ? `<div class="signal-audit-tail">${icon("scan-line")}<span>默认只展示归一化速度前 ${visibleSignals.length} 条；其余 ${signals.length - visibleSignals.length} 条保留在审计数据中，不因页面折叠而删除。</span></div>` : ""}
  </section>`;
}

function creatorRealtimeSignals(videoSignals, creatorId) {
  return asArray(videoSignals).filter((signal) => signal.creatorId === creatorId);
}

function renderRealtimeHotspotCell(candidate, videoSignals, observedAt, sourceStatus) {
  const signals = creatorRealtimeSignals(videoSignals, candidate.id);
  const blocked = sourceIsBlocked(sourceStatus);
  if (!signals.length && blocked) return `${statusChip("本轮不可判定", "status-watch")}<span class="cell-secondary">平台验证拦截 · 缺失未估填</span>`;
  if (!signals.length) return `<span class="cell-primary mono">0 条</span><span class="cell-secondary">${escapeHtml(formatDateTime(observedAt))} 快照未发现</span>`;
  const velocity = normalizedSignalVelocity(signals[0]);
  return `${statusChip(`${signals.length} 条待核`, "status-watch")}<span class="cell-primary creator-hotspot-title">${escapeHtml(signals[0].title)}</span><span class="cell-secondary">归一化速度 ${velocity == null ? "缺失" : velocity.toFixed(2)}</span>`;
}

function candidateDecisionReasons(item, candidate) {
  const reasons = uniqueStrings([...asArray(item?.hardFailures), ...asArray(item?.gaps)]);
  if (!Number(candidate?.refetch?.successfulVideos)) reasons.push(`复取 0/${formatMetric(candidate?.refetch?.targetVideos)}`);
  return uniqueStrings(reasons);
}

function filterCandidates(data, filters, decisionMap) {
  const search = String(filters.search || "").trim().toLowerCase();
  return [...asArray(data.candidates)].filter((candidate) => {
    const item = decisionMap.get(candidate.id) || fallbackCreatorDecision(candidate);
    const searchValues = [candidate.nickname, candidate.id, candidate.dispositionLabel, candidate.formalStatus, item.actionLabel, ...asArray(candidate.tracks), ...candidateDecisionReasons(item, candidate)];
    const matchesSearch = !search || searchValues.some((value) => String(value || "").toLowerCase().includes(search));
    const matchesAction = !filters.action || filters.action === "all" || item.action === filters.action;
    const matchesDisposition = filters.disposition === "all" || candidate.autoDisposition === filters.disposition;
    const matchesTrack = filters.track === "all" || candidate.tracks?.includes(filters.track);
    const matchesRefetch = filters.refetch === "all" || candidate.refetchStatus === filters.refetch;
    return matchesSearch && matchesAction && matchesDisposition && matchesTrack && matchesRefetch;
  }).sort((a, b) => {
    const ad = decisionMap.get(a.id) || fallbackCreatorDecision(a);
    const bd = decisionMap.get(b.id) || fallbackCreatorDecision(b);
    return (ACTION_META[ad.action]?.rank ?? 9) - (ACTION_META[bd.action]?.rank ?? 9)
      || (numberOrNull(bd.score) ?? -1) - (numberOrNull(ad.score) ?? -1)
      || (DISPOSITION_ORDER[a.autoDisposition] ?? 9) - (DISPOSITION_ORDER[b.autoDisposition] ?? 9)
      || a.rank - b.rank;
  });
}

function option(value, current, label = value) {
  return `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderToolbar(data, filters, count) {
  const tracks = uniqueOptions(asArray(data.candidates).flatMap((candidate) => candidate.tracks || []));
  const refetchStatuses = uniqueOptions(asArray(data.candidates).map((candidate) => candidate.refetchStatus));
  return `<div class="toolbar creator-toolbar">
    <div class="filter-group">
      <label class="search-box">${icon("search")}<input type="search" data-filter="search" value="${escapeHtml(filters.search)}" placeholder="搜索达人、结论或降级原因"></label>
      <label class="filter-select">${icon("clipboard-check")}<select data-filter="action" aria-label="筛选业务结论"><option value="all">全部业务结论</option>${option("EXECUTE", filters.action, "直接使用")}${option("CONDITIONAL", filters.action, "条件使用")}${option("WATCH", filters.action, "重点观察")}${option("TOPIC_SCOUT", filters.action, "话题侦察")}${option("BACKFILL", filters.action, "优先补证")}${option("REFERENCE", filters.action, "机构参考")}${option("DEPRIORITIZE", filters.action, "降级/排除")}${option("POOL", filters.action, "候选池留档")}${option("UNKNOWN", filters.action, "证据不足")}</select></label>
      <label class="filter-select">${icon("list-filter")}<select data-filter="disposition" aria-label="筛选审核状态"><option value="all">全部审核状态</option>${option("READY_FOR_MANUAL_ROUND1", filters.disposition, "待人工首审")}${option("WATCH_SAMPLE_LT15", filters.disposition, "样本不足观察")}${option("NO_MATCHED_API_EVIDENCE", filters.disposition, "缺匹配作品证据")}${option("FAIL_AUTOMATED_GATE", filters.disposition, "自动门槛未通过")}</select></label>
      <label class="filter-select">${icon("tags")}<select data-filter="track" aria-label="筛选赛道"><option value="all">全部赛道</option>${tracks.map((track) => option(track, filters.track)).join("")}</select></label>
      <label class="filter-select">${icon("refresh-cw")}<select data-filter="refetch" aria-label="筛选复取状态"><option value="all">全部复取状态</option>${refetchStatuses.map((status) => option(status, filters.refetch)).join("")}</select></label>
    </div><span class="result-count">${count} / ${asArray(data.candidates).length} 位候选</span>
  </div>`;
}

function renderCandidateTable(candidates, videoSignals, observedAt, decisionMap, sourceStatus) {
  if (!candidates.length) return `<div class="data-region">${renderEmpty("当前筛选条件下没有候选达人", "user-search")}</div>`;
  const rows = candidates.map((candidate) => {
    const item = decisionMap.get(candidate.id) || fallbackCreatorDecision(candidate);
    const reasons = candidateDecisionReasons(item, candidate);
    return `<tr data-open-id="${escapeHtml(candidate.id)}">
      <td>${actionChip(item)}<span class="cell-secondary">代理分 ${escapeHtml(formatScore(item.score))} · 置信 ${escapeHtml(item.confidence)}</span></td>
      <td><span class="cell-primary">${escapeHtml(candidate.nickname)}</span><span class="cell-secondary mono">${escapeHtml(candidate.id)} · 原排名 ${escapeHtml(candidate.rank)}</span></td>
      <td><span class="cell-primary mono">${escapeHtml(formatFollowers(candidate.followers))}</span><div class="tag-stack">${asArray(candidate.tracks).map((track) => `<span class="tag">${escapeHtml(track)}</span>`).join("") || "缺失"}</div></td>
      <td>${renderEvidenceRail(candidate)}<span class="cell-secondary">相关 ${formatPercent(candidate.gates?.relevantRatio)} · 实操 ${formatPercent(candidate.gates?.corePracticeLowerBound)}</span></td>
      <td><span class="cell-primary">${escapeHtml(formatPercentile(item.metrics.peerPercentile))}</span><span class="cell-secondary">中位深互动 ${formatMetric(item.metrics.medianDeep)} · 爆款率 ${formatPercent(item.metrics.breakoutRate)}</span></td>
      <td>${renderRealtimeHotspotCell(candidate, videoSignals, observedAt, sourceStatus)}</td>
      <td><span class="cell-primary candidate-gap">${escapeHtml(firstValue(reasons[0], "暂无关键缺口"))}</span><span class="cell-secondary">${escapeHtml(firstValue(reasons[1], item.reasons[0], "等待下一轮证据"))}</span></td>
      <td><span class="cell-primary">${escapeHtml(firstValue(item.reasons[0], item.action === "DEPRIORITIZE" ? "停止优先跟踪" : "补齐证据后复核"))}</span><span class="cell-secondary">${escapeHtml(candidate.dispositionLabel)}</span></td>
    </tr>`;
  }).join("");
  const mobile = candidates.map((candidate) => {
    const item = decisionMap.get(candidate.id) || fallbackCreatorDecision(candidate);
    const reasons = candidateDecisionReasons(item, candidate);
    return `<article class="mobile-item creator-mobile-item" data-open-id="${escapeHtml(candidate.id)}"><div class="mobile-item-header">${actionChip(item)}<span class="mono">${escapeHtml(formatFollowers(candidate.followers))} 粉</span></div><h3>${escapeHtml(candidate.nickname)}</h3><div class="tag-stack">${asArray(candidate.tracks).map((track) => `<span class="tag">${escapeHtml(track)}</span>`).join("")}</div>${renderEvidenceRail(candidate, true)}<p><strong>结论：</strong>${escapeHtml(firstValue(item.reasons[0], item.actionLabel))}</p><p class="candidate-gap"><strong>降级/差距：</strong>${escapeHtml(firstValue(reasons[0], "暂无关键缺口"))}</p></article>`;
  }).join("");
  return `<div class="data-region"><div class="data-table-wrap"><table class="data-table creator-table decision-candidate-table"><thead><tr><th>业务结论</th><th>达人</th><th>体量 / 赛道</th><th>资格证据</th><th>表现质量</th><th>单视频信号</th><th>降级 / 差距</th><th>下一步</th></tr></thead><tbody>${rows}</tbody></table></div><div class="mobile-list">${mobile}</div></div>`;
}

function coverageStat(label, value, note, tone = "") {
  return `<div class="coverage-stat ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`;
}

function renderSamplingRisk(decision) {
  const risk = decision.samplingRisk;
  if (!risk) return "";
  return `<section class="sampling-risk-band">
    <div>${icon("shield-alert")}<span><strong>样本集中度风险</strong><p>${escapeHtml(firstValue(risk.conclusion, "当前增量样本集中，不能外推为跨账号热点。"))}</p></span></div>
    <dl><div><dt>成功复取</dt><dd>${formatMetric(risk.successfulRefetchRows)}</dd></div><div><dt>有效增量</dt><dd>${formatMetric(risk.validIncrementRows)}</dd></div><div><dt>头部账号行占比</dt><dd>${formatPercent(risk.leadingCreatorRowShare)}</dd></div><div><dt>头部账号深互动占比</dt><dd>${formatPercent(risk.leadingCreatorDeepShare)}</dd></div></dl>
  </section>`;
}

function renderAuthoritySources(decision) {
  const sources = decision.authoritySources;
  if (!sources) return "";
  const policy = sources.policy || {};
  return `<section class="section-band authority-source-band"><div class="section-title"><h2>权威信源池</h2><span>共 ${formatMetric(sources.total)} 个 · 官方 ${formatMetric(sources.official)} · 机构 ${formatMetric(sources.institutional)}</span></div><div class="methodology-list">${Object.entries(policy).map(([key, value]) => `<div><span class="mono">${escapeHtml(key)}</span><p>${escapeHtml(String(value))}</p></div>`).join("")}</div></section>`;
}

function renderEvidenceAndRules(data, decision, index) {
  const summary = data.summary || {};
  const audit = data.audit || {};
  const sourceStatus = data.sourceStatus || {};
  const gateRows = GATE_RULES.map(([label, threshold, key]) => `<tr><td>${escapeHtml(label)}</td><td class="mono">${escapeHtml(threshold)}</td><td>${key === "corePracticeLowerBound" ? "资格硬门槛；低于阈值直接降级，不由相关性或粉丝数补偿" : "缺失即降低证据等级，不按 0 估填"}</td></tr>`).join("");
  const methodology = decision.methodology && typeof decision.methodology === "object" ? Object.entries(decision.methodology) : [];
  return `${sourceStatus.captchaConfirmed ? `<div class="captcha-banner" role="status">${icon("shield-alert")}<div><strong>公开分享页触发平台验证码，批量复取受限</strong><p>未绕过验证码、未读取或导出 Cookie；失败记录保持 null。即时业务结论已按证据等级降级。</p></div></div>` : ""}
    ${renderSamplingRisk(decision)}
    <section class="coverage-grid" aria-label="数据覆盖">
      ${coverageStat("目标视频", formatMetric(summary.targetVideos), "本轮计划复取")}${coverageStat("成功复取", formatMetric(summary.successfulVideos), `${formatMetric(summary.creatorsWithCurrentMetrics)} 位达人有当前指标`, "is-pass")}${coverageStat("失败记录", formatMetric(summary.failedVideos), "当前值未估填", summary.failedVideos ? "is-danger" : "")}${coverageStat("播放量可用", sourceStatus.valuesImputed === false ? "0" : formatMetric(summary.playableVideos), "缺失时不计算触达率", "is-warning")}${coverageStat("开放冲突", formatMetric(summary.openConflicts), "未解决时不输出确定结论", summary.openConflicts ? "is-warning" : "is-pass")}${coverageStat("结论置信", confidenceGrade(decision.summary.confidence), formatConfidence(decision.summary.confidence))}
    </section>
    <section class="section-band creator-rule-model"><div class="model-rule-heading"><div><span class="model-code">QUALIFICATION → QUALITY → ACTION</span><h3>先过资格门槛，再比较质量</h3></div><p>即时业务名单不等待 Day 7，但绝不降低内容资格标准。相关性只能证明“属于这个领域”，不能证明“这个达人值得跟”。</p></div><div class="rules-table-wrap"><table class="data-table rules-table"><thead><tr><th>资格硬门槛</th><th>阈值</th><th>执行方式</th></tr></thead><tbody>${gateRows}</tbody></table></div></section>
    <section class="rule-flow decision-rule-flow"><div><span>30</span><strong>内容实用性</strong><p>实操密度、原创证据、受众匹配。</p></div><div><span>30</span><strong>归一化表现</strong><p>同体量、同赛道、同发布龄比较。</p></div><div><span>15</span><strong>稳定性</strong><p>最近作品中位数与波动。</p></div><div><span>15</span><strong>收藏转发</strong><p>深互动而非只看点赞。</p></div><div><span>10</span><strong>热点领先</strong><p>是否多次提前出现有效信号。</p></div></section>
    ${renderAuthoritySources(decision)}
    <section class="section-band"><div class="section-title"><h2>方法与限制</h2><span>每条结论必须可追溯</span></div>${methodology.length ? `<div class="methodology-list">${methodology.map(([key, value]) => `<div><span class="mono">${escapeHtml(key)}</span><p>${escapeHtml(String(value))}</p></div>`).join("")}</div>` : ""}<div class="limitation-list">${decision.limitations.map((item, itemIndex) => `<div><span class="mono">${String(itemIndex + 1).padStart(2, "0")}</span><p>${escapeHtml(item)}</p></div>`).join("") || "<div><span class=\"mono\">00</span><p>当前未登记额外限制。</p></div>"}</div></section>
    <section class="section-band"><div class="section-title"><h2>审计快照</h2><span>即时结论与正式验收分开</span></div><div class="coverage-facts">${factGrid([["快照轮次", escapeHtml(firstValue(audit.snapshotRound, "缺失"))],["观察时间", escapeHtml(formatDateTime(decision.summary.observedAt))],["缺失值策略", "null，不估填"],["正式白名单", `${formatMetric((summary.formalWhitelistA || 0) + (summary.formalWhitelistB || 0))} 位`],["即时优先达人", `${formatMetric(decision.summary.executeCreators)} 位`],["完整性校验", audit.snapshotSha256 ? statusChip("已记录 SHA-256", "status-pass") : statusChip("待记录", "status-watch")]])}</div></section>
    ${renderArchive(index)}`;
}

function renderArchive(index) {
  const dates = asArray(index?.dates);
  if (!dates.length) return "";
  return `<section class="section-band"><div class="section-title"><h2>达人快照归档</h2><span>历史数据不可覆盖</span></div><div class="archive-grid">${dates.map((item) => `<button type="button" class="archive-item" data-route-date="${escapeHtml(item.date)}"><time>${escapeHtml(item.date)}</time><p>候选 ${formatMetric(item.candidateCreators)} 位 · 待首审 ${formatMetric(item.manualRound1Queue)} 位</p><p>正式白名单 ${formatMetric(item.formalWhitelist)} · 合格话题 ${formatMetric(item.qualifiedTopics)}</p></button>`).join("")}</div></section>`;
}

function renderCreatorRealtimeHotspots(candidate, data, decision) {
  const signals = creatorRealtimeSignals(decision?.singleVideoSignals || data?.videoSignals, candidate.id);
  const blocked = sourceIsBlocked(data?.sourceStatus);
  if (!signals.length && blocked) return `<div class="drawer-hotspot-empty"><strong>本轮实时热点不可判定</strong><p>截至 ${escapeHtml(formatDateTime(data?.observedAt))}，平台验证拦截了复取；缺失值未估填，不能写成 0 条热点。</p></div>`;
  if (!signals.length) return `<div class="drawer-hotspot-empty"><strong>当前快照 0 条</strong><p>截至 ${escapeHtml(formatDateTime(data?.observedAt))}，未发现该达人的单视频续跟信号或跨账号话题。</p></div>`;
  return `<div class="drawer-hotspot-summary"><span>${statusChip(`${signals.length} 条待核单视频`, "status-watch")}</span><span>跨账号热点需另行验证</span></div><div class="drawer-hotspot-list">${signals.map((signal) => `<article><div><span class="model-code">${escapeHtml(firstValue(signal.id, signal.videoId, "VIDEO"))} · ${escapeHtml(firstValue(signal.assessment, signal.semanticStatus, "待核"))}</span><strong>${escapeHtml(signal.title)}</strong></div><div class="drawer-hotspot-metrics"><span>点赞${signal.current ? "" : "增量"} <b>${formatMetric(firstValue(signal.current?.digg_count, signal.delta?.digg_count))}</b></span><span>收藏${signal.current ? "" : "增量"} <b>${formatMetric(firstValue(signal.current?.collect_count, signal.delta?.collect_count))}</b></span><span>转发${signal.current ? "" : "增量"} <b>${formatMetric(firstValue(signal.current?.share_count, signal.delta?.share_count))}</b></span><span>归一化速度 <b>${normalizedSignalVelocity(signal)?.toFixed(2) || "缺失"}</b></span></div><p>${escapeHtml(firstValue(signal.reason, "当前仅证明单条视频有互动增量，尚未证明跨账号扩散。"))}</p><a class="source-link" href="${escapeHtml(safeUrl(signal.videoUrl))}" target="_blank" rel="noopener noreferrer"><span>查看原视频</span>${icon("external-link")}</a></article>`).join("")}</div>`;
}

export function renderCreatorPage({ data, index, view, filters }) {
  const decision = normalizeDecision(data);
  const decisionMap = decisionByCreator(decision);
  const heading = renderPageHeading({
    eyebrow: `CREATOR DECISION DESK / ${data.date} / ${data.publicationStatus === "TRIAL_PREVIEW" ? "TRIAL" : "LIVE"}`,
    title: "抖音达人白名单库及热点判断",
    subtitle: "先给业务结论，再展开达人、话题与证据；即时行动名单不等于正式白名单",
    views: creatorViews,
    activeView: view,
  });
  let content;
  if (view === "quality") content = `${renderDecisionLead(decision, data, true)}${renderQualityTable(decision)}`;
  else if (view === "topics") content = `${renderDecisionLead(decision, data, true)}${renderTopicCandidates(decision, data.sourceStatus)}${renderSingleVideoSignals(decision.singleVideoSignals, data.sourceStatus)}`;
  else if (view === "candidates") {
    const filtered = filterCandidates(data, filters, decisionMap);
    content = `${renderDecisionLead(decision, data, true)}${renderToolbar(data, filters, filtered.length)}${renderCandidateTable(filtered, decision.singleVideoSignals, decision.summary.observedAt, decisionMap, data.sourceStatus)}`;
  } else if (view === "evidence") content = renderEvidenceAndRules(data, decision, index);
  else content = `${renderDecisionLead(decision, data)}${renderActionBriefs(decision)}<section class="overview-followup"><div><span class="model-code">NEXT / PEOPLE</span><h2>优质达人</h2><p>优先使用 ${decision.summary.executeCreators} 位，条件与观察 ${decision.summary.watchCreators} 位；业务处置优先，证据代理分只辅助排序。</p><button type="button" class="command-button" data-view="quality">${icon("users-round")}查看达人结论</button></div><div><span class="model-code">NEXT / TOPICS</span><h2>热点雷达</h2><p>立即推进 ${decision.summary.immediateTopics} 个，条件议题 ${decision.summary.draftTopics} 个；单视频与跨账号话题分层展示。</p><button type="button" class="command-button" data-view="topics">${icon("radio-tower")}查看话题证据</button></div></section>`;
  return `${heading}${content}`;
}

export function renderCreatorDetail(candidate, data) {
  const decision = normalizeDecision(data);
  const item = decisionByCreator(decision).get(candidate.id) || fallbackCreatorDecision(candidate);
  const gateEvidence = gateSignals(candidate);
  const gates = candidate.gates || {};
  const refetch = candidate.refetch || {};
  const gaps = candidateDecisionReasons(item, candidate);
  const gateFacts = factGrid([
    ["90 天有效作品", `${formatMetric(gates.validVideos90d)} 条 / 门槛 15`],
    ["相关内容占比", `${formatPercent(gates.relevantRatio)} / 门槛 60%`],
    ["核心实操占比", `${formatPercent(gates.corePracticeLowerBound)} / 门槛 40%`],
    ["60 天相关作品", `${formatMetric(gates.relatedVideos60d)} 条 / 门槛 6`],
    ["最近相关作品", gates.latestRelatedAgeDays == null ? "缺失" : `${escapeHtml(gates.latestRelatedAgeDays)} 天前`],
    ["业务结论", actionChip(item)],
  ]);
  const qualityFacts = factGrid([
    ["证据代理分", formatScore(item.score)],
    ["置信 / 证据", `${escapeHtml(item.confidence)} / ${escapeHtml(item.evidenceGrade)}`],
    ["同行表现", escapeHtml(formatPercentile(item.metrics.peerPercentile))],
    ["近期中位点赞", formatMetric(item.metrics.medianLikes)],
    ["近期中位深互动", formatMetric(item.metrics.medianDeep)],
    ["爆款率", formatPercent(item.metrics.breakoutRate)],
  ]);
  const signalList = `<div class="drawer-signal-list">${gateEvidence.map((signal) => `<div class="${signal.pass ? "is-pass" : "is-missing"}"><span>${signal.pass ? icon("check") : icon("minus")}</span><strong>${escapeHtml(signal.label)}</strong><small>${signal.pass ? "已达标" : "未达标或缺失"}</small></div>`).join("")}</div>`;
  const profileUrl = safeUrl(candidate.profileUrl);
  const html = `<div class="drawer-actions"><a class="command-button primary" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">${icon("external-link")}打开抖音主页</a><button class="command-button" type="button" data-drawer-command="copy">${icon("copy")}复制执行摘要</button></div>
    <div class="drawer-decision ${item.action === "DEPRIORITIZE" ? "is-danger" : item.action === "EXECUTE" ? "is-pass" : "is-watch"}"><div>${actionChip(item)}<strong>${escapeHtml(firstValue(item.reasons[0], item.action === "DEPRIORITIZE" ? "当前不进入优先名单" : "按条件使用"))}</strong></div><p>${escapeHtml(firstValue(gaps[0], "暂无关键缺口"))}</p></div>
    ${detailSection("即时业务结论", "clipboard-check", `${qualityFacts}<div class="drawer-decision-notes"><strong>推荐理由</strong>${listHtml(item.reasons, "尚无足够理由")}<strong>降级与缺口</strong>${listHtml(gaps, "暂无关键缺口")}</div>`)}
    ${detailSection("达人事实", "user-round", factGrid([["候选 ID", `<span class="mono">${escapeHtml(candidate.id)}</span>`],["粉丝快照", `${escapeHtml(formatFollowers(candidate.followers))}（${formatMetric(candidate.followers)}）`],["候选赛道", escapeHtml(asArray(candidate.tracks).join("、") || "缺失")],["匹配作品", `${formatMetric(candidate.videosLoaded)} 条`],["原候选排名", formatMetric(candidate.rank)]]))}
    ${detailSection("资格硬门槛", "shield-alert", `${renderEvidenceRail(candidate)}<div class="drawer-gate-facts">${gateFacts}</div>`)}
    ${detailSection("证据状态", "scan-line", signalList)}
    ${detailSection("复取表现", "refresh-cw", factGrid([["目标视频", formatMetric(refetch.targetVideos)],["成功复取", formatMetric(refetch.successfulVideos)],["有效增量", formatMetric(refetch.validIncrements)],["计数回落", formatMetric(refetch.countDecreases)],["复取状态", escapeHtml(candidate.refetchStatus)],["播放量", "缺失时不估填"]]))}
    ${detailSection("实时热点与单视频", "radio-tower", renderCreatorRealtimeHotspots(candidate, data, decision))}`;
  const copyText = `【达人执行结论｜${candidate.nickname}】\n业务结论：${item.actionLabel}\n证据代理分：${formatScore(item.score)}\n置信度：${item.confidence}\n核心理由：${firstValue(item.reasons[0], "证据不足")}\n关键缺口：${firstValue(gaps[0], "无")}\n粉丝快照：${formatMetric(candidate.followers)}\n相关占比：${formatPercent(gates.relevantRatio)}\n核心实操：${formatPercent(gates.corePracticeLowerBound)}\n同行表现：${formatPercentile(item.metrics.peerPercentile)}\n主页：${profileUrl}`;
  return { eyebrow: `${candidate.id} · ${item.actionLabel}`, title: candidate.nickname, html, copyText };
}
