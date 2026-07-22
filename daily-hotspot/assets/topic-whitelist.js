const STATUS_META = {
  RECORD: { label: "记录", tone: "status-d", rank: 4 },
  CANDIDATE: { label: "候选", tone: "status-watch", rank: 3 },
  TEMPORARY_WHITELIST: { label: "临时白名单", tone: "status-pass", rank: 2 },
  PRIORITY_WHITELIST: { label: "重点白名单", tone: "status-pass", rank: 1 },
  STOPPED: { label: "停止", tone: "status-conflict", rank: 5 },
};

const DENSITY_THRESHOLDS = {
  low: { label: "低密度垂直赛道", candidate: 2, temporary: 3, priority: 5 },
  normal: { label: "常规赛道", candidate: 3, temporary: 5, priority: 8 },
  high: { label: "高噪声赛道", candidate: 5, temporary: 8, priority: 12 },
  mass: { label: "明星 / 全民事件", candidate: 8, temporary: 12, priority: 20 },
};

export const DEFAULT_TOPIC_WHITELIST_POLICY = Object.freeze({
  version: "pilot-v1",
  trialDays: 28,
  baselineWindowDays: 90,
  temporaryExpiryDays: 14,
  minimumEvidenceLevel: "E2",
  candidateBaselinePercentile: 95,
  temporaryBaselinePercentile: 99,
  priorityBaselinePercentile: 99.5,
  minimumIndependentClusters: 3,
  minimumFollowerTiers: 2,
  minimumOriginalContributors: 3,
  minimumT1ContinuingSources: 3,
  minimumSameAgeAboveBaselineShare: 0.6,
  minimumEffectiveSourceGrowthRate: 0.2,
  maximumTopContributorShare: 0.45,
  maximumTopTwoShare: 0.65,
  minimumChannelFit: 70,
  densityThresholds: DENSITY_THRESHOLDS,
});

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function firstValue(...values) {
  return values.find((value) => value != null && value !== "");
}

function evidenceRank(value) {
  const match = String(value || "").toUpperCase().match(/E([0-4])/);
  return match ? Number(match[1]) : 0;
}

function originalityRank(value) {
  const match = String(value || "").toUpperCase().match(/O([0-3])/);
  return match ? Number(match[1]) : 0;
}

function gate(pass, missing, label, detail) {
  return { pass: Boolean(pass), missing: Boolean(missing), label, detail };
}

export function topicWhitelistStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.RECORD;
}

export function contributorEligibility(raw, topicStatus) {
  const role = firstValue(raw?.role, "FOLLOWER");
  const originality = firstValue(raw?.originality, "O0");
  const evidenceLevel = firstValue(raw?.evidenceLevel, "E0");
  const sameAgeLift = numberOrNull(raw?.sameAgeLift);
  const earlyWindow = booleanOrNull(raw?.earlyWindow);
  const riskVeto = Boolean(raw?.riskVeto);
  const topicQualified = ["TEMPORARY_WHITELIST", "PRIORITY_WHITELIST"].includes(topicStatus);
  const acceptedRole = ["ORIGINATOR", "EARLY_AMPLIFIER", "EXPERT_INTERPRETER"].includes(role);
  const checks = {
    topicQualified,
    acceptedRole,
    originality: originalityRank(originality) >= 2,
    sameAgeLift: sameAgeLift != null && sameAgeLift >= 1.5,
    earlyWindow: earlyWindow === true,
    evidence: evidenceRank(evidenceLevel) >= 2,
    risk: !riskVeto,
  };
  const eligible = Object.values(checks).every(Boolean);
  const gaps = [];
  if (!topicQualified) gaps.push("话题尚未进入白名单");
  if (!acceptedRole) gaps.push("角色不是源头、早期放大或专业解释");
  if (!checks.originality) gaps.push("原创贡献低于 O2");
  if (!checks.sameAgeLift) gaps.push(sameAgeLift == null ? "缺少同龄表现倍数" : "同龄表现不足 1.5 倍");
  if (!checks.earlyWindow) gaps.push(earlyWindow == null ? "缺少入场时间证据" : "入场时间过晚");
  if (!checks.evidence) gaps.push("证据等级低于 E2");
  if (!checks.risk) gaps.push("命中风险否决");
  return {
    ...raw,
    creatorId: firstValue(raw?.creatorId, raw?.id, "UNKNOWN"),
    nickname: firstValue(raw?.nickname, "未命名达人"),
    role,
    originality,
    evidenceLevel,
    sameAgeLift,
    earlyWindow,
    riskVeto,
    eligible,
    checks,
    gaps,
  };
}

export function evaluateTopicWhitelistTopic(raw, policy = DEFAULT_TOPIC_WHITELIST_POLICY) {
  const density = DENSITY_THRESHOLDS[raw?.density] ? raw.density : "normal";
  const thresholds = policy.densityThresholds[density];
  const metrics = {
    rawCreatorCount: numberOrNull(raw?.rawCreatorCount),
    effectiveIndependentSources: numberOrNull(raw?.effectiveIndependentSources),
    independentClusters: numberOrNull(raw?.independentClusters),
    followerTiers: numberOrNull(raw?.followerTiers),
    originalContributors: numberOrNull(raw?.originalContributors),
    baselinePercentile: numberOrNull(raw?.baselinePercentile),
    t1ContinuingSources: numberOrNull(raw?.t1ContinuingSources),
    sameAgeAboveBaselineShare: numberOrNull(raw?.sameAgeAboveBaselineShare),
    effectiveSourceGrowthRate: numberOrNull(raw?.effectiveSourceGrowthRate),
    newIndependentSources: numberOrNull(raw?.newIndependentSources),
    newIndependentSources24h: numberOrNull(raw?.newIndependentSources24h),
    topContributorShare: numberOrNull(raw?.topContributorShare),
    topTwoShare: numberOrNull(raw?.topTwoShare),
    websiteFit: numberOrNull(raw?.websiteFit),
    socialFit: numberOrNull(raw?.socialFit),
  };
  const evidenceLevel = firstValue(raw?.evidenceLevel, "E0");
  const contentRelevant = booleanOrNull(raw?.contentRelevant);
  const riskVeto = Boolean(raw?.riskVeto);

  const independencePassed = metrics.effectiveIndependentSources != null
    && metrics.effectiveIndependentSources >= thresholds.temporary
    && metrics.independentClusters != null
    && metrics.independentClusters >= policy.minimumIndependentClusters
    && metrics.followerTiers != null
    && metrics.followerTiers >= policy.minimumFollowerTiers
    && metrics.originalContributors != null
    && metrics.originalContributors >= policy.minimumOriginalContributors;
  const distributionPassed = metrics.topContributorShare != null
    && metrics.topContributorShare <= policy.maximumTopContributorShare
    && metrics.topTwoShare != null
    && metrics.topTwoShare <= policy.maximumTopTwoShare;
  const velocityPassed = metrics.t1ContinuingSources != null
    && metrics.t1ContinuingSources >= policy.minimumT1ContinuingSources
    && (
      (metrics.sameAgeAboveBaselineShare != null && metrics.sameAgeAboveBaselineShare >= policy.minimumSameAgeAboveBaselineShare)
      || (metrics.newIndependentSources != null && metrics.newIndependentSources >= 1
        && metrics.effectiveSourceGrowthRate != null && metrics.effectiveSourceGrowthRate >= policy.minimumEffectiveSourceGrowthRate)
    );
  const contentPassed = contentRelevant === true
    && [metrics.websiteFit, metrics.socialFit].some((value) => value != null && value >= policy.minimumChannelFit);
  const evidencePassed = evidenceRank(evidenceLevel) >= evidenceRank(policy.minimumEvidenceLevel);
  const baselinePassed = metrics.baselinePercentile != null && metrics.baselinePercentile >= policy.temporaryBaselinePercentile;
  const riskPassed = !riskVeto;
  const gates = {
    independence: gate(independencePassed && distributionPassed, [metrics.effectiveIndependentSources, metrics.independentClusters, metrics.followerTiers, metrics.originalContributors, metrics.topContributorShare, metrics.topTwoShare].some((value) => value == null), "独立共振", `N_eff ${metrics.effectiveIndependentSources ?? "缺失"} / ${thresholds.temporary}`),
    velocity: gate(velocityPassed, [metrics.t1ContinuingSources, metrics.sameAgeAboveBaselineShare, metrics.newIndependentSources, metrics.effectiveSourceGrowthRate].every((value) => value == null), "同龄增速", `T1 持续来源 ${metrics.t1ContinuingSources ?? "缺失"}`),
    content: gate(contentPassed, contentRelevant == null || (metrics.websiteFit == null && metrics.socialFit == null), "内容价值", `官网 ${metrics.websiteFit ?? "缺失"} / 社媒 ${metrics.socialFit ?? "缺失"}`),
    risk: gate(riskPassed, false, "风险否决", riskPassed ? "未命中高风险" : "已命中高风险"),
  };

  const candidatePassed = metrics.effectiveIndependentSources != null
    && metrics.effectiveIndependentSources >= thresholds.candidate
    && metrics.baselinePercentile != null
    && metrics.baselinePercentile >= policy.candidateBaselinePercentile;
  const temporaryPassed = baselinePassed && evidencePassed && Object.values(gates).every((item) => item.pass);
  const priorityPassed = temporaryPassed
    && metrics.effectiveIndependentSources >= thresholds.priority
    && metrics.baselinePercentile >= policy.priorityBaselinePercentile
    && (metrics.newIndependentSources24h == null || metrics.newIndependentSources24h >= 1);

  let status = "RECORD";
  if (riskVeto) status = "STOPPED";
  else if (priorityPassed) status = "PRIORITY_WHITELIST";
  else if (temporaryPassed) status = "TEMPORARY_WHITELIST";
  else if (candidatePassed) status = "CANDIDATE";

  const gaps = [];
  if (metrics.effectiveIndependentSources == null) gaps.push("缺少有效独立来源数");
  else if (metrics.effectiveIndependentSources < thresholds.candidate) gaps.push(`N_eff 未达到候选线 ${thresholds.candidate}`);
  if (metrics.baselinePercentile == null) gaps.push("缺少赛道历史基线");
  else if (metrics.baselinePercentile < policy.candidateBaselinePercentile) gaps.push("未超过赛道历史 95 分位");
  if (!evidencePassed) gaps.push("证据等级低于 E2");
  for (const item of Object.values(gates)) {
    if (!item.pass) gaps.push(item.missing ? `${item.label}数据缺失` : `${item.label}未通过`);
  }

  const contributors = asArray(raw?.contributors).map((item) => contributorEligibility(item, status));
  return {
    ...raw,
    topicId: firstValue(raw?.topicId, raw?.id, "TOPIC-UNKNOWN"),
    topic: firstValue(raw?.topic, raw?.name, "未命名话题"),
    density,
    densityLabel: thresholds.label,
    evidenceLevel,
    contentRelevant,
    riskVeto,
    metrics,
    thresholds,
    gates,
    status,
    statusMeta: topicWhitelistStatusMeta(status),
    gaps: [...new Set(gaps)],
    contributors,
    eligibleContributors: contributors.filter((item) => item.eligible),
  };
}

export function normalizeTopicWhitelistPayload(payload, policy = DEFAULT_TOPIC_WHITELIST_POLICY) {
  const input = payload && typeof payload === "object" ? payload : {};
  const topics = asArray(input.topics).map((topic) => evaluateTopicWhitelistTopic(topic, policy));
  topics.sort((a, b) => a.statusMeta.rank - b.statusMeta.rank
    || (b.metrics.effectiveIndependentSources ?? -1) - (a.metrics.effectiveIndependentSources ?? -1));
  const eligibleCreatorIds = new Set(topics.flatMap((topic) => topic.eligibleContributors.map((item) => item.creatorId)));
  const summary = {
    totalTopics: topics.length,
    recordTopics: topics.filter((item) => item.status === "RECORD").length,
    candidateTopics: topics.filter((item) => item.status === "CANDIDATE").length,
    temporaryTopics: topics.filter((item) => item.status === "TEMPORARY_WHITELIST").length,
    priorityTopics: topics.filter((item) => item.status === "PRIORITY_WHITELIST").length,
    stoppedTopics: topics.filter((item) => item.status === "STOPPED").length,
    eligibleCreators: eligibleCreatorIds.size,
  };
  return {
    schemaVersion: firstValue(input.schemaVersion, "topic-whitelist-pilot-v1"),
    date: firstValue(input.date, null),
    observedAt: firstValue(input.observedAt, null),
    status: firstValue(input.status, topics.length ? "PILOT_ACTIVE" : "NO_CONFIRMED_TOPIC"),
    statusMessage: firstValue(input.statusMessage, topics.length ? "按试运行规则评估" : "当前没有可判定的话题共振"),
    policy,
    policyNotes: asArray(input.policyNotes),
    sourceStatus: input.sourceStatus || {},
    observedRankSignals: asArray(input.observedRankSignals),
    topics,
    summary,
  };
}
