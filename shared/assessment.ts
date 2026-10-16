import { parseAudioObservations, type AudioObservations, type StoredObservations } from './audio-observations.ts';
import { parseEvaluationEvidence, type EvaluationEvidence } from './evaluation-policy.ts';
export type Scores = { accuracy: number | null; fluency: number | null; completeness: number | null; pronunciation: number | null };
export type Timing = { offsetMs?: number; durationMs?: number };
export type PhonemeResult = Timing & { phoneme: string; accuracy: number | null; alternatives?: { phoneme: string; score: number | null }[] };
export type WordResult = Timing & { word: string; accuracy: number | null; errorType: string; phonemes: PhonemeResult[]; syllables?: (Timing & { syllable: string; accuracy: number | null })[]; breakEvidence?: { unexpected: number | null; missing: number | null }; monotone?: boolean };
export type AssessmentResult = {
  provider: 'azure'; version: 'azure-rest-v1'; locale: 'en-US'; assessedAt: string;
  audioSha256: string; confidence: number; scores: Scores; words: WordResult[];
  assessmentConfigVersion?: 'azure-en-US-prosody-v2'; prosody?: number | null;
  observations?: AudioObservations;
  evidence?: EvaluationEvidence;
};
export type Assessment = { result: AssessmentResult; receipt?: string };
export type EvaluationStatus = 'not-connected' | 'unmeasured' | 'partial' | 'evaluated';
export function score(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
function timing(row: Record<string, unknown>): Timing {
  const result: Timing = {};
  for (const key of ['offsetMs', 'durationMs'] as const) if (row[key] !== undefined) {
    const value = row[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 30000) throw new Error('평가 시간 정보가 맞지 않아요.');
    result[key] = value;
  }
  if (result.offsetMs !== undefined && result.durationMs !== undefined && result.offsetMs + result.durationMs > 30000) throw new Error('평가 시간 범위를 확인해 주세요.');
  return result;
}
export function parseAssessment(value: unknown): AssessmentResult {
  if (!value || typeof value !== 'object') throw new Error('평가 결과 형식을 확인하지 못했어요.');
  const row = value as Record<string, unknown>;
  if (row.provider !== 'azure' || row.version !== 'azure-rest-v1' || row.locale !== 'en-US' || typeof row.assessedAt !== 'string' || !Number.isFinite(Date.parse(row.assessedAt)) || typeof row.audioSha256 !== 'string' || !/^[a-f\d]{64}$/.test(row.audioSha256) || typeof row.confidence !== 'number' || !Number.isFinite(row.confidence) || row.confidence < .5 || row.confidence > 1 || !Array.isArray(row.words) || row.words.length > 100 || !row.scores || typeof row.scores !== 'object') throw new Error('유효한 평가 결과가 아니에요. 다시 읽고 시도해 주세요.');
  const scores = row.scores as Record<string, unknown>;
  const normalized: Scores = { accuracy: score(scores.accuracy), fluency: score(scores.fluency), completeness: score(scores.completeness), pronunciation: score(scores.pronunciation) };
  if (normalized.accuracy === null || normalized.pronunciation === null) throw new Error('평가 점수를 확인하지 못했어요.');
  const words = row.words.map((value: unknown): WordResult => {
    if (!value || typeof value !== 'object') throw new Error('단어 결과 형식이 맞지 않아요.');
    const word = value as Record<string, unknown>;
    if (typeof word.word !== 'string' || word.word.length > 100 || typeof word.errorType !== 'string' || word.errorType.length > 50 || !Array.isArray(word.phonemes) || word.phonemes.length > 100) throw new Error('단어 결과 형식이 맞지 않아요.');
    const extra: Pick<WordResult, 'syllables' | 'breakEvidence' | 'monotone'> = {};
    if (word.syllables !== undefined) {
      if (!Array.isArray(word.syllables) || word.syllables.length > 100) throw new Error('음절 정보가 맞지 않아요.');
      extra.syllables = word.syllables.map(v => { if (!v || typeof v !== 'object' || typeof v.syllable !== 'string' || v.syllable.length > 100) throw new Error('음절 정보가 맞지 않아요.'); return { syllable: v.syllable, accuracy: score(v.accuracy), ...timing(v) }; });
    }
    if (word.breakEvidence !== undefined) {
      const b = word.breakEvidence as Record<string, unknown>;
      if (!b || typeof b !== 'object' || [b.unexpected, b.missing].some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1))) throw new Error('쉼 근거 형식이 맞지 않아요.');
      extra.breakEvidence = { unexpected: b.unexpected as number | null, missing: b.missing as number | null };
    }
    if (word.monotone !== undefined) { if (typeof word.monotone !== 'boolean') throw new Error('억양 정보가 맞지 않아요.'); extra.monotone = word.monotone; }
    return { word: word.word, errorType: word.errorType, accuracy: score(word.accuracy), ...timing(word), ...extra, phonemes: word.phonemes.map((value: unknown) => {
      if (!value || typeof value !== 'object') throw new Error('소리 결과 형식이 맞지 않아요.');
      const item = value as Record<string, unknown>;
      if (typeof item.phoneme !== 'string' || item.phoneme.length > 100) throw new Error('소리 결과 형식이 맞지 않아요.');
      let alternatives: PhonemeResult['alternatives'];
      if (item.alternatives !== undefined) {
        if (!Array.isArray(item.alternatives) || item.alternatives.length > 10) throw new Error('음소 후보 형식이 맞지 않아요.');
        alternatives = item.alternatives.map(v => { if (!v || typeof v !== 'object' || typeof v.phoneme !== 'string' || v.phoneme.length > 100) throw new Error('음소 후보가 맞지 않아요.'); return { phoneme: v.phoneme, score: score(v.score) }; });
      }
      return { phoneme: item.phoneme, accuracy: score(item.accuracy), ...timing(item), ...(alternatives ? { alternatives } : {}) };
    }) };
  });
  if (row.assessmentConfigVersion !== undefined && row.assessmentConfigVersion !== 'azure-en-US-prosody-v2') throw new Error('평가 설정 버전을 확인해 주세요.');
  const observations = row.observations === undefined ? undefined : parseAudioObservations(row.observations);
  if (observations) for (const word of words) for (const item of [word, ...word.phonemes, ...(word.syllables ?? [])]) if (item.offsetMs !== undefined && item.offsetMs + (item.durationMs ?? 0) > observations.durationMs + 20) throw new Error('녹음 길이와 평가 시각이 다릅니다.');
  const evidence = row.evidence === undefined ? undefined : parseEvaluationEvidence(row.evidence, row.audioSha256, observations?.durationMs);
  return { provider: 'azure', version: 'azure-rest-v1', locale: 'en-US', assessedAt: row.assessedAt, audioSha256: row.audioSha256, confidence: row.confidence, scores: normalized, words, ...(row.assessmentConfigVersion ? { assessmentConfigVersion: row.assessmentConfigVersion } : {}), ...(row.prosody === undefined ? {} : { prosody: score(row.prosody) }), ...(observations ? { observations } : {}), ...(evidence ? { evidence } : {}) };
}
export function comparisonEligible(result: AssessmentResult, stored?: StoredObservations) {
  return !!(stored || result.observations) && (!stored || stored.audioSha256 === result.audioSha256 && stored.features.status === 'usable') && (!result.observations || result.observations.status === 'usable');
}
export function assessmentConfigurationKey(result: AssessmentResult) {
  const dimensions = [result.scores.accuracy, result.scores.fluency, result.scores.completeness, result.prosody].map(value => typeof value === 'number' ? '1' : '0').join('');
  return `${result.version}:${result.assessmentConfigVersion ?? 'legacy'}:${result.locale}:${dimensions}`;
}
export function sameAssessmentConfig(first: AssessmentResult, repeat: AssessmentResult) { return assessmentConfigurationKey(first) === assessmentConfigurationKey(repeat); }
export function evaluationStatus(first?: Assessment, repeat?: Assessment): EvaluationStatus {
  return first && repeat ? 'evaluated' : first || repeat ? 'partial' : 'unmeasured';
}
