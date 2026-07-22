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
import { normalizeTopicWhitelistPayload } from "./topic-whitelist.js";

export const creatorViews = [
  { id: "overview", label: "今日决策" },
  { id: "quality", label: "优质达人" },
  { id: "resonance", label: "共振白名单" },
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

const QUALITY_LANE_META = {
  Q0_HIGH_POTENTIAL_TOP_UP: { label: "Q0 高潜补样本", className: "status-pass" },
  Q1_MANUAL_SEMANTIC_OR_ACTIVITY_RECHECK: { label: "Q1 语义 / 活跃复核", className: "status-watch" },
  Q1_OVERFLOW_CONTENT_COLLECTION: { label: "Q1 外部线索采集", className: "status-d" },
  Q2_IDENTITY_OR_RISK_REVIEW: { label: "Q2 身份 / 风险复核", className: "status-watch" },
  Q3_HOLD: { label: "Q3 暂停投入", className: "status-conflict" },
};

const QUALITY_ACTION_LABELS = {
  TOP_UP_SAMPLE_THEN_FULL_MANUAL_REVIEW: "补齐至 15 条后进入完整人工首审",
  MANUAL_RISK_CONTEXT_REVIEW_THEN_TOP_UP_SAMPLE: "先核风险词语境，再补齐样本",
  RECHECK_SUBTITLE_SEMANTICS_AND_ACTIVITY: "复核字幕、画面与 60 天活跃度",
  RECHECK_RISK_CONTEXT_SUBTITLE_SEMANTICS_AND_ACTIVITY: "先核风险语境，再复核字幕与活跃度",
  MANUAL_RISK_REVIEW_BEFORE_ANY_TOP_UP: "先排除违规玩法，再决定是否补样",
  MANUAL_SEMANTIC_REVIEW_BEFORE_TOP_UP: "先核核心实操语义，再决定是否补样",
  RECOVER_ACCOUNT_IDENTITY_AND_SAMPLE: "恢复稳定账号身份与作品样本",
  VERIFY_IDENTITY_BEFORE_90D_COLLECTION: "先核账号身份，再采集 90 天作品",
  COLLECT_PROFILE_AND_90D_SAMPLE_NO_QUALITY_CLAIM: "采集主页与 90 天作品，不作质量结论",
  HOLD_DUPLICATE_SEARCH_LEAD: "重复线索，停止重复采集",
  HOLD_GENERIC_SEARCH_LEAD: "泛化搜索线索，暂停投入",
  HOLD_IDENTITY_OR_COMMERCIAL_RISK: "机构或商业获客身份，暂停投入",
  HOLD_INSTITUTION_OR_COMMERCIAL_LEAD: "机构或商业线索，暂停投入",
  HOLD_LOW_QUALITY_OR_GATE_DISTANCE: "质量或硬门槛距离过大，暂停投入",
  HOLD_NO_EVIDENCE_GENERIC_IDENTITY: "无作品证据且身份泛化，暂停投入",
  HOLD_WEAK_DOMAIN_MATCH: "领域匹配弱，暂停投入",
};

const QUALITY_STATUS_LABELS = {
  WATCH_SAMPLE_LT15: "有效样本少于 15 条",
  FAIL_AUTOMATED_GATE: "自动硬门槛未通过",
  NO_MATCHED_API_EVIDENCE: "缺少匹配作品证据",
  SEARCH_LEAD_NOT_IN_CANDIDATE_POOL: "外部搜索线索，尚未进入候选池",
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
  const rawTopicWhitelist = firstValue(data?.topicWhitelist, raw?.topicWhitelist, {});
  const topicWhitelist = normalizeTopicWhitelistPayload(rawTopicWhitelist);
  topicWhitelist.creatorCrossValidation = firstValue(
    rawTopicWhitelist?.creatorCrossValidation,
    rawTopicWhitelist?.creatorValidation,
    rawTopicWhitelist?.creatorValidations,
    rawTopicWhitelist?.creatorValidationMatrix,
    [],
  );
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
    topicWhitelist,
    actionBriefs,
    singleVideoSignals,
    todayConclusion: raw.todayConclusion || null,
    samplingRisk: raw.samplingRisk || null,
    authoritySources: raw.authoritySources || null,
    methodology: firstValue(raw.methodology, data?.methodology, {}),
    limitations: uniqueStrings([...asArray(data?.limitations), ...asArray(raw.limitations)]),
    qualityReview: data?.qualityReview && Array.isArray(data.qualityReview.entries)
      ? data.qualityReview
      : null,
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
  const reviewSummary = decision.qualityReview?.summary;
  const kpis = reviewSummary
    ? `<div><strong>${formatMetric(summary.immediateTopics)}</strong><span>立即推进</span></div>
       <div><strong>${formatMetric(summary.draftTopics)}</strong><span>备稿议题</span></div>
       <div><strong>${formatMetric(reviewSummary.high_potential_top_up)}</strong><span>Q0 高潜补样</span></div>
       <div><strong>${formatMetric(reviewSummary.manual_semantic_or_activity_recheck)}</strong><span>Q1 语义复核</span></div>
       <div><strong>${formatMetric(reviewSummary.held)}</strong><span>Q3 暂停投入</span></div>
       <div title="${escapeHtml(formatConfidence(summary.confidence))}"><strong>${escapeHtml(confidenceGrade(summary.confidence))}</strong><span>结论置信</span></div>`
    : `<div><strong>${formatMetric(summary.immediateTopics)}</strong><span>立即推进</span></div>
       <div><strong>${formatMetric(summary.draftTopics)}</strong><span>备稿议题</span></div>
       <div><strong>${formatMetric(summary.executeCreators)}</strong><span>优先达人</span></div>
       <div><strong>${formatMetric(summary.watchCreators)}</strong><span>条件 / 观察</span></div>
       <div><strong>${formatMetric(summary.scoutCreators)}</strong><span>话题侦察</span></div>
       <div title="${escapeHtml(formatConfidence(summary.confidence))}"><strong>${escapeHtml(confidenceGrade(summary.confidence))}</strong><span>结论置信</span></div>`;
  const reviewBoundary = reviewSummary
    ? `质量优先队列 ${formatMetric(reviewSummary.queue_entries)} 条，仅 ${formatMetric(reviewSummary.high_potential_top_up)} 位进入高潜补样；该队列不改变候选状态。`
    : `本轮个人复核 ${formatMetric(summary.personalReviewed)}，机构参考 ${formatMetric(summary.referenceReviewed)}。`;
  return `<section class="decision-lead${compact ? " is-compact" : ""}">
    <div class="decision-lead-copy">
      <span class="model-code">DECISION SNAPSHOT · ${escapeHtml(formatDateTime(summary.observedAt))}</span>
      <h2>${escapeHtml(firstValue(conclusion?.decision, decisionConclusion(summary)))}</h2>
      <p>${escapeHtml(firstValue(conclusion?.why, summary.immediateTopics > 0 ? "按执行单推进，并持续监测停止条件。" : "没有足够证据时不给伪热点；先做可回收的备稿、补题和跨账号检索。"))}</p>
    </div>
    <div class="decision-kpis" aria-label="今日业务结论">
      ${kpis}
    </div>
    <div class="decision-boundary">${icon("shield-alert")}<span><strong>即时业务结论可直接执行</strong>；正式 A/B 白名单仍按完整审计门槛独立验收。当前正式白名单 ${formatMetric((data.summary?.formalWhitelistA || 0) + (data.summary?.formalWhitelistB || 0))}。${reviewBoundary}${conclusion?.nextReview ? ` ${escapeHtml(conclusion.nextReview)}` : ""}</span></div>
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

function qualityLaneChip(item) {
  const meta = QUALITY_LANE_META[item?.lane] || { label: firstValue(item?.lane, "未分层"), className: "status-d" };
  return statusChip(meta.label, meta.className);
}

function qualityReviewAction(item) {
  return firstValue(QUALITY_ACTION_LABELS[item?.required_action_v2], item?.required_action_v2, "等待人工复核");
}

function qualityReviewScore(item) {
  const quality = numberOrNull(item?.quality_proxy_score);
  const discovery = numberOrNull(item?.discovery_priority_score);
  if (quality != null) return `<strong>${escapeHtml(formatScore(quality))}</strong><span>质量代理分</span>`;
  if (discovery != null) return `<strong>${escapeHtml(formatScore(discovery))}</strong><span>发现优先分</span>`;
  return `<strong>—</strong><span>无质量分</span>`;
}

function qualityReviewEvidence(item) {
  const gates = item?.gates || {};
  const metrics = item?.metrics || {};
  const sample = numberOrNull(metrics.sampleSize);
  if (sample == null) return `<span class="cell-primary">作品样本缺失</span><span class="cell-secondary">禁止估算内容质量</span>`;
  return `<span class="cell-primary">样本 ${escapeHtml(formatMetric(sample))} · 相关 ${escapeHtml(formatPercent(gates.relevant_ratio))} · 实操 ${escapeHtml(formatPercent(gates.core_practice_title_lower_bound))}</span><span class="cell-secondary">60 天相关 ${escapeHtml(formatMetric(gates.related_videos_60d))} · 最近 ${gates.latest_related_age_days == null ? "缺失" : `${escapeHtml(formatMetric(gates.latest_related_age_days))} 天前`}</span>`;
}

function renderQualityReviewRows(rows) {
  const desktopRows = rows.map((item) => {
    const identity = firstValue(item.candidate_id, item.lead_id, item.creator_id, "未知账号");
    const open = item.candidate_id ? ` data-open-id="${escapeHtml(item.candidate_id)}"` : "";
    const profileUrl = safeUrl(item.profile_url);
    const reasons = asArray(item.reason_codes);
    return `<tr${open}>
      <td>${qualityLaneChip(item)}<span class="cell-secondary mono">${escapeHtml(item.queue_id_v2)}</span></td>
      <td><span class="cell-primary">${escapeHtml(item.nickname)}</span><span class="cell-secondary mono">${escapeHtml(identity)} · ${escapeHtml(formatFollowers(item.followers_snapshot))} 粉</span>${profileUrl !== "#" ? `<a class="table-link" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">${icon("external-link")}抖音主页</a>` : ""}</td>
      <td><span class="quality-review-score">${qualityReviewScore(item)}</span>${qualityReviewEvidence(item)}</td>
      <td><span class="cell-primary">${escapeHtml(qualityReviewAction(item))}</span><span class="cell-secondary">${escapeHtml(firstValue(QUALITY_STATUS_LABELS[item.current_status], item.current_status, "状态缺失"))}</span></td>
      <td><span class="cell-primary">${escapeHtml(firstValue(reasons[0], "等待补证"))}</span><span class="cell-secondary">${escapeHtml(firstValue(reasons[1], "未记录第二条原因"))}</span></td>
    </tr>`;
  }).join("");
  const mobileRows = rows.map((item) => {
    const identity = firstValue(item.candidate_id, item.lead_id, item.creator_id, "未知账号");
    const open = item.candidate_id ? ` data-open-id="${escapeHtml(item.candidate_id)}"` : "";
    const reasons = asArray(item.reason_codes);
    return `<article class="mobile-item quality-review-mobile"${open}>
      <div class="mobile-item-header">${qualityLaneChip(item)}<span class="model-code">${escapeHtml(item.queue_id_v2)}</span></div>
      <h3>${escapeHtml(item.nickname)}</h3><p>${escapeHtml(qualityReviewAction(item))}</p>
      <div class="mobile-facts"><div class="mobile-fact"><span>账号</span><strong>${escapeHtml(identity)}</strong></div><div class="mobile-fact"><span>评分</span><strong>${escapeHtml(formatScore(firstValue(item.quality_proxy_score, item.discovery_priority_score)))}</strong></div></div>
      <span class="cell-secondary">${escapeHtml(firstValue(reasons[0], "等待补证"))}</span>
    </article>`;
  }).join("");
  return `<div class="data-region"><div class="data-table-wrap"><table class="data-table quality-review-table"><thead><tr><th>复核层级</th><th>达人 / 线索</th><th>证据</th><th>下一步</th><th>判定原因</th></tr></thead><tbody>${desktopRows}</tbody></table></div><div class="mobile-list">${mobileRows}</div></div>`;
}

function renderQualityReview(review) {
  if (!review) return "";
  const summary = review.summary || {};
  const entries = asArray(review.entries);
  const focusRows = entries.filter((item) => item.lane !== "Q3_HOLD" && numberOrNull(item.quality_proxy_score) != null);
  const source = numberOrNull(summary.source_entries) || entries.length || 1;
  const steps = [
    ["Q0", "高潜补样", summary.high_potential_top_up, "is-q0"],
    ["Q1", "语义复核", summary.manual_semantic_or_activity_recheck, "is-q1"],
    ["EXT", "外部采集", summary.overflow_content_collection, "is-ext"],
    ["Q2", "身份 / 风险", summary.identity_or_risk_review, "is-q2"],
    ["Q3", "暂停投入", summary.held, "is-q3"],
  ];
  const funnel = steps.map(([code, label, value, tone]) => {
    const count = numberOrNull(value) || 0;
    const share = Math.max(0, Math.min(100, count / source * 100));
    return `<div class="quality-funnel-step ${tone}"><span class="model-code">${code}</span><strong>${formatMetric(count)}</strong><small>${escapeHtml(label)}</small><span class="quality-funnel-bar"><i style="width:${share.toFixed(2)}%"></i></span></div>`;
  }).join("");
  return `<section class="quality-review-register">
    <div class="section-title"><h2>质量优先复核队列</h2><span>${formatMetric(summary.queue_entries)} 条全量保留 · 观察 ${escapeHtml(formatDateTime(review.observed_at))}</span></div>
    <div class="quality-review-boundary">${icon("shield-check")}<span><strong>当前结论：</strong>只有 ${formatMetric(summary.high_potential_top_up)} 位值得优先补样本；${formatMetric(summary.held)} 位暂停投入。风险词命中必须人工核验语境，不自动淘汰，也不能绕过合规门槛。</span></div>
    <div class="quality-funnel" aria-label="质量优先审核漏斗">${funnel}</div>
    <div class="quality-focus-heading"><div><span class="model-code">NEXT ACTION / ${formatMetric(focusRows.length)}</span><h3>有质量证据的优先复核</h3></div><span>质量代理分仅决定补证顺序，不是 D / M 分，也不是白名单评级</span></div>
    ${renderQualityReviewRows(focusRows)}
    <details class="quality-review-full"><summary>${icon("chevron-down")}<span>展开全部 ${formatMetric(entries.length)} 条审核队列</span><small>含外部线索、身份复核与暂停原因</small></summary>${renderQualityReviewRows(entries)}</details>
  </section>`;
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

function copyItems(...values) {
  return uniqueStrings(values.flatMap((value) => asArray(value).map((item) => {
    if (typeof item === "string" || typeof item === "number") return String(item);
    if (item?.action) {
      const ownerAndTiming = [item.owner, item.timing].filter(Boolean).join(" · ");
      return `${ownerAndTiming ? `${ownerAndTiming}：` : ""}${item.action}${item.acceptance ? `（验收：${item.acceptance}）` : ""}`;
    }
    return firstValue(item?.text, item?.detail, item?.reason, item?.conclusion, item?.observation, item?.label, item?.value, "");
  })));
}

function nestedItems(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const items = firstValue(value.items, value.records, value.creators, value.entries, value.validations);
  return items == null ? [value] : asArray(items);
}

function positiveFlag(value) {
  return value === true || /^(1|true|yes|y|publish|publish_now|track|tail|evergreen)$/i.test(String(value || "").trim());
}

function operationalLane(topic) {
  const decision = topic?.operationalDecision || {};
  const token = [decision.code, decision.label, decision.lane, decision.category, decision.type, decision.action, decision.decision, topic?.operationalStatus]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  if (positiveFlag(decision.publishNow) || /PUBLISH_NOW|IMMEDIATE|立即发布|现在发布|现在可做/.test(token)) {
    return { key: "publish", label: "立即发布", answer: "可以，现在发布", tone: "status-pass", rank: 0, className: "is-publish", description: "证据足够支持快速响应，按事实边界直接进入生产。" };
  }
  if (positiveFlag(decision.tail) || /TAIL|EVERGREEN|长尾|常青/.test(token)) {
    return { key: "tail", label: "长尾内容", answer: "可以，但按长尾内容做", tone: "status-d", rank: 2, className: "is-tail", description: "话题已过首波或更适合搜索需求，不再包装成新热点。" };
  }
  if (positiveFlag(decision.track) || /PUBLISH_AFTER|AFTER_.*CHECK|TRACK|CONDITIONAL|FOLLOW|条件|跟进|观察|补.+后做/.test(token)) {
    return { key: "track", label: "条件跟进", answer: "先准备，补证后发布", tone: "status-watch", rank: 1, className: "is-track", description: "存在扩散信号，但关键事实或增长阶段仍需确认。" };
  }
  return { key: "clue", label: "单源线索", answer: "暂不作为热点发布", tone: "status-d", rank: 3, className: "is-clue", description: "当前只够记录和继续检索，不能据此下热点结论。" };
}

function operationalDecision(topic) {
  const decision = topic?.operationalDecision || {};
  const lane = operationalLane(topic);
  return {
    ...decision,
    lane,
    confidence: firstValue(decision.confidence, topic?.operationalConfidence, topic?.confidence, "待补"),
    conclusion: firstValue(decision.conclusion, decision.summary, topic?.operationalConclusion, lane.description),
    reasons: copyItems(decision.reasons, decision.why, topic?.operationalReasons),
    actions: copyItems(decision.actions, decision.nextSteps, topic?.nextSteps, topic?.nextAction),
  };
}

function formalWhitelistDecision(topic) {
  const raw = topic?.formalWhitelistStatus;
  const detail = raw && typeof raw === "object" ? raw : {};
  const code = String(firstValue(
    typeof raw === "string" ? raw : null,
    detail.status,
    detail.code,
    detail.decision,
    topic?.status,
    "RECORD",
  )).toUpperCase();
  const independence = String(firstValue(detail.independenceStatus, detail.independence, detail.clusterStatus, "")).toUpperCase();
  const pendingIndependence = /PENDING_INDEPENDENCE|INDEPENDENCE_PENDING/.test(`${code} ${independence}`);
  if (/PRIORITY_WHITELIST/.test(code)) return { code, label: "重点白名单", tone: "status-pass", approved: true, detail };
  if (/TEMPORARY_WHITELIST/.test(code)) return { code, label: "临时白名单", tone: "status-pass", approved: true, detail };
  if (/STOPPED|REJECTED/.test(code)) return { code, label: "已停止 / 不进入", tone: "status-conflict", approved: false, detail };
  if (/CANDIDATE/.test(code)) return { code, label: "正式候选，仍需复核", tone: "status-watch", approved: false, detail };
  if (pendingIndependence) return { code, label: "未进入：独立来源待核", tone: "status-watch", approved: false, detail };
  return { code, label: "仅记录，未进入白名单", tone: "status-d", approved: false, detail };
}

function resonanceGateClass(gateItem) {
  if (gateItem.pass) return "is-pass";
  if (gateItem.missing) return "is-missing";
  return "is-fail";
}

function renderResonanceGate(gateItem, iconName) {
  return `<div class="resonance-gate ${resonanceGateClass(gateItem)}">
    <span class="gate-icon">${icon(gateItem.pass ? "check" : gateItem.missing ? "minus" : iconName)}</span>
    <div><strong>${escapeHtml(gateItem.label)}</strong><p>${escapeHtml(gateItem.detail)}</p></div>
  </div>`;
}

function renderContributorRole(role) {
  const labels = {
    ORIGINATOR: "源头贡献",
    EARLY_AMPLIFIER: "早期放大",
    EXPERT_INTERPRETER: "专业解释",
    FOLLOWER: "普通跟拍",
  };
  return labels[role] || role || "角色待核";
}

function renderDecisionList(items, emptyText) {
  const values = copyItems(items);
  if (!values.length) return `<p class="resonance-copy-empty">${escapeHtml(emptyText)}</p>`;
  return `<ul class="resonance-copy-list">${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function metricText(metrics) {
  if (Array.isArray(metrics)) {
    return metrics.map((item) => typeof item === "string" ? item : `${firstValue(item?.label, item?.name, "指标")} ${firstValue(item?.value, item?.metric, "待核")}`).join(" · ");
  }
  if (metrics && typeof metrics === "object") return Object.entries(metrics).map(([key, value]) => `${key} ${value}`).join(" · ");
  return typeof metrics === "string" ? metrics : "";
}

function platformEvidenceFor(topic, decision) {
  return asArray(firstValue(topic?.platformEvidence, decision?.platformEvidence, topic?.crossPlatformEvidence, topic?.evidenceSources, []));
}

function platformName(item) {
  if (typeof item === "string") return item;
  return firstValue(item?.platform, item?.source, item?.name, item?.channel, "来源待标注");
}

function renderPlatformEvidence(topic, decision) {
  const evidence = platformEvidenceFor(topic, decision);
  if (!evidence.length) return `<p class="resonance-copy-empty">没有可展示的跨平台证据，本话题不能按“多方验证”表述。</p>`;
  return `<div class="resonance-platform-list">${evidence.map((item) => {
    if (typeof item === "string") return `<div class="resonance-platform-item"><strong>${escapeHtml(item)}</strong><p>已登记来源，细节待补</p></div>`;
    const status = firstValue(item.statusLabel, item.result, item.status, item.verification, item.evidenceType, "已取得证据");
    const detailParts = copyItems(item.observation, item.facts, item.detail, item.evidence, item.conclusion, item.reason, item.signal);
    const detail = detailParts.join("；") || metricText(item.metrics) || "证据细节待补";
    const role = firstValue(item.verificationRole, item.useBoundary);
    const observedAt = firstValue(item.observedAt, item.capturedAt, item.timestamp);
    const url = firstValue(item.url, item.sourceUrl, item.evidenceUrl);
    return `<div class="resonance-platform-item">
      <div><strong>${escapeHtml(platformName(item))}</strong><span>${escapeHtml(status)}</span></div>
      <p>${escapeHtml(detail)}</p>
      ${role ? `<small class="resonance-evidence-role">${escapeHtml(role)}</small>` : ""}
      <footer>${observedAt ? `<small>${escapeHtml(String(observedAt))}</small>` : ""}${url ? `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer"><span>查看证据</span>${icon("external-link")}</a>` : ""}</footer>
    </div>`;
  }).join("")}</div>`;
}

function amplifyingAccountsFor(topic) {
  const accounts = asArray(firstValue(topic?.amplifyingAccounts, topic?.amplifiers, topic?.participatingAccounts, []));
  return accounts.length ? accounts : asArray(topic?.contributors);
}

function renderAmplifyingAccounts(topic) {
  const accounts = amplifyingAccountsFor(topic);
  if (!accounts.length) return `<p class="resonance-copy-empty">尚未取得可逐个展示的账号证据。</p>`;
  return `<div class="resonance-amplifier-list">${accounts.map((item) => {
    if (typeof item === "string") return `<span><strong>${escapeHtml(item)}</strong><small>参与账号 · 白名单资格待核</small></span>`;
    const name = firstValue(item.nickname, item.creator, item.account, item.name, "账号待命名");
    const role = firstValue(item.roleLabel, item.observedRole, item.role ? renderContributorRole(item.role) : null, "参与放大");
    const platform = firstValue(item.platform, item.source, "平台待标注");
    const accountMetric = firstValue(item.metric, item.performance, metricText(item.metrics), item.originalityStatus ? `原创 ${item.originalityStatus}` : null);
    return `<span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(platform)} · ${escapeHtml(role)}${accountMetric ? ` · ${escapeHtml(accountMetric)}` : ""}</small></span>`;
  }).join("")}</div>`;
}

function renderContributorAudit(topic) {
  const contributors = asArray(topic.contributors);
  if (!contributors.length) return "";
  return `<section class="resonance-contributor-audit"><div class="resonance-panel-heading"><span>达人白名单资格</span><small>只审核贡献，不因参与话题自动入围</small></div><div class="resonance-contributor-list">${contributors.map((item) => `<div class="resonance-contributor ${item.eligible ? "is-eligible" : ""}">
    <div><strong>${escapeHtml(item.nickname)}</strong><small>${escapeHtml(renderContributorRole(item.role))} · ${escapeHtml(item.originality)} · ${escapeHtml(item.evidenceLevel)}</small></div>
    <span class="mono">${item.sameAgeLift == null ? "倍数待核" : `${escapeHtml(item.sameAgeLift)}x`}</span>
    ${statusChip(item.eligible ? "已通过达人白名单" : "未进入达人白名单", item.eligible ? "status-pass" : "status-d")}
    <p>${escapeHtml(item.eligible ? "早期性、原创性、同龄表现和风险门均已通过" : firstValue(item.gaps?.[0], "贡献资格证据不足"))}</p>
  </div>`).join("")}</div></section>`;
}

function renderResonanceTopic(topic) {
  const decision = operationalDecision(topic);
  const lane = decision.lane;
  const formal = formalWhitelistDecision(topic);
  const evidence = platformEvidenceFor(topic, decision);
  const platformCount = new Set(evidence.map(platformName).filter(Boolean)).size;
  const gaps = copyItems(topic.evidenceGaps, decision.evidenceGaps, topic.gaps, topic.stopCondition);
  const formalReason = firstValue(formal.detail.reason, formal.detail.conclusion, formal.detail.detail, formal.approved ? "已按正式硬门槛验收。" : "业务内容结论与正式白名单分开计算；当前不得称为正式白名单话题。");
  return `<article class="resonance-topic-row resonance-decision-card ${lane.className}">
    <header><div><span class="model-code">${escapeHtml(topic.topicId)} · ${escapeHtml(topic.densityLabel)}</span><h3>${escapeHtml(topic.topic)}</h3><p>${escapeHtml(decision.conclusion)}</p></div><div class="resonance-topic-status">${statusChip(lane.label, lane.tone)}<small>判断置信：${escapeHtml(formatConfidence(decision.confidence))}</small></div></header>
    <div class="resonance-verdict-grid">
      <section class="resonance-answer"><div class="resonance-panel-heading"><span>现在能不能做</span></div><strong>${escapeHtml(lane.answer)}</strong><p>${escapeHtml(lane.description)}</p></section>
      <section><div class="resonance-panel-heading"><span>为什么</span></div>${renderDecisionList(decision.reasons, decision.conclusion)}</section>
    </div>
    <div class="resonance-evidence-grid">
      <section><div class="resonance-panel-heading"><span>哪些平台验证过</span><small>${platformCount || 0} 个平台</small></div>${renderPlatformEvidence(topic, decision)}</section>
      <section><div class="resonance-panel-heading"><span>哪些账号在放大</span><small>参与不等于达人白名单</small></div>${renderAmplifyingAccounts(topic)}</section>
    </div>
    <div class="resonance-action-grid">
      <section><div class="resonance-panel-heading"><span>还有什么没确认</span></div>${renderDecisionList(gaps, "当前未登记额外缺口；仍按发布前事实核验清单执行。")}</section>
      <section><div class="resonance-panel-heading"><span>部门下一步做什么</span></div>${renderDecisionList(decision.actions, "暂不投入生产，下一轮只补跨平台与独立来源证据。")}</section>
    </div>
    <section class="resonance-formal-band">
      <div><span>正式话题白名单</span><strong>${escapeHtml(formal.label)}</strong><p>${escapeHtml(formalReason)}</p></div>
      <div class="resonance-topic-kpis">
        <span><small>名义参与账号</small><b>${formatMetric(topic.metrics.rawCreatorCount)}</b></span>
        <span><small>有效独立来源 N_eff</small><b>${topic.metrics.effectiveIndependentSources == null ? "待核 · 不估填" : formatMetric(topic.metrics.effectiveIndependentSources)}</b></span>
        <span><small>T1 持续来源</small><b>${topic.metrics.t1ContinuingSources == null ? "待核" : formatMetric(topic.metrics.t1ContinuingSources)}</b></span>
        <span><small>赛道历史分位</small><b>${topic.metrics.baselinePercentile == null ? "待核" : `${escapeHtml(topic.metrics.baselinePercentile)}%`}</b></span>
        <span><small>官网适配</small><b>${topic.metrics.websiteFit == null ? "待核" : formatMetric(topic.metrics.websiteFit)}</b></span>
        <span><small>社媒适配</small><b>${topic.metrics.socialFit == null ? "待核" : formatMetric(topic.metrics.socialFit)}</b></span>
      </div>
    </section>
    ${renderContributorAudit(topic)}
  </article>`;
}

function renderObservedRankSignals(signals) {
  if (!signals.length) return "";
  return `<section class="resonance-signal-register"><div class="section-title"><h2>单平台发现线索</h2><span>${signals.length} 条 · 不是优质达人名单</span></div><div class="resonance-source-warning">${icon("shield-alert")}<div><strong>这里的账号全部未获批准</strong><p>蝉妈妈、巨量云图等榜单只负责发现异常，必须再经过抖音主页/视频、创作者指数、其他社媒或权威来源复核，才能进入达人审核。</p></div></div><div class="resonance-signal-list">${signals.map((signal) => {
    const metrics = asArray(signal.metrics).filter((item) => item?.value != null && item?.value !== "");
    return `<article class="resonance-signal-row"><div><span class="model-code">${escapeHtml(firstValue(signal.list, "榜单来源"))} · ${escapeHtml(firstValue(signal.rankLabel, signal.rank, "排名待核"))}</span><h3>${escapeHtml(firstValue(signal.creator, "未命名账号"))}</h3><p>${escapeHtml(firstValue(signal.reason, "只有账号层信号，尚未形成话题语义簇"))}</p><small>平台原始标签：${escapeHtml(firstValue(signal.statusLabel, "未标注"))}</small></div><div class="resonance-signal-metrics">${metrics.map((item) => `<span><small>${escapeHtml(item.label)}</small><b>${escapeHtml(String(item.value))}</b></span>`).join("") || "<span><small>指标</small><b>待补</b></span>"}</div><div>${statusChip("未批准 · 待交叉验证", "status-d")}${signal.sourceUrl ? `<a class="source-link" href="${escapeHtml(safeUrl(signal.sourceUrl))}" target="_blank" rel="noopener noreferrer"><span>查看原始榜单</span>${icon("external-link")}</a>` : ""}</div></article>`;
  }).join("")}</div></section>`;
}

function renderCreatorCrossValidation(payload) {
  const records = nestedItems(payload);
  if (!records.length) return `<section class="resonance-creator-validation"><div class="section-title"><h2>达人交叉验证</h2><span>达人质量与话题热度分开判断</span></div><div class="resonance-validation-empty">本轮没有新增的达人多源复核结论。榜单发现账号仍停留在下方“单平台发现线索”。</div></section>`;
  return `<section class="resonance-creator-validation"><div class="section-title"><h2>达人交叉验证</h2><span>${records.length} 位 · 不因上榜自动进入白名单</span></div><div class="resonance-validation-list">${records.map((record) => {
    const name = firstValue(record.nickname, record.creator, record.name, "未命名达人");
    const evidence = asArray(firstValue(record.platformEvidence, record.platforms, record.sources, record.verifiedPlatforms, []));
    const platforms = uniqueStrings(evidence.map(platformName));
    const conclusion = firstValue(record.conclusion, record.result, record.decision, record.assessment, "复核结论待补");
    const crossChecks = copyItems(record.crossChecks, record.consistencyChecks);
    const reason = firstValue(record.reason, record.why, record.summary, crossChecks.join("；"), "已登记多源资料，具体理由待补。");
    const gaps = copyItems(record.evidenceGaps, record.gaps, record.missingEvidence);
    const nextStep = firstValue(record.nextStep, record.nextAction, record.action, "按结论持续观察，不自动升级达人白名单。");
    const status = firstValue(record.statusLabel, record.validationStatus, record.status, platforms.length >= 2 ? "多源资料已复核" : "单源待补");
    const evidenceHtml = evidence.length ? `<div class="resonance-validation-sources">${evidence.map((item) => {
      if (typeof item === "string") return `<div><strong>${escapeHtml(item)}</strong><p>已登记来源，关键事实待补。</p></div>`;
      const facts = copyItems(item.facts, item.observations, item.metrics);
      const sourceStatus = firstValue(item.status, item.result, item.verification, "已复核");
      const sourceDate = firstValue(item.sourceDate, item.observedAt, item.date);
      const sourceUrl = firstValue(item.url, item.sourceUrl);
      return `<div><header><strong>${escapeHtml(platformName(item))}</strong><span>${escapeHtml(sourceStatus)}</span></header>${renderDecisionList(facts, "关键事实待补")}${sourceDate ? `<small>${escapeHtml(String(sourceDate))}</small>` : ""}${sourceUrl ? `<a href="${escapeHtml(safeUrl(sourceUrl))}" target="_blank" rel="noopener noreferrer"><span>查看来源</span>${icon("external-link")}</a>` : ""}</div>`;
    }).join("")}</div>` : "";
    return `<article><header><div><span class="model-code">达人多源复核 · ${platforms.length || 0} 个来源</span><h3>${escapeHtml(name)}</h3></div>${statusChip(status, platforms.length >= 2 ? "status-pass" : "status-watch")}</header><div class="resonance-validation-body"><div><strong>审核结论</strong><p>${escapeHtml(conclusion)}</p></div><div><strong>交叉一致性</strong><p>${escapeHtml(reason)}</p></div><div><strong>证据缺口</strong><p>${escapeHtml(gaps.join("；") || "未登记额外缺口")}</p></div><div><strong>下一步</strong><p>${escapeHtml(nextStep)}</p></div></div>${evidenceHtml}</article>`;
  }).join("")}</div></section>`;
}

function renderResonanceRules(policy, densityRows) {
  return `<details class="resonance-methodology"><summary><span>查看正式白名单的计算规则</span><small>用于审计，不替代上方业务结论</small></summary><div class="resonance-methodology-body">
    <section class="resonance-gates"><div class="section-title"><h2>四道硬门</h2><span>任何一门失败都不能由总分补回</span></div><div class="resonance-gate-rail is-policy"><div class="resonance-gate"><span class="gate-index">01</span><div><strong>独立共振</strong><p>同主体、同投放、同脚本合并后再计算 N_eff。</p></div></div><div class="resonance-gate"><span class="gate-index">02</span><div><strong>同龄增速</strong><p>比较相同发布时长，不用累计点赞替代增长速度。</p></div></div><div class="resonance-gate"><span class="gate-index">03</span><div><strong>内容价值</strong><p>官网或社媒适配至少 70，并能形成明确内容产品。</p></div></div><div class="resonance-gate"><span class="gate-index">04</span><div><strong>风险否决</strong><p>刷量、搬运、统一投放或事实风险直接停止。</p></div></div></div></section>
    <section class="resonance-policy-grid"><div><div class="section-title"><h2>赛道人数门槛</h2><span>按有效独立来源 N_eff 计算</span></div><div class="rules-table-wrap"><table class="data-table resonance-threshold-table"><thead><tr><th>赛道</th><th>候选</th><th>临时</th><th>重点</th></tr></thead><tbody>${densityRows}</tbody></table></div></div><div class="resonance-lifecycle"><div class="section-title"><h2>达人晋级与退出</h2><span>话题合格后再逐人审核</span></div><div class="lifecycle-steps"><div><span>O2+</span><strong>贡献资格</strong><p>源头、早期放大或专业解释；同龄表现至少 1.5 倍。</p></div><div><span>14D</span><strong>临时有效期</strong><p>二轮失败、关联重算或风险证据出现即降级。</p></div><div><span>90D</span><strong>长期晋级</strong><p>参与 3 个确认热点，至少 2 次属于源头或早期放大。</p></div></div></div></section>
  </div></details>`;
}

function renderTopicWhitelistPilot(topicWhitelist, sourceStatus) {
  const summary = topicWhitelist.summary;
  const policy = topicWhitelist.policy;
  const blocked = sourceIsBlocked(sourceStatus) || /BLOCKED|VERIFICATION/.test(topicWhitelist.sourceStatus?.scanStatus || "");
  const densityRows = Object.entries(policy.densityThresholds).map(([key, value]) => `<tr><td><span class="cell-primary">${escapeHtml(value.label)}</span><span class="cell-secondary mono">${escapeHtml(key)}</span></td><td>${formatMetric(value.candidate)}</td><td>${formatMetric(value.temporary)}</td><td>${formatMetric(value.priority)}</td></tr>`).join("");
  const topicsByLane = [...topicWhitelist.topics].sort((a, b) => operationalLane(a).rank - operationalLane(b).rank);
  const lanes = [
    { key: "publish", title: "立即发布", note: "证据已支持快速响应，先抢时间窗口" },
    { key: "track", title: "条件跟进", note: "先备稿与补证，满足条件再上线" },
    { key: "tail", title: "长尾内容", note: "做搜索与教程价值，不再称为新热点" },
    { key: "clue", title: "单源线索", note: "只进入发现池，不进入生产队列" },
  ];
  const laneCounts = Object.fromEntries(lanes.map((lane) => [lane.key, topicsByLane.filter((topic) => operationalLane(topic).key === lane.key).length]));
  const topicGroups = topicsByLane.length
    ? lanes.map((lane) => {
      const rows = topicsByLane.filter((topic) => operationalLane(topic).key === lane.key);
      if (!rows.length) return "";
      return `<section class="resonance-topic-register resonance-lane-group ${operationalLane(rows[0]).className}" data-lane="${lane.key}"><div class="section-title"><h2>${lane.title}</h2><span>${rows.length} 个 · ${lane.note}</span></div>${rows.map(renderResonanceTopic).join("")}</section>`;
    }).join("")
    : `<section class="resonance-empty"><div><span class="model-code">CURRENT ROUND / ${blocked ? "SOURCE BLOCKED" : "NO CONFIRMED TOPIC"}</span><h2>${blocked ? "本轮不能确认话题白名单" : "本轮没有达到共振门槛的话题"}</h2><p>${escapeHtml(topicWhitelist.statusMessage)}。缺失值保持为空，不把榜单进榜、单条高互动或采集失败写成正式白名单。</p></div>${statusChip(blocked ? "等待补证" : "正式白名单 0", blocked ? "status-watch" : "status-d")}</section>`;
  const formalApproved = summary.temporaryTopics + summary.priorityTopics;

  return `<section class="resonance-console">
    <div class="resonance-lead"><div><span class="model-code">话题决策 · 试运行规则</span><h2>热点与达人白名单决策</h2><p>先决定内容能不能做，再看是否达到正式白名单。<strong>业务可发布，不代表话题或达人已进入白名单。</strong></p></div><div class="resonance-kpis"><span class="is-publish"><strong>${laneCounts.publish}</strong><small>立即发布</small></span><span class="is-track"><strong>${laneCounts.track}</strong><small>条件跟进</small></span><span class="is-tail"><strong>${laneCounts.tail}</strong><small>长尾内容</small></span><span><strong>${laneCounts.clue}</strong><small>单源线索</small></span><span><strong>${formalApproved}</strong><small>正式话题白名单</small></span><span><strong>${formatMetric(summary.eligibleCreators)}</strong><small>正式达人白名单</small></span></div></div>
    <div class="resonance-boundary">${icon("shield-alert")}<span><strong>阅读边界：</strong>“立即发布”是内容部门的时效判断；“正式白名单”还必须通过独立来源、同龄增速、内容价值和风险四道硬门。N_eff 未完成聚类时显示“待核”，不估填。</span></div>
    ${topicGroups}
    ${renderCreatorCrossValidation(topicWhitelist.creatorCrossValidation)}
    ${renderObservedRankSignals(topicWhitelist.observedRankSignals)}
    ${renderResonanceRules(policy, densityRows)}
  </section>`;
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
    subtitle: "先判断话题共振，再审核达人贡献；即时行动名单、话题临时名单与长期核心白名单严格分开",
    views: creatorViews,
    activeView: view,
  });
  let content;
  if (view === "quality") content = `${renderDecisionLead(decision, data, true)}${decision.qualityReview ? renderQualityReview(decision.qualityReview) : renderQualityTable(decision)}`;
  else if (view === "resonance") content = renderTopicWhitelistPilot(decision.topicWhitelist, data.sourceStatus);
  else if (view === "topics") content = `${renderDecisionLead(decision, data, true)}${renderTopicCandidates(decision, data.sourceStatus)}${renderSingleVideoSignals(decision.singleVideoSignals, data.sourceStatus)}`;
  else if (view === "candidates") {
    const filtered = filterCandidates(data, filters, decisionMap);
    content = `${renderDecisionLead(decision, data, true)}${renderToolbar(data, filters, filtered.length)}${renderCandidateTable(filtered, decision.singleVideoSignals, decision.summary.observedAt, decisionMap, data.sourceStatus)}`;
  } else if (view === "evidence") content = renderEvidenceAndRules(data, decision, index);
  else {
    const reviewSummary = decision.qualityReview?.summary;
    const peopleCopy = reviewSummary
      ? `严格队列 ${formatMetric(reviewSummary.queue_entries)} 条，仅 ${formatMetric(reviewSummary.high_potential_top_up)} 位进入 Q0 补样，${formatMetric(reviewSummary.held)} 位暂停投入；正式白名单仍为 0。`
      : `优先使用 ${decision.summary.executeCreators} 位，条件与观察 ${decision.summary.watchCreators} 位；业务处置优先，证据代理分只辅助排序。`;
    const resonanceSummary = decision.topicWhitelist.summary;
    content = `${renderDecisionLead(decision, data)}${renderActionBriefs(decision)}<section class="overview-followup"><div><span class="model-code">NEXT / PEOPLE</span><h2>严格达人复核</h2><p>${peopleCopy}</p><button type="button" class="command-button" data-view="quality">${icon("users-round")}查看完整审核队列</button></div><div><span class="model-code">NEXT / RESONANCE</span><h2>话题共振白名单</h2><p>候选 ${resonanceSummary.candidateTopics} 个，临时白名单 ${resonanceSummary.temporaryTopics} 个，重点白名单 ${resonanceSummary.priorityTopics} 个；名义账号数量不再直接决定入围。</p><button type="button" class="command-button" data-view="resonance">${icon("network")}查看共振证据</button></div></section>`;
  }
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
