import {
  hotspotFilterDefaults,
  hotspotViews,
  renderHotspotDetail,
  renderHotspotPage,
} from "./hotspots.js";
import {
  eventFilterDefaults,
  eventViews,
  renderEventDetail,
  renderEventPage,
} from "./events.js";
import {
  creatorFilterDefaults,
  creatorViews,
  renderCreatorDetail,
  renderCreatorPage,
} from "./creators.js";
import { escapeHtml, icon, renderError } from "./ui.js";

const app = document.querySelector("#app");
const dateSelect = document.querySelector("#date-select");
const previousDate = document.querySelector("#previous-date");
const nextDate = document.querySelector("#next-date");
const updateStamp = document.querySelector("#update-stamp");
const drawer = document.querySelector("#detail-drawer");
const drawerBackdrop = document.querySelector("#drawer-backdrop");
const drawerEyebrow = document.querySelector("#drawer-eyebrow");
const drawerTitle = document.querySelector("#drawer-title");
const drawerContent = document.querySelector("#drawer-content");
const closeDrawerButton = document.querySelector("#close-drawer");
const toast = document.querySelector("#toast");

const state = {
  module: "hotspots",
  date: null,
  view: "overview",
  index: null,
  data: null,
  filters: { ...hotspotFilterDefaults },
  drawerDetail: null,
  requestId: 0,
};

const cache = new Map();
let filterTimer = null;
let toastTimer = null;

function createIcons() {
  window.lucide?.createIcons?.({ attrs: { "aria-hidden": "true" } });
}

async function fetchJson(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    }));
  }
  return cache.get(url);
}

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const module = ["hotspots", "events", "creators"].includes(parts[0]) ? parts[0] : "hotspots";
  return { module, requestedDate: parts[1] || "latest", view: parts[2] || "overview" };
}

function navigate(module, date = "latest", view = "overview") {
  const target = `#/${module}/${date}/${view}`;
  if (location.hash === target) loadRoute();
  else location.hash = target;
}

function validView(module, view) {
  const views = module === "hotspots" ? hotspotViews : module === "events" ? eventViews : creatorViews;
  return views.some((item) => item.id === view) ? view : "overview";
}

function resetFilters(module) {
  state.filters = module === "hotspots"
    ? { ...hotspotFilterDefaults }
    : module === "events"
      ? { ...eventFilterDefaults }
      : { ...creatorFilterDefaults };
}

function renderHeader() {
  document.querySelectorAll("[data-module]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.module === state.module);
  });
  const dates = state.index.dates;
  dateSelect.innerHTML = dates.map((item) => `<option value="${escapeHtml(item.date)}" ${item.date === state.date ? "selected" : ""}>${escapeHtml(item.date)}</option>`).join("");
  const position = dates.findIndex((item) => item.date === state.date);
  previousDate.disabled = position < 0 || position >= dates.length - 1;
  nextDate.disabled = position <= 0;
  previousDate.dataset.targetDate = previousDate.disabled ? "" : dates[position + 1].date;
  nextDate.dataset.targetDate = nextDate.disabled ? "" : dates[position - 1].date;
  updateStamp.textContent = state.module === "hotspots"
    ? `观察 ${state.data.observedAt}`
    : state.module === "events"
      ? `复核 ${state.data.verifiedAt}`
      : state.data.decision
        ? `决策 ${state.data.decision.decisionAsOf}`
        : `试运行 ${state.data.observedAt}`;
  const title = state.module === "hotspots"
    ? "每日热点"
    : state.module === "events"
      ? "活动追踪"
      : "抖音达人白名单库及热点判断";
  document.title = `${title}｜每日热点库与电商圈层行业活动追踪`;
}

function renderCurrent({ restoreFilter = null, selectionStart = null } = {}) {
  if (!state.data || !state.index) return;
  app.innerHTML = state.module === "hotspots"
    ? renderHotspotPage({ data: state.data, index: state.index, view: state.view, filters: state.filters })
    : state.module === "events"
      ? renderEventPage({ data: state.data, index: state.index, view: state.view, filters: state.filters })
      : renderCreatorPage({ data: state.data, index: state.index, view: state.view, filters: state.filters });
  createIcons();
  if (restoreFilter) {
    const input = app.querySelector(`[data-filter="${CSS.escape(restoreFilter)}"]`);
    if (input) {
      input.focus({ preventScroll: true });
      if (typeof input.setSelectionRange === "function" && selectionStart != null) input.setSelectionRange(selectionStart, selectionStart);
    }
  }
}

async function loadRoute() {
  const requestId = ++state.requestId;
  const route = parseRoute();
  closeDrawer();
  if (route.module !== state.module) resetFilters(route.module);
  state.module = route.module;
  state.view = validView(route.module, route.view);
  const loadingLabel = route.module === "hotspots" ? "热点历史" : route.module === "events" ? "活动快照" : "达人试运行快照";
  app.innerHTML = `<div class="loading-state"><span class="loading-line"></span><span>正在读取${loadingLabel}</span></div>`;
  createIcons();

  try {
    const index = await fetchJson(`./data/${route.module}/index.json`);
    const requestedDate = route.requestedDate === "latest" ? index.latest : route.requestedDate;
    const date = index.dates.some((item) => item.date === requestedDate) ? requestedDate : index.latest;
    const data = await fetchJson(`./data/${route.module}/${date}.json`);
    if (route.module === "creators") {
      const fetchOptional = async (url) => {
        try {
          return await fetchJson(url);
        } catch (error) {
          if (!String(error.message).startsWith("404")) throw error;
          return null;
        }
      };
      [data.decision, data.qualityReview] = await Promise.all([
        fetchOptional(`./data/creators/decisions/${date}.json`),
        fetchOptional(`./data/creators/quality-review/${date}.json`),
      ]);
    }
    if (requestId !== state.requestId) return;
    state.index = index;
    state.date = date;
    state.data = data;
    renderHeader();
    renderCurrent();
  } catch (error) {
    if (requestId !== state.requestId) return;
    app.innerHTML = renderError(`数据读取失败：${error.message}`);
    createIcons();
  }
}

function findRecord(id) {
  if (state.module === "hotspots") return state.data.candidates.find((candidate) => candidate.id === id);
  if (state.module === "events") return state.data.events.find((event) => event.eventId === id);
  return state.data.candidates.find((candidate) => candidate.id === id);
}

function openDrawer(id) {
  const record = findRecord(id);
  if (!record) return;
  const detail = state.module === "hotspots"
    ? renderHotspotDetail(record)
    : state.module === "events"
      ? renderEventDetail(record)
      : renderCreatorDetail(record, state.data);
  state.drawerDetail = detail;
  drawerEyebrow.textContent = detail.eyebrow;
  drawerTitle.textContent = detail.title;
  drawerContent.innerHTML = detail.html;
  drawerBackdrop.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  drawer.classList.add("is-open");
  document.body.style.overflow = "hidden";
  createIcons();
  closeDrawerButton.focus({ preventScroll: true });
}

function closeDrawer() {
  if (!drawer.classList.contains("is-open")) return;
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  drawerBackdrop.hidden = true;
  document.body.style.overflow = "";
  state.drawerDetail = null;
}

async function copyDrawerSummary() {
  if (!state.drawerDetail?.copyText) return;
  try {
    await navigator.clipboard.writeText(state.drawerDetail.copyText);
    showToast("摘要已复制");
  } catch {
    const input = document.createElement("textarea");
    input.value = state.drawerDetail.copyText;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast("摘要已复制");
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
}

document.querySelector(".module-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-module]");
  if (button) navigate(button.dataset.module, "latest", "overview");
});

dateSelect.addEventListener("change", () => navigate(state.module, dateSelect.value, state.view));
previousDate.addEventListener("click", () => {
  if (previousDate.dataset.targetDate) navigate(state.module, previousDate.dataset.targetDate, state.view);
});
nextDate.addEventListener("click", () => {
  if (nextDate.dataset.targetDate) navigate(state.module, nextDate.dataset.targetDate, state.view);
});

app.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    navigate(state.module, state.date, viewButton.dataset.view);
    return;
  }
  const archiveButton = event.target.closest("[data-route-date]");
  if (archiveButton) {
    navigate(state.module, archiveButton.dataset.routeDate, "overview");
    return;
  }
  if (event.target.closest("a")) return;
  const record = event.target.closest("[data-open-id]");
  if (record) openDrawer(record.dataset.openId);
});

app.addEventListener("input", (event) => {
  const control = event.target.closest("[data-filter]");
  if (!control) return;
  const filter = control.dataset.filter;
  state.filters[filter] = control.value;
  clearTimeout(filterTimer);
  const selectionStart = control.selectionStart;
  filterTimer = setTimeout(() => renderCurrent({ restoreFilter: filter, selectionStart }), control.type === "search" ? 120 : 0);
});

app.addEventListener("change", (event) => {
  const control = event.target.closest("[data-filter]");
  if (!control || control.type === "search") return;
  state.filters[control.dataset.filter] = control.value;
  renderCurrent();
});

drawerContent.addEventListener("click", (event) => {
  const command = event.target.closest("[data-drawer-command]");
  if (command?.dataset.drawerCommand === "copy") copyDrawerSummary();
});
closeDrawerButton.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});

window.addEventListener("hashchange", loadRoute);
if (!location.hash) navigate("hotspots", "latest", "overview");
else loadRoute();
createIcons();
