(function () {
  "use strict";

  const data = window.FEIGUA_PUBLIC_DATA;
  if (!data) {
    document.body.dataset.state = "data-missing";
    return;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderMetrics() {
    const target = document.getElementById("metric-strip");
    data.metrics.forEach((metric) => {
      const item = element("article", "metric-item");
      item.append(
        element("span", "metric-label", metric.label),
        element("strong", "metric-value", metric.value),
        element("small", "metric-note", metric.note)
      );
      target.append(item);
    });
  }

  function renderSources() {
    const target = document.getElementById("source-table");
    data.sources.forEach((source) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("th");
      nameCell.scope = "row";
      nameCell.textContent = source.name;
      const typeCell = element("td", "", source.type);
      const statusCell = document.createElement("td");
      statusCell.append(element("span", "source-status", source.status));
      const dateCell = element("td", "numeric", source.verifiedOn);
      const actionCell = document.createElement("td");
      const link = element("a", "source-link", "打开官网");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      actionCell.append(link);
      row.append(nameCell, typeCell, statusCell, dateCell, actionCell);
      target.append(row);
    });
  }

  function renderUpdates() {
    const target = document.getElementById("update-list");
    document.getElementById("verified-update-count").textContent = String(data.updates.length);
    if (data.updates.length === 0) {
      const empty = element("div", "empty-state");
      empty.append(
        element("strong", "", "暂无公开动态"),
        element("p", "", "当前没有同时满足官方公开、日期明确和可独立复核三项条件的记录。")
      );
      target.append(empty);
      return;
    }
  }

  function renderBoundary() {
    const target = document.getElementById("boundary-grid");
    data.disclosureBoundary.forEach((item) => {
      const card = element("article", "boundary-item");
      const marker = element("span", "boundary-marker", "未披露");
      const count = element("strong", "boundary-count", String(item.publicRecordCount));
      count.setAttribute("aria-label", `${item.label}公开记录 ${item.publicRecordCount} 条`);
      card.append(marker, element("h3", "", item.label), count, element("small", "", "公开记录"));
      target.append(card);
    });
  }

  function activateTab(nextTab) {
    const tabs = Array.from(document.querySelectorAll("[role='tab']"));
    const panels = Array.from(document.querySelectorAll("[role='tabpanel']"));
    tabs.forEach((tab) => {
      const active = tab === nextTab;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === nextTab.dataset.view;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function bindTabs() {
    const tabs = Array.from(document.querySelectorAll("[role='tab']"));
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const offset = event.key === "ArrowRight" ? 1 : -1;
        const next = tabs[(index + offset + tabs.length) % tabs.length];
        activateTab(next);
        next.focus();
      });
    });
  }

  document.getElementById("data-date").textContent = data.meta.dataDate;
  document.getElementById("edition-label").textContent = data.meta.edition;
  renderMetrics();
  renderSources();
  renderUpdates();
  renderBoundary();
  bindTabs();
  document.body.dataset.state = "ready";
})();
