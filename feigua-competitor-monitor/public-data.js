window.FEIGUA_PUBLIC_DATA = Object.freeze({
  meta: {
    dataDate: "2026-08-07",
    edition: "PUBLIC_WHITELIST_V1",
    scope: "OFFICIAL_PUBLIC_SOURCES_ONLY"
  },
  metrics: [
    { label: "公开来源", value: "1", note: "飞瓜官方公开入口" },
    { label: "已核验动态", value: "0", note: "当前无可公开记录" },
    { label: "受限信息披露", value: "0", note: "与公开版物理隔离" },
    { label: "GEO 指标披露", value: "0", note: "本版未纳入" }
  ],
  sources: [
    {
      name: "飞瓜数据官网",
      type: "官方公开入口",
      status: "已登记并可独立访问",
      verifiedOn: "2026-08-07",
      url: "https://www.feigua.cn/"
    }
  ],
  updates: [],
  disclosureBoundary: [
    { label: "登录态公告", publicRecordCount: 0 },
    { label: "账号、套餐与地区信息", publicRecordCount: 0 },
    { label: "内部分级与行动建议", publicRecordCount: 0 },
    { label: "内部证据文件与截图", publicRecordCount: 0 },
    { label: "KOL 候选与身份记录", publicRecordCount: 0 },
    { label: "受限来源明细及派生统计", publicRecordCount: 0 },
    { label: "广告监控数据与推断", publicRecordCount: 0 }
  ]
});
