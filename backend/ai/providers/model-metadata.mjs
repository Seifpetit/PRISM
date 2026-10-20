export function inferModelTier(modelId) {
  const id = modelId.toLowerCase();
  if (/nano|mini|lite|haiku|flash$|sonar$/.test(id)) return "fast";
  if (/opus|pro|reason|deep|research|5\.1|5\.2|5\.5|5\.6/.test(id)) return "powerful";
  return "balanced";
}

export function modelOption(id, label = id) {
  return { id, label, tier: inferModelTier(id) };
}
