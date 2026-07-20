import {
  detailSection,
  escapeHtml,
  factGrid,
  firstLine,
  formatDateTime,
  formatEventRange,
  icon,
  listHtml,
  renderDecisionStrip,
  renderEmpty,
  renderPageHeading,
  renderSummaryBand,
  sourceLinksHtml,
  statusChip,
  uniqueOptions,
} from "./ui.js";

export const eventViews = [
  { id: "overview", label: "活动总览" },
  { id: "meeting", label: "会议视图" },
  { id: "archive", label: "每日归档" },
  { id: "keywords", label: "圈层词库" },
  { id: "verification", label: "抓取验证" },
];

export const eventFilterDefaults = {
  search: "",
  city: "all",
  priority: "all",
  verification: "all",
  keywordCategory: "all",
  keywordPriority: "all",
};

function priorityClass(priority) {
  if (priority === "优先准备") return "status-prepare";
  if (priority === "重点观察") return "status-watch";
  if (priority === "已取消") return "status-cancelled";
  return "status-agenda";
}

function verificationClass(result) {
  const text = String(result || "");
  return text.includes("冲突") || text.includes("失败") ? "status-conflict" : "status-pass";
}

function filterEvents(events, filters) {
  const search = String(filters.search || "").trim().toLowerCase();
  return events.filter((event) => {
    const matchesSearch = !search || [event.name, event.city, event.attentionReason, event.chanmamaRelevance, event.recommendedAction, event.focusTopics.join(" ")]
      .some((value) => String(value || "").toLowerCase().includes(search));
    const matchesCity = filters.city === "all" || event.city === filters.city;
    const matchesPriority = filters.priority === "all" || event.priority === filters.priority;
    const matchesVerification = filters.verification === "all"
      || (filters.verification === "pass" && !event.verificationResult.includes("冲突"))
      || (filters.verification === "conflict" && event.verificationResult.includes("冲突"))
      || (filters.verification === "gaps" && event.missingFields.length > 0);
    return matchesSearch && matchesCity && matchesPriority && matchesVerification;
  });
}

function renderToolbar(data, filters, count) {
  const cities = uniqueOptions(data.events.map((event) => event.city));
  return `<div class="toolbar"><div class="filter-group">
    <label class="search-box">${icon("search")}<input type="search" data-filter="search" value="${escapeHtml(filters.search)}" placeholder="搜索活动、议题、城市或动作"></label>
    <label class="filter-select">${icon("map-pin")}<select data-filter="city" aria-label="筛选城市"><option value="all">全部城市</option>${cities.map((city) => `<option value="${escapeHtml(city)}" ${filters.city === city ? "selected" : ""}>${escapeHtml(city)}</option>`).join("")}</select></label>
    <label class="filter-select">${icon("signal-high")}<select data-filter="priority" aria-label="筛选关注级别">
      <option value="all">全部级别</option>${["优先准备", "重点观察", "待补议程", "已取消"].map((priority) => `<option value="${priority}" ${filters.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}
    </select></label>
    <label class="filter-select">${icon("shield-check")}<select data-filter="verification" aria-label="筛选核验状态">
      <option value="all">全部核验</option><option value="pass" ${filters.verification === "pass" ? "selected" : ""}>核验通过</option><option value="conflict" ${filters.verification === "conflict" ? "selected" : ""}>存在冲突</option><option value="gaps" ${filters.verification === "gaps" ? "selected" : ""}>存在缺失</option>
    </select></label>
  </div><span class="result-count">${count} / ${data.events.length} 场</span></div>`;
}

function renderOverviewTable(events) {
  if (!events.length) return `<div class="data-region">${renderEmpty("当前筛选条件下没有活动")}</div>`;
  const rows = events.map((event) => `<tr data-open-id="${escapeHtml(event.eventId)}">
    <td>${statusChip(event.priority, priorityClass(event.priority))}<span class="cell-secondary">${escapeHtml(event.changeStatus === "new" ? "首次入库" : event.changeStatus)}</span></td>
    <td><span class="cell-primary">${escapeHtml(event.name)}</span><span class="cell-secondary">${escapeHtml(event.city)}｜${escapeHtml(event.eventType)}</span></td>
    <td>${sourceLinksHtml(event.sourceLinks, 2)}</td>
    <td><span class="cell-primary mono">${formatEventRange(event.startAt, event.endAt)}</span><span class="cell-secondary">${escapeHtml(event.interventionWindow)}</span></td>
    <td><span class="cell-primary">${escapeHtml(event.focusTopics.join("；") || "待补议程")}</span></td>
    <td><span class="cell-primary">${escapeHtml(event.attentionReason)}</span></td>
    <td><span class="cell-primary">${escapeHtml(event.chanmamaRelevance)}</span><span class="cell-secondary">动作：${escapeHtml(event.recommendedAction)}</span></td>
    <td>${statusChip(event.evidenceLevel, "status-pass")}<span class="cell-secondary">${escapeHtml(event.verificationResult)}<br>缺失 ${event.missingFields.length}｜冲突 ${event.conflicts.length}</span></td>
  </tr>`).join("");
  const mobile = events.map((event) => `<article class="mobile-item" data-open-id="${escapeHtml(event.eventId)}">
    <div class="mobile-item-header">${statusChip(event.priority, priorityClass(event.priority))}${statusChip(event.evidenceLevel, "status-pass")}</div>
    <h3>${escapeHtml(event.name)}</h3>
    <div class="mobile-facts"><div class="mobile-fact"><span>举办时间</span><strong>${escapeHtml(formatDateTime(event.startAt))}</strong></div><div class="mobile-fact"><span>城市</span><strong>${escapeHtml(event.city)}</strong></div></div>
    ${sourceLinksHtml(event.sourceLinks, 1)}
    <p><strong>活动重点：</strong>${escapeHtml(event.focusTopics.join("；") || "待补议程")}</p>
    <p><strong>建议动作：</strong>${escapeHtml(event.recommendedAction)}</p>
  </article>`).join("");
  return `<div class="data-region"><div class="data-table-wrap"><table class="data-table" style="min-width:1280px">
    <colgroup><col style="width:7%"><col style="width:14%"><col style="width:9%"><col style="width:12%"><col style="width:13%"><col style="width:14%"><col style="width:21%"><col style="width:10%"></colgroup>
    <thead><tr><th>关注级别</th><th>活动名称</th><th>原始来源</th><th>时间 / 介入窗口</th><th>活动重点</th><th>为什么关注</th><th>蝉妈妈关联 / 建议动作</th><th>证据 / 真实性</th></tr></thead><tbody>${rows}</tbody>
  </table></div><div class="mobile-list">${mobile}</div></div>`;
}

function renderMeeting(data) {
  const events = [...data.events]
    .sort((a, b) => ({ "优先准备": 0, "重点观察": 1, "待补议程": 2 }[a.priority] ?? 9) - ({ "优先准备": 0, "重点观察": 1, "待补议程": 2 }[b.priority] ?? 9) || a.startAt.localeCompare(b.startAt));
  const rows = events.map((event) => `<tr data-open-id="${escapeHtml(event.eventId)}">
    <td>${statusChip(event.priority, priorityClass(event.priority))}<span class="cell-primary">${escapeHtml(event.name)}</span></td>
    <td><span class="cell-primary mono">${formatEventRange(event.startAt, event.endAt)}</span><span class="cell-secondary">${escapeHtml(event.city)}</span></td>
    <td><span class="cell-primary">${escapeHtml(event.attentionReason)}</span></td>
    <td><span class="cell-primary">${escapeHtml(event.recommendedAction)}</span></td>
    <td><span class="cell-primary">${escapeHtml(event.interventionWindow)}</span></td>
  </tr>`).join("");
  const mobile = events.map((event) => `<article class="mobile-item" data-open-id="${escapeHtml(event.eventId)}"><div class="mobile-item-header">${statusChip(event.priority, priorityClass(event.priority))}<span class="mono">${escapeHtml(formatDateTime(event.startAt))}</span></div><h3>${escapeHtml(event.name)}</h3><p><strong>为什么关注：</strong>${escapeHtml(event.attentionReason)}</p><p><strong>动作：</strong>${escapeHtml(event.recommendedAction)}</p></article>`).join("");
  return `<section class="section-band"><div class="section-title"><h2>活动会议视图</h2><span>按级别和举办时间排序</span></div>
    <div class="data-table-wrap"><table class="data-table" style="min-width:920px"><colgroup><col style="width:22%"><col style="width:15%"><col style="width:25%"><col style="width:25%"><col style="width:13%"></colgroup>
      <thead><tr><th>级别 / 活动</th><th>时间 / 城市</th><th>为什么关注</th><th>建议动作</th><th>介入窗口</th></tr></thead><tbody>${rows}</tbody>
    </table></div><div class="mobile-list">${mobile}</div></section>`;
}

function renderArchive(index) {
  return `<section class="section-band"><div class="section-title"><h2>活动历史快照</h2><span>新增、变更与取消均保留</span></div><div class="archive-grid">
    ${index.dates.map((item) => `<button type="button" class="archive-item" data-route-date="${escapeHtml(item.date)}"><time>${escapeHtml(item.date)}</time><p>${item.total} 场活动｜优先准备 ${item.prepare} 场</p><p>观察 ${escapeHtml(item.observedAt)}｜复核 ${escapeHtml(item.verifiedAt)}</p></button>`).join("")}
  </div></section>`;
}

function renderKeywords(data, filters) {
  const categories = uniqueOptions(data.keywords.map((keyword) => keyword.category));
  const search = String(filters.search || "").trim().toLowerCase();
  const keywords = data.keywords.filter((keyword) => {
    const matchesSearch = !search || [keyword.keyword, keyword.aliases.join(" "), keyword.notes, keyword.source].some((value) => String(value || "").toLowerCase().includes(search));
    const matchesCategory = filters.keywordCategory === "all" || keyword.category === filters.keywordCategory;
    const matchesPriority = filters.keywordPriority === "all" || keyword.priority === filters.keywordPriority;
    return matchesSearch && matchesCategory && matchesPriority;
  });
  const toolbar = `<div class="toolbar"><div class="filter-group">
    <label class="search-box">${icon("search")}<input type="search" data-filter="search" value="${escapeHtml(filters.search)}" placeholder="搜索圈层、机构或行业黑话"></label>
    <label class="filter-select">${icon("tags")}<select data-filter="keywordCategory"><option value="all">全部分类</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${filters.keywordCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></label>
    <label class="filter-select">${icon("signal-high")}<select data-filter="keywordPriority"><option value="all">全部优先级</option>${["P0", "P1", "P2"].map((priority) => `<option value="${priority}" ${filters.keywordPriority === priority ? "selected" : ""}>${priority}</option>`).join("")}</select></label>
  </div><span class="result-count">${keywords.length} / ${data.keywords.length} 个词</span></div>`;
  if (!keywords.length) return `${toolbar}<div class="data-region">${renderEmpty("当前筛选条件下没有关键词")}</div>`;
  const rows = keywords.map((keyword) => `<tr><td>${statusChip(keyword.priority, keyword.priority === "P0" ? "status-prepare" : "")}</td><td><span class="cell-primary">${escapeHtml(keyword.keyword)}</span><span class="cell-secondary">${escapeHtml(keyword.aliases.join(" / ") || "无别名")}</span></td><td>${escapeHtml(keyword.category)}</td><td><span class="cell-primary">${escapeHtml(keyword.contextRequired.join(" / ") || "无")}</span><span class="cell-secondary">排除：${escapeHtml(keyword.excludeContext.join(" / ") || "无")}</span></td><td>${escapeHtml(keyword.matchType)}</td><td><span class="cell-primary">${escapeHtml(keyword.source)}</span><span class="cell-secondary">${escapeHtml(keyword.verificationStatus)}</span></td><td>${escapeHtml(keyword.notes)}</td></tr>`).join("");
  return `${toolbar}<div class="data-region"><div class="data-table-wrap" style="display:block"><table class="data-table" style="min-width:1080px"><colgroup><col style="width:7%"><col style="width:18%"><col style="width:12%"><col style="width:20%"><col style="width:10%"><col style="width:15%"><col style="width:18%"></colgroup><thead><tr><th>优先级</th><th>关键词 / 别名</th><th>分类</th><th>上下文</th><th>匹配</th><th>来源 / 核验</th><th>备注</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderVerification(data) {
  const passCount = data.verificationLogs.filter((row) => row.status === "PASS").length;
  const issueCount = data.verificationLogs.filter((row) => row.status !== "PASS").length;
  const rows = data.verificationLogs.map((row) => `<tr data-open-id="${escapeHtml(row.event_id)}"><td class="mono">${escapeHtml(row.verification_id)}</td><td><span class="cell-primary">${escapeHtml(data.events.find((event) => event.eventId === row.event_id)?.name || row.event_id)}</span><span class="cell-secondary">${escapeHtml(row.check_type)}</span></td><td class="mono">${escapeHtml(row.checked_at)}</td><td>${statusChip(row.status, row.status === "PASS" ? "status-pass" : "status-conflict")}</td><td><span class="cell-primary">${escapeHtml(row.evidence)}</span><span class="cell-secondary">范围：${escapeHtml(row.scope_or_field)}</span></td><td><span class="cell-primary">${escapeHtml(row.issue)}</span><span class="cell-secondary">动作：${escapeHtml(row.action)}</span></td></tr>`).join("");
  return `<section class="section-band"><div class="section-title"><h2>三重复核记录</h2><span>通过 ${passCount}｜带冲突或缺失 ${issueCount}</span></div>
    <div class="data-table-wrap" style="display:block"><table class="data-table" style="min-width:1120px"><colgroup><col style="width:9%"><col style="width:20%"><col style="width:14%"><col style="width:11%"><col style="width:24%"><col style="width:22%"></colgroup><thead><tr><th>复核ID</th><th>活动 / 类型</th><th>时间</th><th>状态</th><th>证据 / 范围</th><th>问题 / 动作</th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

export function renderEventPage({ data, index, view, filters }) {
  const filtered = filterEvents(data.events, filters);
  const counts = data.summary.counts;
  const heading = renderPageHeading({
    eyebrow: `EVENT INTELLIGENCE / ${data.date}`,
    title: "电商圈层行业活动追踪",
    subtitle: "提前发现活动、核对真实性，并把议程转成搜索与执行机会",
    views: eventViews,
    activeView: view,
  });
  const summary = renderSummaryBand({
    summary: data.summary.webSummary,
    metrics: [
      { value: counts.total, label: "未来一个月活动" },
      { value: counts.prepare, label: "优先准备" },
      { value: counts.watch, label: "重点观察" },
      { value: counts.urgent, label: "7天内开场" },
      { value: counts.conflicts, label: "存在字段冲突" },
    ],
    observedAt: data.observedAt,
    verifiedAt: data.verifiedAt,
    sourceWorkbook: data.sourceLabel ?? data.sourceWorkbook,
  });
  const decisions = renderDecisionStrip(data.summary.topActions, "eventId");
  let content;
  if (view === "meeting") content = renderMeeting(data);
  else if (view === "archive") content = renderArchive(index);
  else if (view === "keywords") content = renderKeywords(data, filters);
  else if (view === "verification") content = renderVerification(data);
  else content = `${renderToolbar(data, filters, filtered.length)}${renderOverviewTable(filtered)}`;
  return `${heading}${summary}${decisions}${content}`;
}

export function renderEventDetail(event) {
  const sourceContent = event.sourceLinks.length
    ? `<div class="source-stack">${event.sourceLinks.map((link) => sourceLinksHtml([link], 1)).join("")}</div>`
    : `<p class="drawer-prose">来源暂缺</p>`;
  const agendaContent = event.agendaTopics.length
    ? event.agendaTopics.map((topic) => `<div class="drawer-section" style="padding:12px 0;border-bottom:1px solid var(--border)"><strong>${escapeHtml(topic.topic)}</strong><p class="drawer-prose">${escapeHtml(topic.shareability)}</p><p class="cell-secondary">搜索词：${escapeHtml(topic.search_keywords.join("、"))}</p>${listHtml(topic.user_questions, "用户问题暂缺")}</div>`).join("")
    : `<p class="drawer-prose">详细议程暂缺，不生成具体爆点判断。</p>`;
  const verificationTimeline = `<ul class="timeline">${event.verificationLogs.map((row) => `<li><time>${escapeHtml(row.checked_at)} · ${escapeHtml(row.status)}</time><strong>${escapeHtml(row.check_type)}</strong><div class="cell-secondary">${escapeHtml(row.evidence)}｜${escapeHtml(row.issue)}</div></li>`).join("")}</ul>`;
  const html = `<div class="drawer-actions">
      ${event.sourceLinks[0] ? `<a class="command-button primary" href="${escapeHtml(event.sourceLinks[0].url)}" target="_blank" rel="noopener noreferrer">${icon("external-link")}打开原始来源</a>` : ""}
      <button class="command-button" type="button" data-drawer-command="copy">${icon("copy")}复制活动摘要</button>
    </div>
    ${detailSection("活动事实", "calendar-check", factGrid([
      ["时间", `<span class="mono">${formatEventRange(event.startAt, event.endAt)}</span>`],
      ["城市 / 地点", `${escapeHtml(event.city)}<br>${escapeHtml(event.venue)}`],
      ["主办", escapeHtml(event.organizers.join("；") || "暂缺")],
      ["合作 / 涉及", escapeHtml(event.partners.join("；") || "无")],
      ["目标人群", escapeHtml(event.audience)],
      ["嘉宾", escapeHtml(event.guests)],
      ["人数口径", escapeHtml(event.attendance.reported || "未披露")],
      ["证据等级", statusChip(event.evidenceLevel, "status-pass")],
    ]))}
    ${detailSection("原始证据", "link", sourceContent)}
    ${detailSection("议程与潜在爆点", "sparkles", agendaContent)}
    ${detailSection("与蝉妈妈的关联", "waypoints", `<p class="drawer-prose">${escapeHtml(event.chanmamaRelevance)}</p>`)}
    ${detailSection("建议动作", "list-checks", `<p class="drawer-prose">${escapeHtml(event.recommendedAction)}</p><p class="drawer-prose"><strong>介入窗口：</strong>${escapeHtml(event.interventionWindow)}</p>`)}
    ${detailSection("缺失与冲突", "triangle-alert", `<strong>缺失字段</strong>${listHtml(event.missingFields, "无")}<br><strong>冲突记录</strong>${listHtml(event.conflicts, "无")}`)}
    ${detailSection("复核时间线", "route", verificationTimeline)}
  `;
  const copyText = `【${event.priority}｜${event.name}】\n时间：${formatDateTime(event.startAt)}\n城市：${event.city}\n活动重点：${event.focusTopics.join("；") || "待补议程"}\n为什么关注：${event.attentionReason}\n建议动作：${event.recommendedAction}\n真实性：${event.evidenceLevel}，${event.verificationResult}\n原始来源：${event.sourceLinks[0]?.url || "暂缺"}`;
  return { eyebrow: `${event.eventId} · ${event.priority}`, title: event.name, html, copyText };
}
