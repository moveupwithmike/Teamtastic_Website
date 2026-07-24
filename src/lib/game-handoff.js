const GAME_ORIGIN = "https://teamtastic.games";

export function buildGameHandoffUrl({
  vibe = "",
  size = "",
  occasion = "",
  recommendation = "",
  submissionId = "",
} = {}) {
  const params = new URLSearchParams({
    vibe: String(vibe),
    size: String(size),
    occasion: String(occasion),
    recommendation: String(recommendation),
    submission_id: String(submissionId),
  });
  return `${GAME_ORIGIN}?${params.toString()}`;
}
