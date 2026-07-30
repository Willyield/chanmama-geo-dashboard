const SHANGHAI_TIME_ZONE = "Asia/Shanghai";

export const shanghaiDateKey = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const round = (value, digits = 4) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const aggregateMetric = (records, metric) => {
  const values = records.map((record) => record.metrics?.[metric]).filter(Number.isFinite);
  const knownCount = values.length;
  const totalCount = records.length;
  return {
    total: totalCount === 0 ? 0 : knownCount ? values.reduce((sum, value) => sum + value, 0) : null,
    average: knownCount ? round(values.reduce((sum, value) => sum + value, 0) / knownCount) : null,
    median: round(median(values)),
    knownCount,
    totalCount,
    coverage: totalCount ? round(knownCount / totalCount) : null,
  };
};

export const buildFilteredPublishCohort = (records, dateKeys) => {
  const groups = new Map(dateKeys.map((date) => [date, []]));
  for (const record of records) {
    const date = shanghaiDateKey(record.publishedAt);
    if (groups.has(date)) groups.get(date).push(record);
  }
  return dateKeys.map((date) => {
    const group = groups.get(date);
    return {
      date,
      contentCount: group.length,
      views: aggregateMetric(group, "views"),
    };
  });
};

export const selectTrendPoints = (points, days) => {
  const safeDays = days === 7 ? 7 : 30;
  return points.slice(-safeDays);
};

const summarizePeriod = (records, dateKeys, categoryIds) => {
  const allowedDates = new Set(dateKeys);
  const rows = records.filter((record) => allowedDates.has(shanghaiDateKey(record.publishedAt)));
  const views = aggregateMetric(rows, "views");
  return {
    from: dateKeys[0],
    to: dateKeys.at(-1),
    contentCount: rows.length,
    activeSourceCount: new Set(rows.map((record) => record.sourceId)).size,
    views,
    categories: categoryIds.map((categoryId) => {
      const count = rows.filter((record) => record.categoryId === categoryId).length;
      return {
        categoryId,
        count,
        share: rows.length ? round(count / rows.length) : null,
      };
    }),
  };
};

export const buildClassificationComparison = (records, dateKeys, categoryIds) => {
  if (dateKeys.length < 14) throw new Error("classification comparison requires at least 14 date keys");
  return {
    previous7: summarizePeriod(records, dateKeys.slice(-14, -7), categoryIds),
    latest7: summarizePeriod(records, dateKeys.slice(-7), categoryIds),
  };
};

export const buildClassificationDelta = (comparison) => {
  const latest = comparison.latest7;
  const previous = comparison.previous7;
  const previousCategories = new Map(previous.categories.map((category) => [category.categoryId, category]));
  const rows = latest.categories.map((category) => {
    const previousCategory = previousCategories.get(category.categoryId) || { count: 0, share: null };
    return {
      categoryId: category.categoryId,
      latestCount: category.count,
      latestShare: category.share,
      previousCount: previousCategory.count,
      previousShare: previousCategory.share,
      countDelta: category.count - previousCategory.count,
      shareDelta: Number.isFinite(category.share) && Number.isFinite(previousCategory.share)
        ? round(category.share - previousCategory.share)
        : null,
    };
  });
  const leadingGrowth = [...rows].sort((left, right) =>
    right.countDelta - left.countDelta || right.latestCount - left.latestCount,
  )[0] || null;
  const leadingCategory = [...rows].sort((left, right) =>
    right.latestCount - left.latestCount || right.countDelta - left.countDelta,
  )[0] || null;
  const contentDelta = latest.contentCount - previous.contentCount;
  return {
    rows,
    contentDelta,
    contentChange: previous.contentCount ? round(contentDelta / previous.contentCount) : null,
    activeSourceDelta: latest.activeSourceCount - previous.activeSourceCount,
    leadingGrowth,
    leadingCategory,
  };
};

export const buildLineGeometry = (points, valueOf, {
  width,
  height,
  top = 16,
  bottom = 22,
} = {}) => {
  const values = points.map(valueOf);
  const finiteValues = values.filter(Number.isFinite);
  const maximum = Math.max(1, ...finiteValues);
  const usableHeight = Math.max(1, height - top - bottom);
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const plotted = values.map((value, index) => ({
    value,
    x: points.length > 1 ? index * step : width / 2,
    y: Number.isFinite(value) ? top + usableHeight * (1 - value / maximum) : null,
  }));
  const paths = [];
  let current = [];
  for (const point of plotted) {
    if (point.y === null) {
      if (current.length) paths.push(current);
      current = [];
    } else current.push(point);
  }
  if (current.length) paths.push(current);
  return { maximum, points: plotted, paths };
};

export const metricCoverageLabel = (metric) => {
  if (!metric || metric.totalCount === 0) return "当日无发布";
  if (metric.knownCount === metric.totalCount) return `数据完整 · ${metric.knownCount}篇`;
  return `已知${metric.knownCount}篇 / 共${metric.totalCount}篇`;
};

export const matchesPublishedDate = (record, publishedDate) =>
  !publishedDate || shanghaiDateKey(record.publishedAt) === publishedDate;
