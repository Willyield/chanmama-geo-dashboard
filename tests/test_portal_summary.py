import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from build_portal_summary import build_summary, display, render, total, validate  # noqa: E402


class PortalSummaryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.summary = build_summary(ROOT)

    def test_real_source_metrics_are_aggregated(self):
        metrics = {item["key"]: item for item in self.summary["hero_metrics"]}
        self.assertEqual(metrics["valid_samples"]["value"], 1152)
        self.assertIn("第一轮 576 + 第二轮 576", metrics["valid_samples"]["context"])
        self.assertEqual(metrics["round2_mention_rate"]["value"], 96.7)
        self.assertIn("557/576 条有效样本", metrics["round2_mention_rate"]["context"])
        self.assertEqual(metrics["unique_citation_urls"]["value"], 2662)
        self.assertIn("截至 2026-08-04", metrics["unique_citation_urls"]["context"])
        self.assertEqual(self.summary["generated_at"], "2026-08-18")

    def test_planned_module_has_no_dead_link(self):
        competitor = next(item for item in self.summary["modules"] if item["id"] == "competitor")
        self.assertEqual(competitor["label"], "实时监控飞瓜")
        self.assertEqual(competitor["description"], "每日实时监控飞瓜的数据、改动、优势等全方面")
        self.assertEqual(competitor["status"], "planned")
        self.assertIsNone(competitor["href"])
        self.assertEqual(competitor["views"], [])

    def test_insights_are_dated_and_sourced(self):
        insights = [
            insight
            for module in self.summary["modules"]
            for insight in module.get("insights", [])
        ]
        self.assertEqual(len(insights), 5)
        self.assertTrue(all(item["as_of"] and item["source_href"] for item in insights))

    def test_complete_platform_modules_are_registered(self):
        modules = {item["id"]: item for item in self.summary["modules"]}
        self.assertEqual(modules["sampling"]["status"], "complete")
        self.assertEqual(modules["citation"]["status"], "complete")
        self.assertEqual(len(modules["citation"]["views"]), 3)
        self.assertEqual(len(modules["product_geo"]["views"]), 3)
        self.assertEqual(len(modules["operations"]["views"]), 2)
        creative = next(item for item in modules["product_geo"]["views"] if item["label"] == "蝉妈妈创意 GEO")
        self.assertEqual(creative["status"], "progress_only")

    def test_output_stays_lightweight(self):
        rendered = render(self.summary)
        validate(self.summary, rendered)
        self.assertLess(len(rendered.encode("utf-8")), 50_000)

    def test_missing_values_are_not_rendered_as_zero(self):
        self.assertIsNone(total([{}], "missing"))
        self.assertEqual(display(None), "暂无数据")


if __name__ == "__main__":
    unittest.main()
