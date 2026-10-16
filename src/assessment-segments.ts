import type { AssessmentResult } from '../shared/assessment';
import type { AudioObservations } from '../shared/audio-observations';
export function assessmentSegments(result?: AssessmentResult | null, observation: AudioObservations | undefined = result?.observations) {
  const segments = (observation?.internalPauses ?? []).map((span, i) => ({ ...span, label: `쉼 후보 ${i + 1} · ${(span.startMs / 1000).toFixed(2)}~${(span.endMs / 1000).toFixed(2)}초` }));
  for (const sound of result?.evidence?.mappedSounds ?? []) sound.spans.forEach((span, index) => {
    if (span.offsetMs !== undefined && span.durationMs !== undefined && span.durationMs > 0) segments.push({ startMs: span.offsetMs, endMs: span.offsetMs + span.durationMs, label: `${sound.text} · /${sound.phonemes[index]}/ 구간` });
  });
  for (const target of result?.evidence?.stressTargets ?? []) if (target.span?.offsetMs !== undefined && target.span.durationMs !== undefined && target.span.durationMs > 0) segments.push({ startMs: target.span.offsetMs, endMs: target.span.offsetMs + target.span.durationMs, label: `목표 강세 음절 ${target.wordIndex + 1}번 단어·${target.syllableIndex + 1}번 음절 · 정오 판정 아님` });
  return segments;
}
