export function applyCreatorIdentityCorrection(data) {
  const correction = data?.identityCorrection;
  if (!correction) return data;
  data.candidates = correction.candidates;
  data.summary = correction.summary;
  return data;
}
