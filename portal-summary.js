window.GEO_PORTAL_SUMMARY = {
  "schema_version": 1,
  "generated_at": "2026-09-03",
  "period": {
    "start": "2026-07-09",
    "end": "2026-09-03"
  },
  "hero_metrics": [
    {
      "key": "data_date",
      "label": "最新模块更新",
      "value": "2026-09-03",
      "unit": "",
      "source": "多模块摘要",
      "context": "跨模块摘要；各指标按自身截至日标注"
    },
    {
      "key": "valid_samples",
      "label": "累计有效样本",
      "value": 1152,
      "unit": "",
      "source": "GEO 样本监测",
      "context": "第一轮 576 + 第二轮 576，为跨轮次累计 · 样本截至 2026-08-04"
    },
    {
      "key": "round2_mention_rate",
      "label": "第二轮提及率",
      "value": 96.7,
      "unit": "%",
      "source": "第二轮复测",
      "context": "第二轮 · 557/576 条有效样本 · 截至 2026-08-04"
    },
    {
      "key": "unique_citation_urls",
      "label": "唯一引用来源",
      "value": 2662,
      "unit": "",
      "source": "引用源分析",
      "context": "第二轮引用源报告 · 唯一规范化 URL · 截至 2026-08-04"
    }
  ],
  "modules": [
    {
      "id": "sampling",
      "label": "GEO 样本监测",
      "status": "complete",
      "updated_at": "2026-09-03",
      "href": "./top01/",
      "description": "持续观察蝉妈妈在核心业务问题中的出现、排序与优势表达。",
      "metrics": [
        {
          "key": "baseline_samples",
          "label": "第一轮样本",
          "value": 576,
          "unit": "",
          "source": "./top01/"
        },
        {
          "key": "baseline_mention_rate",
          "label": "第一轮提及率",
          "value": 94.6,
          "unit": "%",
          "source": "./top01/"
        },
        {
          "key": "baseline_top3_rate",
          "label": "第一轮 TOP3 率",
          "value": 46.0,
          "unit": "%",
          "source": "./top01/"
        },
        {
          "key": "round2_progress",
          "label": "第二轮有效样本",
          "value": 576,
          "unit": "/576",
          "source": "./top01-round2/"
        }
      ],
      "insights": [
        {
          "text": "蝉妈妈 BI 最新正式批次已完成 192/192 条采样与回收，共保留 3578 条引用证据。",
          "source_href": "./chanmama-bi/",
          "as_of": "2026-09-03"
        },
        {
          "text": "第一轮完成 576 个有效样本，蝉妈妈提及率为 94.6%，TOP3 率为 46%。",
          "source_href": "./top01/",
          "as_of": "2026-07-14"
        },
        {
          "text": "第二轮完成 576/576 个有效样本，提及率为 96.7%，两轮全量复测已完成。",
          "source_href": "./top01-round2/",
          "as_of": "2026-08-04"
        }
      ],
      "views": [
        {
          "label": "第一轮核心问题",
          "href": "./top01/",
          "kind": "baseline",
          "status": "complete"
        },
        {
          "label": "第二轮复测",
          "href": "./top01-round2/",
          "kind": "round",
          "status": "complete"
        },
        {
          "label": "两周趋势对比",
          "href": "./top01-two-week-compare/",
          "kind": "comparison",
          "status": "complete"
        },
        {
          "label": "扩展问题",
          "href": "./top2-top3/",
          "kind": "scope",
          "status": "complete"
        },
        {
          "label": "全部问题总览",
          "href": "./total/",
          "kind": "scope",
          "status": "complete"
        },
        {
          "label": "第三轮采样",
          "href": "./chanmama-bi/",
          "kind": "round",
          "status": "complete"
        }
      ]
    },
    {
      "id": "citation",
      "label": "引用源分析",
      "status": "complete",
      "updated_at": "2026-09-03",
      "href": "./douyin-citation-report-round2/",
      "description": "拆解两轮豆包回答引用了哪些页面、账号与内容类型。",
      "metrics": [
        {
          "key": "citation_events",
          "label": "去重引用事件",
          "value": 11934,
          "unit": "",
          "source": "./douyin-citation-report-round2/"
        },
        {
          "key": "unique_urls",
          "label": "唯一 URL",
          "value": 2662,
          "unit": "",
          "source": "./douyin-citation-report-round2/"
        },
        {
          "key": "douyin_event_share",
          "label": "抖音视频事件占比",
          "value": 17.45,
          "unit": "%",
          "source": "./douyin-citation-report-round2/"
        },
        {
          "key": "douyin_question_share",
          "label": "抖音视频问题覆盖",
          "value": 96.88,
          "unit": "%",
          "source": "./douyin-citation-report-round2/"
        }
      ],
      "insights": [
        {
          "text": "共识别 11934 次去重引用事件和 2662 个唯一 URL，抖音来源覆盖 96.88% 的问题。",
          "source_href": "./douyin-citation-report-round2/",
          "as_of": "2026-08-04"
        },
        {
          "text": "第三轮 191/192 个样本含引用，1 个确认无引用，共 3578 条引用明细。",
          "source_href": "./chanmama-bi-citation/",
          "as_of": "2026-09-03"
        }
      ],
      "views": [
        {
          "label": "第一轮引用源",
          "href": "./douyin-citation-report/",
          "kind": "report",
          "status": "complete"
        },
        {
          "label": "第二轮引用源",
          "href": "./douyin-citation-report-round2/",
          "kind": "report",
          "status": "complete"
        },
        {
          "label": "蝉圈圈引用源",
          "href": "./chanquanquan-citation-report/",
          "kind": "report",
          "status": "complete"
        },
        {
          "label": "创意引用源",
          "href": "./chanmama-creative-citation-report/",
          "kind": "report",
          "status": "complete_with_gaps"
        },
        {
          "label": "第三轮引用源",
          "href": "./chanmama-bi-citation/",
          "kind": "report",
          "status": "complete"
        }
      ]
    },
    {
      "id": "product_geo",
      "label": "产品 GEO",
      "status": "active",
      "updated_at": "2026-08-19",
      "href": "./chanmama-creative-geo/",
      "description": "集中查看蝉镜、蝉圈圈与蝉妈妈创意的 GEO 状态。",
      "metrics": [
        {
          "key": "chanjing_progress",
          "label": "蝉镜采样",
          "value": 519,
          "unit": "/520",
          "source": "./chanjing-ai/"
        },
        {
          "key": "chanjing_unresolved",
          "label": "蝉镜未决",
          "value": 1,
          "unit": "",
          "source": "./chanjing-ai/"
        },
        {
          "key": "cqq_progress",
          "label": "蝉圈圈采样",
          "value": 730,
          "unit": "/730",
          "source": "./chanquanquan-geo/"
        },
        {
          "key": "cqq_citations",
          "label": "蝉圈圈引用",
          "value": 7161,
          "unit": "",
          "source": "./chanquanquan-citation-report/"
        },
        {
          "key": "creative_progress",
          "label": "创意 GEO 提交",
          "value": 540,
          "unit": "/540",
          "source": "./chanmama-creative-geo/"
        },
        {
          "key": "creative_formal",
          "label": "创意 GEO 正式回答",
          "value": 538,
          "unit": "/540",
          "source": "./chanmama-creative-geo/"
        },
        {
          "key": "creative_unknown",
          "label": "创意 GEO 待恢复",
          "value": 2,
          "unit": "",
          "source": "./chanmama-creative-geo/"
        }
      ],
      "insights": [
        {
          "text": "蝉圈圈已完成 730/730 个冻结样本，GEO 与引用源仪表盘均为最终 FULL。",
          "source_href": "./chanquanquan-geo/",
          "as_of": "2026-08-07"
        },
        {
          "text": "蝉妈妈创意 GEO 两日共 540/540 个采样位置，538 条正式回答，2 条待恢复，状态为 FINAL_WITH_GAPS。",
          "source_href": "./chanmama-creative-geo/",
          "as_of": "2026-08-19"
        }
      ],
      "views": [
        {
          "label": "蝉镜 AI",
          "href": "./chanjing-ai/",
          "kind": "research",
          "status": "complete_with_gaps"
        },
        {
          "label": "蝉圈圈 GEO",
          "href": "./chanquanquan-geo/",
          "kind": "research",
          "status": "complete"
        },
        {
          "label": "蝉妈妈创意 GEO",
          "href": "./chanmama-creative-geo/",
          "kind": "research",
          "status": "complete_with_gaps"
        }
      ]
    },
    {
      "id": "operations",
      "label": "运营工作台",
      "status": "active",
      "updated_at": "2026-09-03",
      "href": "./daily-hotspot/",
      "description": "查看账号矩阵、热点、行业活动与达人追踪。",
      "metrics": [
        {
          "key": "account_count",
          "label": "已采集账号",
          "value": 11,
          "unit": "",
          "source": "./account-matrix/",
          "context": "463 条内容 · PARTIAL"
        },
        {
          "key": "account_content_count",
          "label": "矩阵内容",
          "value": 463,
          "unit": "",
          "source": "./account-matrix/",
          "context": "11 个账号 · 截至 2026-08-06"
        },
        {
          "key": "hotspot_count",
          "label": "正式热点候选",
          "value": 10,
          "unit": "",
          "source": "./daily-hotspot/",
          "context": "10 个优先 · 截至 2026-09-03"
        },
        {
          "key": "event_count",
          "label": "跟踪活动",
          "value": 4,
          "unit": "",
          "source": "./daily-hotspot/",
          "context": "2 场优先准备 · 截至 2026-09-03"
        }
      ],
      "insights": [
        {
          "text": "账号矩阵已采集 11 个账号、463 条内容；当前状态为 PARTIAL。",
          "source_href": "./account-matrix/",
          "as_of": "2026-08-06"
        },
        {
          "text": "热点工作台收录 10 个正式候选，其中 10 个优先；同步跟踪 4 场活动，2 场进入优先准备。",
          "source_href": "./daily-hotspot/",
          "as_of": "2026-09-03"
        }
      ],
      "views": [
        {
          "label": "账号矩阵日报",
          "href": "./account-matrix/",
          "kind": "operations",
          "status": "active"
        },
        {
          "label": "热点与行业活动",
          "href": "./daily-hotspot/",
          "kind": "operations",
          "status": "active"
        }
      ]
    },
    {
      "id": "competitor",
      "label": "实时监控飞瓜",
      "status": "planned",
      "updated_at": null,
      "href": null,
      "description": "每日实时监控飞瓜的数据、改动、优势等全方面",
      "metrics": [],
      "insights": [],
      "views": []
    }
  ]
};
