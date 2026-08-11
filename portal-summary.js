window.GEO_PORTAL_SUMMARY = {
  schema_version: 2,
  generated_at: "2026-08-11T13:52:14+08:00",
  latest_data_as_of: "2026-08-07",
  hero_metrics: [
    {
      key: "round2_final_samples",
      label: "第二轮最终样本",
      value: 576,
      unit: "",
      numerator: 576,
      denominator: 576,
      scope: "GEO 第二轮最终样本",
      as_of: "2026-08-04",
      source_href: "./top01-round2/"
    },
    {
      key: "round2_mention_rate",
      label: "蝉妈妈提及率",
      value: 96.70,
      unit: "%",
      numerator: 557,
      denominator: 576,
      scope: "GEO 第二轮回答正文",
      as_of: "2026-08-04",
      source_href: "./top01-round2/"
    },
    {
      key: "round2_unique_urls",
      label: "唯一引用 URL",
      value: 2662,
      unit: "",
      numerator: 2662,
      denominator: null,
      scope: "第二轮规范化唯一 URL",
      as_of: "2026-08-04",
      source_href: "./douyin-citation-report-round2/"
    },
    {
      key: "round2_feigua_coverage",
      label: "飞瓜官网回答覆盖",
      value: 33.68,
      unit: "%",
      numerator: 194,
      denominator: 576,
      scope: "GEO 第二轮回答",
      as_of: "2026-08-04",
      source_href: "./top01-two-week-compare/"
    }
  ],
  changes: [
    {
      key: "mention_rate_change",
      label: "蝉妈妈提及率",
      value: 2.08,
      unit: "pp",
      numerator: 557,
      denominator: 576,
      scope: "第二轮 96.70% vs 第一轮 94.62%",
      as_of: "2026-08-04",
      source_href: "./top01-two-week-compare/",
      direction: "up"
    },
    {
      key: "unique_urls_change",
      label: "唯一规范化 URL",
      value: 307,
      unit: "",
      numerator: 2662,
      denominator: 2355,
      scope: "第二轮 2,662 vs 第一轮 2,355",
      as_of: "2026-08-04",
      source_href: "./douyin-citation-report-round2/",
      direction: "up"
    },
    {
      key: "feigua_coverage_change",
      label: "飞瓜官网回答覆盖",
      value: -20.66,
      unit: "pp",
      numerator: 194,
      denominator: 576,
      scope: "第二轮 33.68% vs 第一轮 54.34%",
      as_of: "2026-08-04",
      source_href: "./top01-two-week-compare/",
      direction: "down"
    }
  ],
  module_groups: [
    {
      id: "geo",
      label: "GEO 样本",
      items: [
        { label: "第一轮核心问题", href: "./top01/", note: "基线 576", status: "可用" },
        { label: "第二轮最终结果", href: "./top01-round2/", note: "576/576", status: "最终" },
        { label: "两轮趋势对比", href: "./top01-two-week-compare/", note: "可比变化", status: "可用" },
        { label: "扩展问题", href: "./top2-top3/", note: "TOP2 + TOP3", status: "可用" },
        { label: "全部问题总览", href: "./total/", note: "TOP0 - TOP3", status: "可用" }
      ]
    },
    {
      id: "citation",
      label: "引用源",
      items: [
        { label: "第一轮引用源", href: "./douyin-citation-report/", note: "2,355 URL", status: "基线" },
        { label: "第二轮引用源", href: "./douyin-citation-report-round2/", note: "2,662 URL", status: "最终" },
        { label: "蝉圈圈引用源", href: "./chanquanquan-citation-report/", note: "7,161 行", status: "最终" }
      ]
    },
    {
      id: "monitoring",
      label: "公开监控",
      items: [
        { label: "飞瓜每日监控", href: "./feigua-competitor-monitor/", note: "公开入口 1", status: "可用" }
      ]
    },
    {
      id: "more",
      label: "更多研究",
      items: [
        { label: "蝉镜 AI", href: "./chanjing-ai/", note: "双端观察", status: "可用" },
        { label: "蝉圈圈 GEO", href: "./chanquanquan-geo/", note: "730 样本", status: "最终" }
      ]
    }
  ]
};
