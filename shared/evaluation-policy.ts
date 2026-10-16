export type PronunciationPolicy = {
  phonemes: string[];
  mappings: { start: number; end: number; phonemeIndices: number[] }[];
  stressedSyllables: number[];
};
export type WordPolicy = PronunciationPolicy & { word: string; acceptedPronunciations?: PronunciationPolicy[] };
export type SentencePolicy = {
  version: 'sentence-policy-v1'; reference: string; lengthReviewed: boolean;
  allowedBreakAfterWordIndices: number[]; words: WordPolicy[];
  allowedIntonation?: ('rising' | 'falling' | 'level')[];
};
export type ReviewedPolicy = {
  id: string; revision: number; reviewedAt: string; reviewedBy: string;
  policy: SentencePolicy;
};
type Span = { offsetMs?: number; durationMs?: number };
export type EvaluationEvidence = {
  rubricVersion: 'evidence-v1'; audioSha256: string; policy: ReviewedPolicy | null;
  eligible: boolean; reasons: string[];
  pauses: { startMs: number; endMs: number; afterWordIndex: number | null; classification: 'allowed-boundary' | 'other-boundary' | 'unresolved' }[];
  mappedSounds: { wordIndex: number; start: number; end: number; text: string; phonemes: string[]; accuracies: (number | null)[]; spans: Span[]; pronunciationVariant?: number }[];
  stressTargets: { wordIndex: number; syllableIndex: number; span: Span | null; status: 'observed-not-judged' | 'unavailable'; pronunciationVariant?: number }[];
};
export const policyWords = (reference: string) => reference.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g) ?? [];
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('문항 검토 형식을 확인해 주세요.');
  return value as Record<string, unknown>;
};
const integer = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value < max;
function indices(value: unknown, max: number): number[] {
  if (!Array.isArray(value) || value.length > max || value.some(v => !integer(v, max)) || new Set(value).size !== value.length) throw new Error('문항의 위치 정보가 맞지 않아요.');
  return [...value].sort((a, b) => a - b);
}
export function parseSentencePolicy(value: unknown): SentencePolicy {
  const row = object(value);
  if (row.version !== 'sentence-policy-v1' || typeof row.reference !== 'string' || row.reference.length > 200 || !/^[\x20-\x7e]+$/.test(row.reference) || typeof row.lengthReviewed !== 'boolean') throw new Error('문항 내용과 길이 검토를 확인해 주세요.');
  const tokens = policyWords(row.reference);
  if (!tokens.length || !Array.isArray(row.words) || row.words.length !== tokens.length) throw new Error('문장과 단어 검토 목록이 다릅니다.');
  function pronunciation(value: unknown, token: string): PronunciationPolicy {
    const word = object(value);
    if (!Array.isArray(word.phonemes) || word.phonemes.length > 30 || word.phonemes.some(p => typeof p !== 'string' || !p.trim() || p.length > 20 || /[\s\u0000-\u001f]/u.test(p)) || !Array.isArray(word.mappings) || word.mappings.length > token.length) throw new Error('목표 소리와 철자 대응을 확인해 주세요.');
    let end = 0; const used = new Set<number>();
    const mappings = word.mappings.map(value => {
      const mapping = object(value);
      if (!integer(mapping.start, token.length) || !integer(mapping.end, token.length + 1) || mapping.start < end || mapping.end <= mapping.start) throw new Error('철자 구간이 겹치거나 범위를 벗어났어요.');
      end = mapping.end;
      const phonemeIndices = indices(mapping.phonemeIndices, word.phonemes instanceof Array ? word.phonemes.length : 0);
      if (!phonemeIndices.length || phonemeIndices.some(i => used.has(i))) throw new Error('같은 소리를 여러 철자 점수로 나눌 수 없어요.');
      phonemeIndices.forEach(i => used.add(i));
      return { start: mapping.start, end: mapping.end, phonemeIndices };
    });
    return { phonemes: [...word.phonemes] as string[], mappings, stressedSyllables: indices(word.stressedSyllables, 20) };
  }
  const words = row.words.map((value, index): WordPolicy => {
    const word = object(value); const token = tokens[index];
    if (word.word !== token) throw new Error('문장과 단어 검토 목록이 다릅니다.');
    const primary = pronunciation(word, token);
    if (word.acceptedPronunciations === undefined) return { word: token, ...primary };
    if (!Array.isArray(word.acceptedPronunciations) || word.acceptedPronunciations.length > 4) throw new Error('허용 발음은 단어당 추가 4개까지 등록해 주세요.');
    const acceptedPronunciations = word.acceptedPronunciations.map(value => pronunciation(value, token));
    const keys = [primary, ...acceptedPronunciations].map(value => JSON.stringify(value.phonemes));
    if (acceptedPronunciations.some(value => !value.phonemes.length) || new Set(keys).size !== keys.length) throw new Error('허용 발음의 음소열이 비어 있거나 중복됐어요.');
    return { word: token, ...primary, acceptedPronunciations };
  });
  const tones = row.allowedIntonation;
  if (tones !== undefined && (!Array.isArray(tones) || tones.length > 3 || tones.some(tone => !['rising', 'falling', 'level'].includes(String(tone))) || new Set(tones).size !== tones.length)) throw new Error('허용 억양을 확인해 주세요.');
  return { version: 'sentence-policy-v1', reference: row.reference, lengthReviewed: row.lengthReviewed, words, allowedBreakAfterWordIndices: indices(row.allowedBreakAfterWordIndices, Math.max(0, words.length - 1)), ...(tones === undefined ? {} : { allowedIntonation: [...tones] as SentencePolicy['allowedIntonation'] }) };
}
export function emptySentencePolicy(reference: string): SentencePolicy {
  return parseSentencePolicy({ version: 'sentence-policy-v1', reference, lengthReviewed: false, allowedBreakAfterWordIndices: [], words: policyWords(reference).map(word => ({ word, phonemes: [], mappings: [], stressedSyllables: [] })) });
}
export function parseReviewedPolicy(value: unknown): ReviewedPolicy {
  const row = object(value); const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  if (typeof row.id !== 'string' || !uuid.test(row.id) || !integer(row.revision, 2147483647) || row.revision < 1 || typeof row.reviewedBy !== 'string' || !uuid.test(row.reviewedBy) || typeof row.reviewedAt !== 'string' || !Number.isFinite(Date.parse(row.reviewedAt))) throw new Error('강사 검토 버전을 확인해 주세요.');
  return { id: row.id, revision: row.revision, reviewedAt: row.reviewedAt, reviewedBy: row.reviewedBy, policy: parseSentencePolicy(row.policy) };
}
export function parseEvaluationEvidence(value: unknown, hash: string, duration = 30000): EvaluationEvidence {
  const row = object(value);
  const bounded = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
  const span = (value: unknown): Span => {
    const item = object(value);
    if (item.offsetMs !== undefined && !bounded(item.offsetMs, duration) || item.durationMs !== undefined && !bounded(item.durationMs, duration) || Number(item.offsetMs ?? 0) + Number(item.durationMs ?? 0) > duration + 20) throw new Error('근거 구간이 녹음 범위를 벗어났어요.');
    return { ...(item.offsetMs === undefined ? {} : { offsetMs: item.offsetMs as number }), ...(item.durationMs === undefined ? {} : { durationMs: item.durationMs as number }) };
  };
  const array = (v: unknown, max: number): unknown[] => { if (!Array.isArray(v) || v.length > max) throw new Error('평가 근거 목록을 확인해 주세요.'); return v; };
  if (row.rubricVersion !== 'evidence-v1' || row.audioSha256 !== hash || typeof row.eligible !== 'boolean') throw new Error('평가 근거 버전과 음성이 다릅니다.');
  const policy = row.policy === null ? null : parseReviewedPolicy(row.policy);
  function variant(wordIndex: unknown, variantIndex: unknown) {
    if (!policy || !integer(wordIndex, policy.policy.words.length)) throw new Error('소리 근거의 단어가 맞지 않아요.');
    const word = policy.policy.words[wordIndex]; const alternatives = [word, ...word.acceptedPronunciations ?? []];
    const index = variantIndex === undefined ? 0 : variantIndex;
    if (!integer(index, alternatives.length)) throw new Error('허용 발음 검토본이 맞지 않아요.');
    return { word, pronunciation: alternatives[index], identity: variantIndex === undefined ? {} : { pronunciationVariant: index } };
  }
  const reasons = array(row.reasons, 150).map(v => { if (typeof v !== 'string' || v.length > 100) throw new Error('보류 사유 형식이 맞지 않아요.'); return v; });
  const pauses = array(row.pauses, 100).map(value => { const p = object(value); if (!bounded(p.startMs, duration) || !bounded(p.endMs, duration) || p.endMs <= p.startMs || p.afterWordIndex !== null && !integer(p.afterWordIndex, 100) || !['allowed-boundary', 'other-boundary', 'unresolved'].includes(String(p.classification))) throw new Error('쉼 근거 형식이 맞지 않아요.'); return { startMs: p.startMs, endMs: p.endMs, afterWordIndex: p.afterWordIndex as number | null, classification: p.classification as EvaluationEvidence['pauses'][number]['classification'] }; });
  const mappedSounds = array(row.mappedSounds, 300).map(value => {
    const p = object(value);
    if (!policy || !integer(p.wordIndex, policy.policy.words.length)) throw new Error('철자 근거의 단어가 맞지 않아요.');
    const { word, pronunciation, identity } = variant(p.wordIndex, p.pronunciationVariant);
    if (!integer(p.start, word.word.length) || !integer(p.end, word.word.length + 1) || p.end <= p.start || p.text !== word.word.slice(p.start, p.end)) throw new Error('철자 근거의 구간이 맞지 않아요.');
    const phonemes = array(p.phonemes, 30).map(v => { if (typeof v !== 'string' || v.length > 20) throw new Error('소리 근거가 맞지 않아요.'); return v; });
    const accuracies = array(p.accuracies, 30).map(v => { if (v !== null && !bounded(v, 100)) throw new Error('소리 관측값이 맞지 않아요.'); return v as number | null; });
    const spans = array(p.spans, 30).map(span);
    if (!phonemes.length || phonemes.length !== accuracies.length || spans.length !== phonemes.length) throw new Error('소리 관측 수가 다릅니다.');
    if (!pronunciation.mappings.some(mapping => mapping.start === p.start && mapping.end === p.end && JSON.stringify(mapping.phonemeIndices.map(i => pronunciation.phonemes[i])) === JSON.stringify(phonemes))) throw new Error('철자 근거와 허용 발음 검토본이 다릅니다.');
    return { wordIndex: p.wordIndex, ...identity, start: p.start, end: p.end, text: p.text as string, phonemes, accuracies, spans };
  });
  const stressTargets = array(row.stressTargets, 100).map(value => {
    const p = object(value); if (!policy || !integer(p.wordIndex, policy.policy.words.length) || !integer(p.syllableIndex, 20) || !['observed-not-judged', 'unavailable'].includes(String(p.status))) throw new Error('강세 관측 형식이 맞지 않아요.');
    const { pronunciation, identity } = variant(p.wordIndex, p.pronunciationVariant); const targetSpan = p.span === null ? null : span(p.span);
    if (!pronunciation.stressedSyllables.includes(p.syllableIndex) || (p.status === 'unavailable') !== (targetSpan === null) || targetSpan && (targetSpan.offsetMs === undefined || targetSpan.durationMs === undefined || targetSpan.durationMs <= 0)) throw new Error('강세 구간과 허용 발음 검토본이 다릅니다.');
    return { wordIndex: p.wordIndex, ...identity, syllableIndex: p.syllableIndex, span: targetSpan, status: p.status as EvaluationEvidence['stressTargets'][number]['status'] };
  });
  if (row.eligible && (!policy?.policy.lengthReviewed || reasons.length)) throw new Error('평가 근거의 보류 상태가 맞지 않아요.');
  return { rubricVersion: 'evidence-v1', audioSha256: hash, policy, eligible: row.eligible, reasons, pauses, mappedSounds, stressTargets };
}
