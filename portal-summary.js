window.GEO_PORTAL_SUMMARY = {
  "schema_version": 1,
  "generated_at": "2026-07-20",
  "period": {
    "start": "2026-07-09",
    "end": "2026-07-20"
  },
  "hero_metrics": [
    {
      "key": "data_date",
      "label": "数据更新",
      "value": "2026-07-20",
      "unit": "",
      "source": "多模块摘要",
      "context": "跨模块摘要；各指标按自身截至日标注"
    },
    {
      "key": "valid_samples",
      "label": "累计有效样本",
      "value": 626,
      "unit": "",
      "source": "GEO 样本监测",
      "context": "第一轮 576 + 第二轮 50，为跨轮次累计 · 截至 2026-07-20"
    },
    {
      "key": "round2_mention_rate",
      "label": "第二轮提及率",
      "value": 88,
      "unit": "%",
      "source": "第二轮复测",
      "context": "第二轮 · 44/50 条有效样本 · 截至 2026-07-20"
    },
    {
      "key": "unique_citation_urls",
      "label": "唯一引用来源",
      "value": 2355,
      "unit": "",
      "source": "引用源分析",
      "context": "引用源报告 · 唯一规范化 URL · 截至 2026-07-15"
    }
  ],
  "modules": [
    {
      "id": "sampling",
      "label": "GEO 样本监测",
      "status": "active",
      "updated_at": "2026-07-20",
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
          "value": 50,
          "unit": "/282",
          "source": "./top01-round2/"
        }
      ],
      "insights": [
        {
          "text": "第一轮完成 576 个有效样本，蝉妈妈提及率为 94.6%，TOP3 率为 46%。",
          "source_href": "./top01/",
          "as_of": "2026-07-14"
        },
        {
          "text": "第二轮当前完成 50/282 个有效样本，提及率为 88%。采样未完成，暂不作终局判断。",
          "source_href": "./top01-round2/",
          "as_of": "2026-07-20"
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
          "status": "sampling"
        },
        {
          "label": "两周趋势对比",
          "href": "./top01-two-week-compare/",
          "kind": "comparison",
          "status": "sampling"
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
        }
      ]
    },
    {
      "id": "citation",
      "label": "引用源分析",
      "status": "active",
      "updated_at": "2026-07-15",
      "href": "./douyin-citation-report/",
      "description": "拆解豆包回答引用了哪些页面、账号与内容类型。",
      "metrics": [
        {
          "key": "citation_events",
          "label": "去重引用事件",
          "value": 9936,
          "unit": "",
          "source": "./douyin-citation-report/"
        },
        {
          "key": "unique_urls",
          "label": "唯一 URL",
          "value": 2355,
          "unit": "",
          "source": "./douyin-citation-report/"
        },
        {
          "key": "douyin_event_share",
          "label": "抖音事件占比",
          "value": 22.6,
          "unit": "%",
          "source": "./douyin-citation-report/"
        },
        {
          "key": "douyin_question_share",
          "label": "抖音问题覆盖",
          "value": 95.8,
          "unit": "%",
          "source": "./douyin-citation-report/"
        }
      ],
      "insights": [
        {
          "text": "共识别 9936 次去重引用事件和 2355 个唯一 URL，抖音来源覆盖 95.8% 的问题。",
          "source_href": "./douyin-citation-report/",
          "as_of": "2026-07-15"
        }
      ],
      "views": [
        {
          "label": "引用源仪表盘",
          "href": "./douyin-citation-report/",
          "kind": "report",
          "status": "complete"
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
    },
    {
      "id": "more",
      "label": "更多研究",
      "status": "active",
      "updated_at": null,
      "href": "./chanjing-ai/",
      "description": "查看蝉镜 AI 双端 GEO 观察。",
      "metrics": [],
      "insights": [],
      "views": [
        {
          "label": "蝉镜 AI",
          "href": "./chanjing-ai/",
          "kind": "research",
          "status": "active"
        }
      ]
    }
  ]
};
