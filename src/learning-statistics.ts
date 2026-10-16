import type { SessionRecord } from './recordings.ts';
import { parseAssessment, comparisonEligible, sameAssessmentConfig, assessmentConfigurationKey, type AssessmentResult } from '../shared/assessment.ts';
import { materialForSession } from '../shared/material.ts';

export const statisticsRules = { minimumSessions: 3, minimumChildren: 3, weakThreshold: 70 } as const;
export type SoundSummary = { phoneme: string; sessions: number; average: number; practice: boolean };
export type LearningSummary = { saved: number; measured: number; partial: number; unmeasured: number; invalid: number; lastDate: string | null; pairs: number; firstMean: number | null; repeatMean: number | null; delta: number | null; sounds: SoundSummary[]; comparisonGroups: { key: string; sentence: string; configuration: string; pairs: number; firstMean: number | null; repeatMean: number | null; delta: number | null }[] };
function measured(value: unknown): AssessmentResult | null { try { return parseAssessment(value); } catch { return null; } }
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
export function summarizeLearning(records: readonly SessionRecord[]): LearningSummary {
  const result: LearningSummary = { saved: 0, measured: 0, partial: 0, unmeasured: 0, invalid: 0, lastDate: null, pairs: 0, firstMean: null, repeatMean: null, delta: null, sounds: [], comparisonGroups: [] };
  const seen = new Set<string>(); const groups = new Map<string, { sentence: string; configuration: string; values: { first: number; repeat: number }[] }>(); const phonemes = new Map<string, number[]>();
  const configurations = new Set(records.flatMap(record => [record.first.assessment?.result, record.repeat.assessment?.result].filter((v): v is AssessmentResult => !!v).map(assessmentConfigurationKey)));
  const compatibleCollection = configurations.size <= 1;
  for (const record of records) {
    if (seen.has(record.id)) continue; seen.add(record.id);
    try { materialForSession(record); } catch { result.invalid++; continue; }
    if (!['local-recording', 'cloud-recording'].includes(record.source) || !Number.isFinite(Date.parse(record.date))) { result.invalid++; continue; }
    result.saved++;
    if (!result.lastDate || Date.parse(record.date) > Date.parse(result.lastDate)) result.lastDate = record.date;
    const first = measured(record.first.assessment?.result); const repeat = measured(record.repeat.assessment?.result);
    if (record.first.assessment && !first || record.repeat.assessment && !repeat) result.invalid++;
    if (first && repeat) result.measured++; else if (first || repeat) result.partial++; else result.unmeasured++;
    if (first && repeat && comparisonEligible(first, record.first.observation) && comparisonEligible(repeat, record.repeat.observation) && sameAssessmentConfig(first, repeat) && first.scores.pronunciation !== null && repeat.scores.pronunciation !== null) {
      const configuration = assessmentConfigurationKey(first);
      const key = `${record.passageId}:${record.passageVersion}:${record.sentenceIndex}:${configuration}`;
      const group = groups.get(key) ?? { sentence: record.sentence, configuration, values: [] as { first: number; repeat: number }[] };
      group.values.push({ first: first.scores.pronunciation, repeat: repeat.scores.pronunciation }); groups.set(key, group);
    }
    if (!compatibleCollection || !first || !comparisonEligible(first, record.first.observation)) continue;
    const perSession = new Map<string, number[]>();
    for (const word of first.words) {
      // Inserted words are not part of the reference passage's sound exposures.
      if (word.errorType === 'Insertion') continue;
      for (const item of word.phonemes) {
        if (item.accuracy === null || !item.phoneme.trim()) continue;
        const values = perSession.get(item.phoneme) ?? []; values.push(item.accuracy); perSession.set(item.phoneme, values);
      }
    }
    for (const [phoneme, values] of perSession) { const observations = phonemes.get(phoneme) ?? []; observations.push(mean(values)); phonemes.set(phoneme, observations); }
  }
  result.comparisonGroups = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => {
    const firstMean = group.values.length >= statisticsRules.minimumSessions ? mean(group.values.map(pair => pair.first)) : null;
    const repeatMean = group.values.length >= statisticsRules.minimumSessions ? mean(group.values.map(pair => pair.repeat)) : null;
    return { key, sentence: group.sentence, configuration: group.configuration, pairs: group.values.length, firstMean, repeatMean, delta: firstMean !== null && repeatMean !== null ? repeatMean - firstMean : null };
  });
  result.pairs = result.comparisonGroups.reduce((sum, group) => sum + group.pairs, 0);
  if (result.comparisonGroups.length === 1) { const group = result.comparisonGroups[0]; result.firstMean = group.firstMean; result.repeatMean = group.repeatMean; result.delta = group.delta; }
  result.sounds = [...phonemes].map(([phoneme, values]) => ({ phoneme, sessions: values.length, average: mean(values), practice: values.length >= statisticsRules.minimumSessions && mean(values) < statisticsRules.weakThreshold })).sort((a, b) => a.average - b.average || (a.phoneme < b.phoneme ? -1 : a.phoneme > b.phoneme ? 1 : 0));
  return result;
}
export function summarizeClass(summaries: readonly LearningSummary[]) {
  const sounds = new Map<string, { eligible: number; practice: number }>();
  for (const summary of summaries) for (const sound of summary.sounds) {
    if (sound.sessions < statisticsRules.minimumSessions) continue;
    const count = sounds.get(sound.phoneme) ?? { eligible: 0, practice: 0 }; count.eligible++; if (sound.practice) count.practice++; sounds.set(sound.phoneme, count);
  }
  return [...sounds].filter(([, count]) => count.eligible >= statisticsRules.minimumChildren && count.practice > 0).map(([phoneme, count]) => ({ phoneme, ...count, ratio: count.practice / count.eligible })).sort((a, b) => b.ratio - a.ratio || (a.phoneme < b.phoneme ? -1 : a.phoneme > b.phoneme ? 1 : 0));
}
