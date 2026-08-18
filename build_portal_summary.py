from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = ROOT / "portal-summary.js"


def read_window_json(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8-sig").strip()
    if "=" not in text:
        raise ValueError(f"Missing window assignment in {path}")
    payload = text.split("=", 1)[1].lstrip()
    value, _ = json.JSONDecoder().raw_decode(payload)
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {path}")
    return value


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {path}")
    return value


def number(value: Any) -> float | int | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return int(parsed) if parsed.is_integer() else parsed


def total(rows: list[dict[str, Any]], key: str) -> float | int | None:
    values = [number(row.get(key)) for row in rows]
    present = [value for value in values if value is not None]
    return sum(present) if present else None


def rate(numerator: float | int | None, denominator: float | int | None) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return round(float(numerator) * 100 / float(denominator), 1)


def display(value: float | int | None, suffix: str = "") -> str:
    if value is None:
        return "暂无数据"
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return f"{value}{suffix}"


def data_date(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    return value[:10]


def metric(
    key: str,
    label: str,
    value: Any,
    unit: str,
    source: str,
    context: str | None = None,
) -> dict[str, Any]:
    item = {"key": key, "label": label, "value": value, "unit": unit, "source": source}
    if context:
        item["context"] = context
    return item


def build_summary(root: Path = ROOT) -> dict[str, Any]:
    baseline = read_window_json(root / "top01" / "dashboard-data.js")
    round2 = read_window_json(root / "top01-round2" / "dashboard-data.js")
    baseline_citation = read_json(root / "douyin-citation-report" / "analysis_summary.json")
    citation = read_json(root / "douyin-citation-report-round2" / "analysis_summary.json")
    chanjing = read_json(root / "chanjing-ai" / "dashboard-summary.json")
    chanquanquan = read_json(root / "chanquanquan-geo" / "dashboard-data.json")
    chanquanquan_citation = read_json(root / "chanquanquan-citation-report" / "dashboard-data.json")
    account_latest = read_json(root / "account-matrix" / "data" / "latest.json")
    hotspot_index = read_json(root / "daily-hotspot" / "data" / "hotspots" / "index.json")
    event_index = read_json(root / "daily-hotspot" / "data" / "events" / "index.json")
    creator_index = read_json(root / "daily-hotspot" / "data" / "creators" / "index.json")
    creative = read_json(root / "chanmama-creative-geo" / "dashboard-progress.json")

    baseline_rows = baseline.get("summary") or []
    baseline_samples = total(baseline_rows, "completed_sample_count")
    baseline_mentions = total(baseline_rows, "mention_count")
    baseline_top3 = total(baseline_rows, "top3_chanmama_count")
    baseline_mention_rate = rate(baseline_mentions, baseline_samples)
    baseline_top3_rate = rate(baseline_top3, baseline_samples)

    round2_summary = round2.get("summary") or {}
    round2_valid = number(round2_summary.get("valid_sample_count"))
    round2_planned = number(round2_summary.get("planned_sample_count"))
    round2_mentions = number(round2_summary.get("chanmama_mention_count"))
    round2_mention_rate = number(round2_summary.get("chanmama_mention_rate_pct"))
    round2_top3_rate = number(round2_summary.get("chanmama_top3_rate_pct"))

    citation_core = citation.get("core") or {}
    citation_events = number(citation_core.get("deduplicated_citation_events"))
    unique_urls = number(citation_core.get("unique_canonical_urls"))
    douyin_event_share = number(citation_core.get("douyin_video_event_share_pct"))
    douyin_question_share = number(citation_core.get("question_douyin_video_rate_pct"))

    chanjing_collected = number(chanjing.get("collected"))
    chanjing_planned = number(chanjing.get("planned_slots"))
    chanjing_unresolved = number(chanjing.get("unresolved_count"))
    cqq_checkpoint = chanquanquan.get("checkpoint") or {}
    cqq_collected = number(cqq_checkpoint.get("collected"))
    cqq_planned = number(cqq_checkpoint.get("planned"))
    cqq_citation_summary = chanquanquan_citation.get("summary") or {}
    cqq_citation_inventory = cqq_citation_summary.get("citation_inventory") or {}
    creative_progress = creative.get("progress") or {}
    creative_current = number(creative_progress.get("externalSubmissions"))
    creative_planned = number(creative_progress.get("plannedSlots"))

    baseline_date = data_date((baseline.get("meta") or {}).get("generated_at"))
    round2_date = data_date((round2.get("meta") or {}).get("generated_at"))
    citation_date = data_date((citation.get("meta") or {}).get("generated_at"))
    chanjing_date = data_date(chanjing.get("generated_at"))
    cqq_date = data_date(((chanquanquan.get("metrics") or {}).get("generated_at")))
    account_date = data_date(account_latest.get("reportDate"))
    hotspot_date = data_date(hotspot_index.get("latest"))
    event_date = data_date(event_index.get("latest"))
    creator_date = data_date(creator_index.get("latest"))
    creative_date = data_date(creative_progress.get("currentDay"))
    generated_at = max(
        date
        for date in (
            baseline_date,
            round2_date,
            citation_date,
            chanjing_date,
            cqq_date,
            account_date,
            hotspot_date,
            event_date,
            creator_date,
            creative_date,
        )
        if date
    )
    valid_sample_values = [value for value in (baseline_samples, round2_valid) if value is not None]
    cumulative_valid_samples = sum(valid_sample_values) if valid_sample_values else None

    sampling_views = [
        {"label": "第一轮核心问题", "href": "./top01/", "kind": "baseline", "status": "complete"},
        {"label": "第二轮复测", "href": "./top01-round2/", "kind": "round", "status": "complete"},
        {"label": "两周趋势对比", "href": "./top01-two-week-compare/", "kind": "comparison", "status": "complete"},
        {"label": "扩展问题", "href": "./top2-top3/", "kind": "scope", "status": "complete"},
        {"label": "全部问题总览", "href": "./total/", "kind": "scope", "status": "complete"},
    ]

    return {
        "schema_version": 1,
        "generated_at": generated_at,
        "period": {
            "start": data_date(((baseline_citation.get("core") or {}).get("sample_time_min"))) or baseline_date,
            "end": round2_date or baseline_date,
        },
        "hero_metrics": [
            metric(
                "data_date",
                "最新模块更新",
                generated_at,
                "",
                "多模块摘要",
                "跨模块摘要；各指标按自身截至日标注",
            ),
            metric(
                "valid_samples",
                "累计有效样本",
                cumulative_valid_samples,
                "",
                "GEO 样本监测",
                f"第一轮 {display(baseline_samples)} + 第二轮 {display(round2_valid)}，为跨轮次累计 · 样本截至 {round2_date}",
            ),
            metric(
                "round2_mention_rate",
                "第二轮提及率",
                round2_mention_rate,
                "%",
                "第二轮复测",
                f"第二轮 · {display(round2_mentions)}/{display(round2_valid)} 条有效样本 · 截至 {round2_date}",
            ),
            metric(
                "unique_citation_urls",
                "唯一引用来源",
                unique_urls,
                "",
                "引用源分析",
                f"第二轮引用源报告 · 唯一规范化 URL · 截至 {citation_date}",
            ),
        ],
        "modules": [
            {
                "id": "sampling",
                "label": "GEO 样本监测",
                "status": "complete",
                "updated_at": round2_date or baseline_date,
                "href": "./top01/",
                "description": "持续观察蝉妈妈在核心业务问题中的出现、排序与优势表达。",
                "metrics": [
                    metric("baseline_samples", "第一轮样本", baseline_samples, "", "./top01/"),
                    metric("baseline_mention_rate", "第一轮提及率", baseline_mention_rate, "%", "./top01/"),
                    metric("baseline_top3_rate", "第一轮 TOP3 率", baseline_top3_rate, "%", "./top01/"),
                    metric("round2_progress", "第二轮有效样本", round2_valid, f"/{display(round2_planned)}", "./top01-round2/"),
                ],
                "insights": [
                    {
                        "text": f"第一轮完成 {display(baseline_samples)} 个有效样本，蝉妈妈提及率为 {display(baseline_mention_rate, '%')}，TOP3 率为 {display(baseline_top3_rate, '%')}。",
                        "source_href": "./top01/",
                        "as_of": baseline_date,
                    },
                    {
                        "text": f"第二轮完成 {display(round2_valid)}/{display(round2_planned)} 个有效样本，提及率为 {display(round2_mention_rate, '%')}，两轮全量复测已完成。",
                        "source_href": "./top01-round2/",
                        "as_of": round2_date,
                    },
                ],
                "views": sampling_views,
            },
            {
                "id": "citation",
                "label": "引用源分析",
                "status": "complete",
                "updated_at": citation_date,
                "href": "./douyin-citation-report-round2/",
                "description": "拆解两轮豆包回答引用了哪些页面、账号与内容类型。",
                "metrics": [
                    metric("citation_events", "去重引用事件", citation_events, "", "./douyin-citation-report-round2/"),
                    metric("unique_urls", "唯一 URL", unique_urls, "", "./douyin-citation-report-round2/"),
                    metric("douyin_event_share", "抖音视频事件占比", douyin_event_share, "%", "./douyin-citation-report-round2/"),
                    metric("douyin_question_share", "抖音视频问题覆盖", douyin_question_share, "%", "./douyin-citation-report-round2/"),
                ],
                "insights": [
                    {
                        "text": f"共识别 {display(citation_events)} 次去重引用事件和 {display(unique_urls)} 个唯一 URL，抖音来源覆盖 {display(douyin_question_share, '%')} 的问题。",
                        "source_href": "./douyin-citation-report-round2/",
                        "as_of": citation_date,
                    }
                ],
                "views": [
                    {"label": "第一轮引用源", "href": "./douyin-citation-report/", "kind": "report", "status": "complete"},
                    {"label": "第二轮引用源", "href": "./douyin-citation-report-round2/", "kind": "report", "status": "complete"},
                    {"label": "蝉圈圈引用源", "href": "./chanquanquan-citation-report/", "kind": "report", "status": "complete"},
                ],
            },
            {
                "id": "product_geo",
                "label": "产品 GEO",
                "status": "active",
                "updated_at": creative_date,
                "href": "./chanmama-creative-geo/",
                "description": "集中查看蝉镜、蝉圈圈与蝉妈妈创意的 GEO 状态。",
                "metrics": [
                    metric("chanjing_progress", "蝉镜采样", chanjing_collected, f"/{display(chanjing_planned)}", "./chanjing-ai/"),
                    metric("chanjing_unresolved", "蝉镜未决", chanjing_unresolved, "", "./chanjing-ai/"),
                    metric("cqq_progress", "蝉圈圈采样", cqq_collected, f"/{display(cqq_planned)}", "./chanquanquan-geo/"),
                    metric("cqq_citations", "蝉圈圈引用", number(cqq_citation_inventory.get("citation_rows")), "", "./chanquanquan-citation-report/"),
                    metric("creative_progress", "创意 GEO 提交", creative_current, f"/{display(creative_planned)}", "./chanmama-creative-geo/"),
                ],
                "insights": [
                    {
                        "text": f"蝉圈圈已完成 {display(cqq_collected)}/{display(cqq_planned)} 个冻结样本，GEO 与引用源仪表盘均为最终 FULL。",
                        "source_href": "./chanquanquan-geo/",
                        "as_of": cqq_date,
                    },
                    {
                        "text": f"蝉妈妈创意 GEO 当前提交 {display(creative_current)}/{display(creative_planned)}，冻结清单尚未到达，只展示进度，不形成结果结论。",
                        "source_href": "./chanmama-creative-geo/",
                        "as_of": creative_date,
                    },
                ],
                "views": [
                    {"label": "蝉镜 AI", "href": "./chanjing-ai/", "kind": "research", "status": "complete_with_gaps"},
                    {"label": "蝉圈圈 GEO", "href": "./chanquanquan-geo/", "kind": "research", "status": "complete"},
                    {"label": "蝉妈妈创意 GEO", "href": "./chanmama-creative-geo/", "kind": "research", "status": "progress_only"},
                ],
            },
            {
                "id": "operations",
                "label": "运营工作台",
                "status": "active",
                "updated_at": max(date for date in (account_date, hotspot_date, event_date, creator_date) if date),
                "href": "./daily-hotspot/",
                "description": "查看账号矩阵、热点、行业活动与达人追踪。",
                "metrics": [],
                "insights": [],
                "views": [
                    {"label": "账号矩阵日报", "href": "./account-matrix/", "kind": "operations", "status": "active"},
                    {"label": "热点与行业活动", "href": "./daily-hotspot/", "kind": "operations", "status": "active"},
                ],
            },
            {
                "id": "competitor",
                "label": "实时监控飞瓜",
                "status": "planned",
                "updated_at": None,
                "href": None,
                "description": "每日实时监控飞瓜的数据、改动、优势等全方面",
                "metrics": [],
                "insights": [],
                "views": [],
            },
        ],
    }


def render(summary: dict[str, Any]) -> str:
    payload = json.dumps(summary, ensure_ascii=False, indent=2, separators=(",", ": "))
    return f"window.GEO_PORTAL_SUMMARY = {payload};\n"


def validate(summary: dict[str, Any], rendered: str) -> None:
    if summary.get("schema_version") != 1:
        raise ValueError("Unsupported summary schema")
    if not summary.get("generated_at"):
        raise ValueError("Missing generated_at")
    if len(rendered.encode("utf-8")) >= 50_000:
        raise ValueError("portal-summary.js exceeds 50 KB")
    for module in summary.get("modules") or []:
        for insight in module.get("insights") or []:
            if not insight.get("source_href") or not insight.get("as_of"):
                raise ValueError(f"Insight lacks evidence metadata: {module.get('id')}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Verify the generated file without rewriting it")
    args = parser.parse_args()

    summary = build_summary()
    rendered = render(summary)
    validate(summary, rendered)

    if args.check:
        if not OUTPUT_PATH.exists() or OUTPUT_PATH.read_text(encoding="utf-8") != rendered:
            raise SystemExit("portal-summary.js is not up to date")
        print(f"OK: {OUTPUT_PATH.name} ({len(rendered.encode('utf-8'))} bytes)")
        return 0

    OUTPUT_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT_PATH.name} ({len(rendered.encode('utf-8'))} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
