import {
  detailSection,
  escapeHtml,
  factGrid,
  formatDateTime,
  icon,
  listHtml,
  renderEmpty,
  renderPageHeading,
  renderSummaryBand,
  safeUrl,
  statusChip,
  uniqueOptions,
} from "./ui.js";

export const creatorViews = [
  { id: "overview", label: "候选总览" },
  { id: "signals", label: "实时热点" },
  { id: "coverage", label: "数据覆盖" },
  { id: "rules", label: "判断规则" },
];

export const creatorFilterDefaults = {
  search: "",
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

const GATE_RULES = [
  ["90 天有效作品", ">= 15 条", "validVideos90d"],
  ["电商运营相关占比", ">= 60%", "relevantRatio"],
  ["核心实操内容占比", ">= 40%（人工复核）", "corePracticeLowerBound"],
  ["60 天相关作品", ">= 6 条", "relatedVideos60d"],
  ["最近相关作品", "<= 30 天", "latestRelatedAgeDays"],
];

function formatFollowers(value) {
  if (value == null || value === "") return "缺失";
  const number = Number(value);
  if (!Number.isFinite(number)) return "缺失";
  if (number >= 100000000) return `${(number / 100000000).toFixed(1).replace(/\.0$/, "")} 亿`;
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 1 : 2).replace(/\.0+$/, "")} 万`;
  return number.toLocaleString("zh-CN");
}

function formatPercent(value) {
  if (value == null || value === "") return "缺失";
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1).replace(/\.0$/, "")}%` : "缺失";
}

function formatMetric(value) {
  if (value == null || value === "") return "缺失";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("zh-CN") : "缺失";
}

function formatDelta(value) {
  if (value == null || value === "") return "缺失";
  const number = Number(value);
  return Number.isFinite(number) ? `${number >= 0 ? "+" : ""}${number.toLocaleString("zh-CN")}` : "缺失";
}

function gateSignals(candidate) {
  const gates = candidate.gates || {};
  return [
    { key: "sample", label: "样本", pass: Number(gates.validVideos90d) >= 15 },
    { key: "relevance", label: "相关", pass: Number(gates.relevantRatio) >= 0.6 },
    { key: "related", label: "频次", pass: Number(gates.relatedVideos60d) >= 6 },
    { key: "recency", label: "近期", pass: gates.latestRelatedAgeDays != null && Number(gates.latestRelatedAgeDays) <= 30 },
    { key: "refetch", label: "复取", pass: Number(candidate.refetch?.successfulVideos) > 0 },
  ];
}

function renderEvidenceRail(candidate, compact = false) {
  const signals = gateSignals(candidate);
  const passed = signals.filter((item) => item.pass).length;
  return `<div class="evidence-rail${compact ? " is-compact" : ""}" aria-label="证据完整度 ${passed} / ${signals.length}">
    <div class="evidence-rail-track">${signals.map((signal) => `<span class="${signal.pass ? "is-on" : ""}" title="${escapeHtml(signal.label)}：${signal.pass ? "已有证据" : "待补证据"}"></span>`).join("")}</div>
    <div class="evidence-rail-labels">${signals.map((signal) => `<span>${escapeHtml(signal.label)}</span>`).join("")}</div>
  </div>`;
}

function filterCandidates(candidates, filters) {
  const search = String(filters.search || "").trim().toLowerCase();
  return [...candidates]
    .filter((candidate) => {
      const searchValues = [candidate.nickname, candidate.id, candidate.dispositionLabel, candidate.formalStatus, ...(candidate.tracks || [])];
      const matchesSearch = !search || searchValues.some((value) => String(value || "").toLowerCase().includes(search));
      const matchesDisposition = filters.disposition === "all" || candidate.autoDisposition === filters.disposition;
      const matchesTrack = filters.track === "all" || candidate.tracks?.includes(filters.track);
      const matchesRefetch = filters.refetch === "all" || candidate.refetchStatus === filters.refetch;
      return matchesSearch && matchesDisposition && matchesTrack && matchesRefetch;
    })
    .sort((a, b) => (DISPOSITION_ORDER[a.autoDisposition] ?? 9) - (DISPOSITION_ORDER[b.autoDisposition] ?? 9) || a.rank - b.rank);
}

function option(value, current, label = value) {
  return `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderToolbar(data, filters, count) {
  const tracks = uniqueOptions(data.candidates.flatMap((candidate) => candidate.tracks || []));
  const refetchStatuses = uniqueOptions(data.candidates.map((candidate) => candidate.refetchStatus));
  return `<div class="toolbar creator-toolbar">
    <div class="filter-group">
      <label class="search-box">${icon("search")}<input type="search" data-filter="search" value="${escapeHtml(filters.search)}" placeholder="搜索达人、ID 或赛道"></label>
      <label class="filter-select">${icon("list-filter")}<select data-filter="disposition" aria-label="筛选审核状态">
        <option value="all">全部审核状态</option>
        ${option("READY_FOR_MANUAL_ROUND1", filters.disposition, "待人工首审")}
        ${option("WATCH_SAMPLE_LT15", filters.disposition, "样本不足观察")}
        ${option("NO_MATCHED_API_EVIDENCE", filters.disposition, "缺匹配作品证据")}
        ${option("FAIL_AUTOMATED_GATE", filters.disposition, "自动门槛未通过")}
      </select></label>
      <label class="filter-select">${icon("tags")}<select data-filter="track" aria-label="筛选赛道"><option value="all">全部赛道</option>${tracks.map((track) => option(track, filters.track)).join("")}</select></label>
      <label class="filter-select">${icon("refresh-cw")}<select data-filter="refetch" aria-label="筛选复取状态"><option value="all">全部复取状态</option>${refetchStatuses.map((status) => option(status, filters.refetch)).join("")}</select></label>
    </div>
    <span class="result-count">${count} / ${data.candidates.length} 位候选</span>
  </div>`;
}

function creatorRealtimeSignals(videoSignals, creatorId) {
  return (videoSignals || []).filter((signal) => signal.creatorId === creatorId);
}

function renderRealtimeHotspotCell(candidate, videoSignals, observedAt) {
  const signals = creatorRealtimeSignals(videoSignals, candidate.id);
  if (!signals.length) return `<span class="cell-primary mono">0 条</span><span class="cell-secondary">${escapeHtml(formatDateTime(observedAt))} 快照未发现续跟信号</span>`;
  return `${statusChip(`${signals.length} 条续跟`, "status-watch")}<span class="cell-primary creator-hotspot-title">${escapeHtml(signals[0].title)}</span><span class="cell-secondary">已验证热点 0 · 仅观察</span>`;
}

function renderCandidateTable(candidates, videoSignals, observedAt) {
  if (!candidates.length) return `<div class="data-region">${renderEmpty("当前筛选条件下没有候选达人", "user-search")}</div>`;
  const rows = candidates.map((candidate) => `<tr data-open-id="${escapeHtml(candidate.id)}">
    <td>${statusChip(candidate.dispositionLabel, DISPOSITION_CLASS[candidate.autoDisposition] || "")}<span class="cell-secondary">${escapeHtml(candidate.formalStatus)}</span></td>
    <td><span class="cell-primary">${escapeHtml(candidate.nickname)}</span><span class="cell-secondary mono">${escapeHtml(candidate.id)} · 排名 ${escapeHtml(candidate.rank)}</span></td>
    <td><span class="cell-primary mono">${escapeHtml(formatFollowers(candidate.followers))}</span><span class="cell-secondary">粉丝快照，非实时值</span></td>
    <td><div class="tag-stack">${(candidate.tracks || []).map((track) => `<span class="tag">${escapeHtml(track)}</span>`).join("") || "缺失"}</div></td>
    <td>${renderEvidenceRail(candidate)}<span class="cell-secondary">有效 ${formatMetric(candidate.gates?.validVideos90d)} 条 · 相关 ${formatPercent(candidate.gates?.relevantRatio)}</span></td>
    <td><span class="cell-primary mono">${formatMetric(candidate.refetch?.successfulVideos)} / ${formatMetric(candidate.refetch?.targetVideos)}</span><span class="cell-secondary">${escapeHtml(candidate.refetchStatus)} · 有效增量 ${formatMetric(candidate.refetch?.validIncrements)}</span></td>
    <td>${renderRealtimeHotspotCell(candidate, videoSignals, observedAt)}</td>
    <td><span class="cell-primary">${candidate.gates?.manualChecks?.length ? "仍需人工核验实操占比" : "无待办项"}</span><span class="cell-secondary">匹配作品 ${formatMetric(candidate.videosLoaded)} 条</span></td>
  </tr>`).join("");
  const mobile = candidates.map((candidate) => `<article class="mobile-item creator-mobile-item" data-open-id="${escapeHtml(candidate.id)}">
    <div class="mobile-item-header">${statusChip(candidate.dispositionLabel, DISPOSITION_CLASS[candidate.autoDisposition] || "")}<span class="mono">${escapeHtml(formatFollowers(candidate.followers))} 粉</span></div>
    <h3>${escapeHtml(candidate.nickname)}</h3>
    <div class="tag-stack">${(candidate.tracks || []).map((track) => `<span class="tag">${escapeHtml(track)}</span>`).join("")}</div>
    ${renderEvidenceRail(candidate, true)}
    <div class="mobile-facts"><div class="mobile-fact"><span>有效样本</span><strong>${formatMetric(candidate.gates?.validVideos90d)} 条</strong></div><div class="mobile-fact"><span>复取成功</span><strong>${formatMetric(candidate.refetch?.successfulVideos)} / ${formatMetric(candidate.refetch?.targetVideos)}</strong></div></div>
    <p><strong>实时热点：</strong>${creatorRealtimeSignals(videoSignals, candidate.id).length ? `${creatorRealtimeSignals(videoSignals, candidate.id).length} 条单视频续跟，已验证热点 0` : "当前快照 0 条"}</p>
    <p><strong>正式状态：</strong>${escapeHtml(candidate.formalStatus)}</p>
  </article>`).join("");
  return `<div class="data-region">
    <div class="data-table-wrap"><table class="data-table creator-table">
      <colgroup><col style="width:12%"><col style="width:14%"><col style="width:8%"><col style="width:12%"><col style="width:18%"><col style="width:10%"><col style="width:13%"><col style="width:13%"></colgroup>
      <thead><tr><th>审核状态</th><th>达人</th><th>粉丝体量</th><th>候选赛道</th><th>证据完整度</th><th>16:00 复取</th><th>实时热点</th><th>下一步</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="mobile-list">${mobile}</div>
  </div>`;
}

function renderMetricPair(signal, key, label) {
  return `<div class="signal-metric"><span>${escapeHtml(label)}</span><strong>${formatMetric(signal.current?.[key])}</strong><em>${formatDelta(signal.delta?.[key])}</em></div>`;
}

function renderSignals(data) {
  if (!data.videoSignals.length) return `<section class="section-band"><div class="section-title"><h2>实时热点列表</h2><span>最新快照 ${escapeHtml(formatDateTime(data.observedAt))}</span></div>${renderEmpty("当前最新快照没有实时热点或单视频续跟信号", "activity")}</section>`;
  const cards = data.videoSignals.map((signal) => `<article class="video-signal-card">
    <div class="video-signal-head">
      <div><span class="model-code">${escapeHtml(signal.id)} · ${escapeHtml(signal.creatorId)}</span><h3>${escapeHtml(signal.nickname)}</h3><p>${escapeHtml(signal.title)}</p></div>
      ${statusChip(signal.assessment, "status-watch")}
    </div>
    <div class="signal-metric-grid">
      ${renderMetricPair(signal, "digg_count", "点赞")}
      ${renderMetricPair(signal, "comment_count", "评论")}
      ${renderMetricPair(signal, "collect_count", "收藏")}
      ${renderMetricPair(signal, "share_count", "转发")}
      ${renderMetricPair(signal, "play_count", "播放")}
    </div>
    <div class="signal-context">
      <span>${icon("clock-3")}真实观察间隔 ${escapeHtml(signal.elapsedHours.toFixed(2))} 小时</span>
      <span>${icon("radio-tower")}快照 ${escapeHtml(formatDateTime(signal.observedAt))}</span>
      <span>${icon("users")}达人粉丝 ${escapeHtml(formatFollowers(signal.followers))}</span>
      <span>${icon("layers-3")}深互动增量 +${escapeHtml(formatMetric(signal.deepIncrement))}</span>
    </div>
    <p class="signal-reason">${escapeHtml(signal.reason)}</p>
    <div class="signal-next"><strong>下一步</strong><span>${escapeHtml(signal.nextCheck)}</span></div>
    <div class="signal-links"><a class="command-button primary" href="${escapeHtml(safeUrl(signal.videoUrl))}" target="_blank" rel="noopener noreferrer">${icon("play")}查看视频</a><a class="command-button" href="${escapeHtml(safeUrl(signal.profileUrl))}" target="_blank" rel="noopener noreferrer">${icon("user-round")}查看达人</a></div>
  </article>`).join("");
  return `<div class="creator-signal-intro">
      <div><span class="model-code">REALTIME HOTSPOT SNAPSHOT · Q / TP REVIEW</span><h2>实时热点列表：${data.videoSignals.length} 条观察信号，${data.summary.qualifiedTopics} 条已验证热点</h2><span class="hotspot-snapshot-note">最新快照 ${escapeHtml(formatDateTime(data.observedAt))}，不是秒级直播数据</span></div>
      <p>列表按最新可回放快照展示。互动增长只说明该视频值得继续取数；缺少播放量、统一时间窗、本人及同行基线和跨账号扩散证据时，状态保持“单视频续跟”，不进入热点或选题推荐。</p>
    </div><div class="video-signal-grid">${cards}</div>`;
}

function renderCreatorRealtimeHotspots(candidate, data) {
  const signals = creatorRealtimeSignals(data?.videoSignals, candidate.id);
  if (!signals.length) return `<div class="drawer-hotspot-empty"><strong>当前快照 0 条</strong><p>截至 ${escapeHtml(formatDateTime(data?.observedAt))}，未发现该达人的单视频续跟信号或已验证热点。</p></div>`;
  return `<div class="drawer-hotspot-summary"><span>${statusChip(`${signals.length} 条单视频续跟`, "status-watch")}</span><span>已验证热点 0</span><span>快照 ${escapeHtml(formatDateTime(data?.observedAt))}</span></div><div class="drawer-hotspot-list">${signals.map((signal) => `<article>
    <div><span class="model-code">${escapeHtml(signal.id)} · ${escapeHtml(signal.assessment)}</span><strong>${escapeHtml(signal.title)}</strong></div>
    <div class="drawer-hotspot-metrics"><span>点赞 <b>${formatMetric(signal.current?.digg_count)}</b> <em>${formatDelta(signal.delta?.digg_count)}</em></span><span>收藏 <b>${formatMetric(signal.current?.collect_count)}</b> <em>${formatDelta(signal.delta?.collect_count)}</em></span><span>转发 <b>${formatMetric(signal.current?.share_count)}</b> <em>${formatDelta(signal.delta?.share_count)}</em></span><span>播放 <b>${formatMetric(signal.current?.play_count)}</b></span></div>
    <p>${escapeHtml(signal.reason)}</p>
    <a class="source-link" href="${escapeHtml(safeUrl(signal.videoUrl))}" target="_blank" rel="noopener noreferrer"><span>查看原视频</span>${icon("external-link")}</a>
  </article>`).join("")}</div>`;
}

function coverageStat(label, value, note, tone = "") {
  return `<div class="coverage-stat ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`;
}

function renderCoverage(data) {
  const summary = data.summary;
  const audit = data.audit;
  return `<div class="captcha-banner" role="status">
      ${icon("shield-alert")}<div><strong>公开分享页触发平台验证码，批量复取已停止</strong><p>未绕过验证码、未读取或导出 Cookie。验证码解除后可在现有登录会话继续复取；当前 569 条失败记录保持 null。</p></div>
    </div>
    <section class="coverage-grid" aria-label="数据覆盖">
      ${coverageStat("目标视频", formatMetric(summary.targetVideos), "23 位定向复取达人")}
      ${coverageStat("成功复取", formatMetric(summary.successfulVideos), `${summary.creatorsWithCurrentMetrics} 位达人有当前指标`, "is-pass")}
      ${coverageStat("失败记录", formatMetric(summary.failedVideos), "当前值未估填", "is-danger")}
      ${coverageStat("播放量可用", "0", "公开页全部缺失", "is-warning")}
      ${coverageStat("计数回落冲突", formatMetric(summary.openConflicts), "进入冲突队列", "is-warning")}
      ${coverageStat("合格话题", formatMetric(summary.qualifiedTopics), "尚未满足 TP 门槛")}
    </section>
    <section class="section-band">
      <div class="section-title"><h2>基线与审计</h2><span>已纠正非统一 T0 问题</span></div>
      <div class="coverage-facts">${factGrid([
        ["快照轮次", escapeHtml(audit.snapshotRound)],
        ["观察窗口", `${formatDateTime(audit.baselineObservationWindow.start)} 至 ${formatDateTime(audit.baselineObservationWindow.end)}`],
        ["单条观察间隔", "7.07–23.67 小时"],
        ["统一 10:00–16:00 增速", statusChip("不可声称", "status-conflict")],
        ["缺失值策略", "null，不估填"],
        ["快照校验", statusChip("SHA-256 已匹配", "status-pass")],
      ])}</div>
    </section>
    <section class="section-band">
      <div class="section-title"><h2>已知限制</h2><span>${data.limitations.length} 项必须随快照披露</span></div>
      <div class="limitation-list">${data.limitations.map((item, index) => `<div><span class="mono">0${index + 1}</span><p>${escapeHtml(item)}</p></div>`).join("")}</div>
    </section>`;
}

function renderRules(data) {
  const gateRows = GATE_RULES.map(([label, threshold, key]) => `<tr><td>${escapeHtml(label)}</td><td class="mono">${escapeHtml(threshold)}</td><td>${key === "corePracticeLowerBound" ? "人工抽样判断，自动预筛不能替代" : "自动门槛，缺失不按 0 估填"}</td></tr>`).join("");
  return `<section class="section-band creator-rule-model">
      <div class="model-rule-heading"><div><span class="model-code">D / M · CREATOR ADMISSION</span><h3>达人准入与监测必须分开</h3></div><p>D/M 和硬门槛决定达人能否进入正式白名单；云图 Y 只验证人群与话题机会，星图 X 只服务合作筛选，二者均不能改变白名单结论。</p></div>
      <div class="rules-table-wrap"><table class="data-table rules-table"><thead><tr><th>硬门槛</th><th>阈值</th><th>核验方式</th></tr></thead><tbody>${gateRows}</tbody></table></div>
    </section>
    <section class="rule-flow">
      <div><span>D</span><strong>领域相关</strong><p>确认达人是否稳定产出电商运营内容。</p></div>
      <div><span>M</span><strong>监测价值</strong><p>看早期信号、相对表现、深互动和稳定性。</p></div>
      <div><span>Q</span><strong>视频质量</strong><p>对比本人同类型、同龄视频及同赛道 cohort。</p></div>
      <div><span>TP</span><strong>话题潜力</strong><p>验证跨账号扩散、增速、独立主体与 T+48。</p></div>
    </section>
    <section class="section-band">
      <div class="section-title"><h2>两个常见判断</h2><span>粉丝数和点赞绝对值都不能单独下结论</span></div>
      <div class="example-grid">
        <article><span class="model-code">10 万粉 · 5,000 赞</span><h3>有相对热度的候选，不等于热点</h3><p>点赞粉丝比约 5%，表面表现不错；仍需核对发布时间、播放量、收藏/转发、本人近 30 条同类型基线和同行 P90。只有跨账号扩散后，才进入话题热点判断。</p></article>
        <article><span class="model-code">10 万粉 · 1 万赞 · 发布于一个月前</span><h3>属于历史高表现，通常不属于当前热点</h3><p>可作为内容质量和选题复盘样本，但除非最近 24/48 小时出现二次增速及新增独立主体，否则不判定为当前热点潜力。</p></article>
      </div>
    </section>
    <section class="section-band">
      <div class="section-title"><h2>正式发布门槛</h2><span>当前全部未完成，因此白名单和热点均为 0</span></div>
      <div class="formal-gates">
        <div>${icon("users-round")}<strong>达人白名单</strong><p>重放 D/M；每人 15–30 条视频证据；两轮不同快照；Day 7 复审；至少 5 个完成 T+48 的话题样本。</p></div>
        <div>${icon("radio-tower")}<strong>热点结论</strong><p>重放 TP；完成 T+48；至少 3 个独立原创主体、2 个粉丝层级，最大主体贡献低于 60%。</p></div>
        <div>${icon("sparkles")}<strong>内容推荐</strong><p>只有合格热点才可生成选题；当前 recommendations 为 ${formatMetric(data.summary.recommendations)}，不输出伪推荐。</p></div>
      </div>
    </section>`;
}

function renderArchive(index) {
  return `<section class="section-band"><div class="section-title"><h2>达人快照归档</h2><span>每次校验后保留独立快照</span></div><div class="archive-grid">${index.dates.map((item) => `<button type="button" class="archive-item" data-route-date="${escapeHtml(item.date)}"><time>${escapeHtml(item.date)}</time><p>候选 ${formatMetric(item.candidateCreators)} 位 · 待首审 ${formatMetric(item.manualRound1Queue)} 位</p><p>正式白名单 ${formatMetric(item.formalWhitelist)} · 合格话题 ${formatMetric(item.qualifiedTopics)}</p></button>`).join("")}</div></section>`;
}

export function renderCreatorPage({ data, index, view, filters }) {
  const filtered = filterCandidates(data.candidates, filters);
  const heading = renderPageHeading({
    eyebrow: `CREATOR INTELLIGENCE / ${data.date} / TRIAL`,
    title: "抖音达人白名单库及热点判断",
    subtitle: "候选、视频与话题分层审核；仅发布可回放证据，不把预筛结果冒充正式结论",
    views: creatorViews,
    activeView: view,
  });
  const summary = renderSummaryBand({
    summary: data.statusMessage,
    metrics: [
      { value: data.summary.candidateCreators, label: "候选达人" },
      { value: data.summary.manualRound1Queue, label: "待人工首审" },
      { value: data.summary.formalWhitelistA + data.summary.formalWhitelistB, label: "正式白名单" },
      { value: data.summary.successfulVideos, label: "成功复取视频" },
      { value: data.summary.qualifiedTopics, label: "合格热点" },
    ],
    observedAt: formatDateTime(data.observedAt),
    sourceWorkbook: "抖音公开页 + 双轮审计快照",
  });
  const trialBanner = `<div class="trial-banner">${icon("flask-conical")}<div><strong>试运行预览，不是正式白名单</strong><span>正式 A/B 白名单 0 · 合格热点 0 · 内容推荐 0；候选状态会随人工首审、第二轮复核和 Day 7 验收变化。</span></div></div>`;
  let content;
  if (view === "signals") content = renderSignals(data);
  else if (view === "coverage") content = renderCoverage(data);
  else if (view === "rules") content = renderRules(data);
  else if (view === "archive") content = renderArchive(index);
  else content = `${renderToolbar(data, filters, filtered.length)}${renderCandidateTable(filtered, data.videoSignals, data.observedAt)}`;
  return `${heading}${trialBanner}${summary}${content}`;
}

export function renderCreatorDetail(candidate, data) {
  const gateEvidence = gateSignals(candidate);
  const gates = candidate.gates || {};
  const refetch = candidate.refetch || {};
  const gateFacts = factGrid([
    ["90 天有效作品", `${formatMetric(gates.validVideos90d)} 条 / 门槛 15`],
    ["相关内容占比", `${formatPercent(gates.relevantRatio)} / 门槛 60%`],
    ["核心实操下界", `${formatPercent(gates.corePracticeLowerBound)} / 人工门槛 40%`],
    ["60 天相关作品", `${formatMetric(gates.relatedVideos60d)} 条 / 门槛 6`],
    ["最近相关作品", gates.latestRelatedAgeDays == null ? "缺失" : `${escapeHtml(gates.latestRelatedAgeDays)} 天前`],
    ["自动门槛结果", statusChip(candidate.dispositionLabel, DISPOSITION_CLASS[candidate.autoDisposition] || "")],
  ]);
  const signalList = `<div class="drawer-signal-list">${gateEvidence.map((signal) => `<div class="${signal.pass ? "is-pass" : "is-missing"}"><span>${signal.pass ? icon("check") : icon("minus")}</span><strong>${escapeHtml(signal.label)}</strong><small>${signal.pass ? "已有证据" : "待补证据"}</small></div>`).join("")}</div>`;
  const refetchFacts = factGrid([
    ["目标视频", formatMetric(refetch.targetVideos)],
    ["成功复取", formatMetric(refetch.successfulVideos)],
    ["有效增量", formatMetric(refetch.validIncrements)],
    ["计数回落", formatMetric(refetch.countDecreases)],
    ["复取状态", escapeHtml(candidate.refetchStatus)],
    ["播放量", "缺失，不估填"],
  ]);
  const profileUrl = safeUrl(candidate.profileUrl);
  const html = `<div class="drawer-actions"><a class="command-button primary" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">${icon("external-link")}打开抖音主页</a><button class="command-button" type="button" data-drawer-command="copy">${icon("copy")}复制审核摘要</button></div>
    <div class="drawer-formal-warning">${icon("circle-alert")}<span><strong>${escapeHtml(candidate.formalStatus)}</strong>。该达人当前仅属于候选池，不能对外称为白名单达人。</span></div>
    ${detailSection("达人事实", "user-round", factGrid([
      ["候选 ID", `<span class="mono">${escapeHtml(candidate.id)}</span>`],
      ["粉丝快照", `${escapeHtml(formatFollowers(candidate.followers))}（${formatMetric(candidate.followers)}）`],
      ["候选赛道", escapeHtml((candidate.tracks || []).join("、") || "缺失")],
      ["匹配作品", `${formatMetric(candidate.videosLoaded)} 条`],
      ["主页作品卡", `${formatMetric(candidate.profileVideoCards)} 条`],
      ["当前排名", formatMetric(candidate.rank)],
    ]))}
    ${detailSection("硬门槛证据", "shield-check", `${renderEvidenceRail(candidate)}<div class="drawer-gate-facts">${gateFacts}</div>`)}
    ${detailSection("证据状态", "scan-line", signalList)}
    ${detailSection("16:00 复取", "refresh-cw", refetchFacts)}
    ${detailSection("实时热点列表", "radio-tower", renderCreatorRealtimeHotspots(candidate, data))}
    ${detailSection("待办与风险", "clipboard-check", `<strong>人工核验</strong>${listHtml(gates.manualChecks, "无")}<br><strong>自动门槛未通过项</strong>${listHtml(gates.automatedFailures, "无")}<br><strong>风险词命中</strong>${listHtml(gates.riskTermsDetected, "无")}`)}
  `;
  const realtimeSignals = creatorRealtimeSignals(data?.videoSignals, candidate.id);
  const copyText = `【达人候选审核｜${candidate.nickname}】\n候选ID：${candidate.id}\n粉丝快照：${formatMetric(candidate.followers)}\n候选赛道：${(candidate.tracks || []).join("、") || "缺失"}\n自动预筛：${candidate.dispositionLabel}\n正式状态：${candidate.formalStatus}\n90天有效作品：${formatMetric(gates.validVideos90d)}\n相关占比：${formatPercent(gates.relevantRatio)}\n复取：${formatMetric(refetch.successfulVideos)}/${formatMetric(refetch.targetVideos)}\n实时热点观察：${realtimeSignals.length} 条；已验证热点：0\n主页：${profileUrl}`;
  return { eyebrow: `${candidate.id} · 候选达人`, title: candidate.nickname, html, copyText };
}
