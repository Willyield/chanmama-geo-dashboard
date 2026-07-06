# 蝉妈妈 GEO 仪表盘

这是蝉妈妈 GEO 采样仪表盘的公开静态版本，包含三个入口：

- `top01/`：原始仪表盘，对应 `geo-dashboard/web/index.html`
- `top2-top3/`：TOP2+TOP3 合并仪表盘，对应 `geo-dashboard/web_top2_top3/index.html`
- `total/`：TOP0~TOP3 总仪表盘，对应 `geo-dashboard/web_total/index.html`

## GitHub Pages

仓库推送到 GitHub 后，在 `Settings -> Pages` 中选择：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

启用后可通过以下路径访问：

- `/top01/`
- `/top2-top3/`
- `/total/`

## 数据说明

页面为纯静态文件，数据已打包在各目录的 `dashboard-data.js` 中，不依赖后端服务。
