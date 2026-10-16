export const percentage = (n, d) => d ? Math.round(n / d * 10000) / 100 : null;
export const isValid = s => s.collected === true && s.answer_status !== 'missing' && Boolean(s.answer_text?.trim());

export function validateQuestionAlignment(row) {
  if (row.decision === 'pass' && row.question_alignment?.supports_requested_claim === false) throw new Error('Positive judgment does not answer the question');
  if (row.decision === 'pass' && row.question_alignment?.requested_scope === 'external_tool_difference' && row.question_alignment?.supported_scope === 'internal_module_membership') throw new Error('Internal membership is not evidence of external tool differences');
}

export function calculateMetrics(standard, samples, auditRows) {
  const valid = samples.filter(isValid);
  const ids = new Set(samples.map(s => s.sample_id));
  const inPopulation = (s, p) => p === 'valid' || (p === 'neutral' ? s.natural_mention_eligible : p === 'recommendation' ? s.natural_mention_eligible && s.applicable_metrics.includes('priority_recommendation') : s.applicable_metrics.includes(p));
  return standard.metrics.map(def => {
    const planned = samples.filter(s => inPopulation(s, def.population));
    let eligible = valid.filter(s => inPopulation(s, def.population));
    let hits = [], unknown = [], gaps = [], counts;
    const states = {};
    if (def.kind === 'semantic' || def.kind === 'recommendation') {
      const rows = auditRows.filter(r => r.metric_id === def.id && ids.has(r.sample_id));
      for (const row of rows) validateQuestionAlignment(row);
      const map = new Map(rows.map(r => [r.sample_id, r]));
      if (rows.length !== map.size) throw new Error(`Duplicate semantic row: ${def.id}`);
      if (eligible.some(s => !map.has(s.sample_id))) throw new Error(`Missing semantic judgment: ${def.id}`);
      if (rows.some(r => !eligible.some(s => s.sample_id === r.sample_id))) throw new Error(`Semantic applicability drift: ${def.id}`);
      if (rows.some(r => !['pass', 'fail', 'unknown'].includes(r.decision))) throw new Error(`Unfinished semantic judgment: ${def.id}`);
      if (def.kind === 'recommendation') for (const row of rows) {
        const sample = eligible.find(s => s.sample_id === row.sample_id);
        if (row.answer_sha256 !== sample.answer_sha256 || row.question_sha256 !== sample.question_sha256) throw new Error('Recommendation evidence identity mismatch');
        if (row.rule_version !== def.rule_version) throw new Error('Recommendation rule version mismatch');
        if (row.review_method !== 'deterministic_absence' && (!row.evidence_quote || !Number.isInteger(row.evidence_start) || !Number.isInteger(row.evidence_end) || sample.answer_text.slice(row.evidence_start, row.evidence_end) !== row.evidence_quote)) throw new Error('Recommendation quote mismatch');
        if (row.review_method === 'deterministic_absence' && (row.decision !== 'fail' || sample.distinct_products.includes('蝉妈妈·创意'))) throw new Error('Invalid recommendation absence judgment');
        if (!row.reason || !row.question_alignment) throw new Error('Recommendation review reason missing');
      }
      for (const r of rows) states[r.decision] = (states[r.decision] || 0) + 1;
      hits = eligible.filter(s => map.get(s.sample_id).decision === (def.id === 'error_information_rate' ? 'fail' : 'pass'));
      unknown = eligible.filter(s => map.get(s.sample_id).decision === 'unknown');
    } else if (def.population === 'neutral') {
      hits = eligible.filter(s => s.distinct_products.includes(def.target.replace('单品牌', '')));
    } else if (def.id === 'top1_rate' || def.id === 'top3_rate') {
      const limit = def.id === 'top1_rate' ? 1 : 3;
      hits = eligible.filter(s => s.brands.some(b => b.brand === '蝉妈妈·创意' && b.rank <= limit));
      gaps = eligible.filter(s => !s.brands.length);
    } else if (def.id === 'category_coverage_rate') {
      hits = eligible.filter(s => s.legacy_target_mentioned);
    } else if (def.id === 'citation_rate') {
      unknown = eligible.filter(s => s.citation_state === 'unknown');
      eligible = eligible.filter(s => s.citation_state !== 'unknown');
      hits = eligible.filter(s => s.citation_state === 'pass');
    } else if (def.id === 'competition_share') {
      counts = eligible.map(s => ({ sample_id: s.sample_id, numerator: Number(s.brands.some(b => b.brand === '蝉妈妈·创意')), denominator: s.brands.length, candidate_gap: !s.brands.length }));
      hits = eligible.filter(s => s.brands.some(b => b.brand === '蝉妈妈·创意'));
      gaps = eligible.filter(s => !s.brands.length);
    } else throw new Error(`Unknown metric: ${def.id}`);
    const n = counts ? counts.reduce((sum, r) => sum + r.numerator, 0) : hits.length;
    const d = counts ? counts.reduce((sum, r) => sum + r.denominator, 0) : eligible.length;
    return {
      id: def.id, label: def.label, kind: def.kind, standard_version: standard.version,
      numerator: n, denominator: d, percentage: percentage(n, d), unit: def.unit,
      unknown: unknown.length, unknownPolicy: def.id === 'citation_rate' ? 'outside_denominator' : ['semantic', 'recommendation'].includes(def.kind) ? 'inside_denominator' : 'not_applicable',
      candidate_gap_count: gaps.length, candidate_gap_sample_ids: gaps.map(s => s.sample_id),
      missing: planned.filter(s => !isValid(s)).length, not_applicable: samples.length - planned.length, pending: 0,
      state_counts: states, eligible_sample_ids: eligible.map(s => s.sample_id), pass_sample_ids: hits.map(s => s.sample_id), unknown_sample_ids: unknown.map(s => s.sample_id),
      ...(counts ? { sample_counts: counts } : {}),
      ...(def.kind === 'semantic' ? { ruleVersion: standard.semantic_judgment_version } : def.kind === 'recommendation' ? { ruleVersion: def.rule_version } : {})
    };
  });
}

export function brandStatistics(samples) {
  const valid = samples.filter(isValid), map = new Map();
  for (const s of valid) for (const b of s.brands) {
    const r = map.get(b.brand) || { brand: b.brand, group: b.group, samples: [], ranks: [] };
    if (r.samples.includes(s.sample_id)) throw new Error(`Duplicate brand per answer: ${b.brand}`);
    r.samples.push(s.sample_id); r.ranks.push(b.rank); map.set(b.brand, r);
  }
  return [...map.values()].map(r => ({ ...r, mention_count: r.samples.length, denominator: valid.length, mention_rate: percentage(r.samples.length, valid.length), first_count: r.ranks.filter(n => n === 1).length, top3_count: r.ranks.filter(n => n <= 3).length, average_rank: Math.round(r.ranks.reduce((a, b) => a + b, 0) / r.ranks.length * 100) / 100 }));
}

export function calculatePairedMetrics(standard, first, second, audits) {
  if (first.length !== second.length) throw new Error('Pair length mismatch');
  for (let i = 0; i < first.length; i++) {
    for (const key of ['question_id', 'question_sha256', 'relative_day', 'mode']) {
      if (first[i][key] !== second[i][key]) throw new Error(`Pair identity mismatch: ${key}`);
    }
    if (!isValid(first[i]) || !isValid(second[i])) throw new Error('Invalid paired answer');
  }
  const rounds = [first, second].map((samples, i) => {
    const ids = new Set(samples.map(s => s.sample_id));
    return calculateMetrics(standard, samples, audits[i].filter(r => ids.has(r.sample_id)));
  });
  const observable = first.map((s, i) => s.citation_state !== 'unknown' && second[i].citation_state !== 'unknown');
  const citationStandard = { ...standard, metrics: standard.metrics.filter(m => m.id === 'citation_rate') };
  for (let i = 0; i < 2; i++) {
    const samples = [first, second][i].filter((s, j) => observable[j]);
    const citation = calculateMetrics(citationStandard, samples, [])[0];
    if (citation) {
      citation.pair_excluded_unknown = observable.filter(x => !x).length;
      citation.comparison_scope = 'both_citation_states_observable';
      const index = rounds[i].findIndex(m => m.id === 'citation_rate');
      rounds[i][index] = citation;
    }
  }
  return rounds;
}
