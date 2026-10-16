// Synthetic assessment records exercise calculations only; never rendered as demo results.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLearning, summarizeClass } from '../src/learning-statistics.ts';
import type { SessionRecord } from '../src/recordings.ts';
import { passage, materialFromDraft } from '../shared/material.ts';
import type { Assessment } from '../shared/assessment.ts';
function assessment(score: number, sounds = [30, 70]): Assessment {
  return { result: { provider: 'azure', version: 'azure-rest-v1', locale: 'en-US', assessedAt: '2026-10-08T00:00:00Z', audioSha256: 'a'.repeat(64), confidence: .9, observations: { version: 'pcm-energy-v1', durationMs: 1000, stopReason: 'user_stop', rms: .1, peak: .3, clippedRatio: 0, speechStartMs: 100, speechEndMs: 900, internalPauses: [], pauseRatio: 0, status: 'usable', flags: [], method: 'energy-proxy-not-vad' }, scores: { accuracy: score, fluency: score, completeness: 100, pronunciation: score }, words: sounds.map(accuracy => ({ word: 'seed', accuracy, errorType: 'None', phonemes: [{ phoneme: 's', accuracy }] })) } };
}
function session(id: string, before?: Assessment, after?: Assessment): SessionRecord {
  return { id, childId: 'jiwoo', date: '2026-10-08T00:00:00Z', source: 'local-recording', passageId: passage.id, passageVersion: 1, sentenceIndex: 0, sentence: passage.sentences[0], first: { durationMs: 1000, assessment: before }, repeat: { durationMs: 1000, assessment: after }, evaluationStatus: 'evaluated' };
}
test('published reading snapshots count while mismatched versions are excluded', () => {
  const material = materialFromDraft({ id: '11111111-1111-4111-8111-111111111111', revision: 2, title: 'Seed', sentences: ['The seed grows.'] });
  const valid = { ...session('teacher', assessment(60), assessment(70)), material, passageId: material.id, passageVersion: 2, sentence: material.sentences[0] };
  const summary = summarizeLearning([valid, { ...valid, id: 'wrong-version', passageVersion: 1 }]);
  assert.equal(summary.saved, 1); assert.equal(summary.pairs, 1); assert.equal(summary.invalid, 1);
});
test('quality-unknown history, cut audio and mismatched stored hashes remain measured but are excluded from candidates', () => {
  const old = session('legacy', assessment(20), assessment(90)); delete old.first.assessment!.result.observations; delete old.repeat.assessment!.result.observations;
  const cut = session('cut', assessment(20), assessment(90)); cut.first.assessment!.result.observations!.status = 'review'; cut.first.assessment!.result.observations!.flags = ['possible_truncation'];
  const wrong = session('wrong-hash', assessment(20), assessment(90)); wrong.first.observation = { audioSha256: 'b'.repeat(64), features: assessment(20).result.observations! };
  const summary = summarizeLearning([old, cut, wrong]); assert.equal(summary.measured, 3); assert.equal(summary.pairs, 0); assert.equal(summary.sounds.length, 0); assert.equal(summary.firstMean, null);
});
test('different sentences and configurations get separate comparisons without a combined mean', () => {
  const rows = [0, 1].flatMap(sentenceIndex => Array.from({ length: 3 }, (_, index) => ({ ...session(`${sentenceIndex}:${index}`, assessment(sentenceIndex ? 90 : 40), assessment(sentenceIndex ? 95 : 60)), sentenceIndex, sentence: passage.sentences[sentenceIndex] })));
  const summary = summarizeLearning(rows); assert.equal(summary.pairs, 6); assert.equal(summary.firstMean, null); assert.equal(summary.comparisonGroups.length, 2); assert.deepEqual(summary.comparisonGroups.map(group => group.firstMean), [40, 90]);
  const updated = session('new-config', assessment(70), assessment(80)); updated.first.assessment!.result.assessmentConfigVersion = 'azure-en-US-prosody-v2'; updated.repeat.assessment!.result.assessmentConfigVersion = 'azure-en-US-prosody-v2';
  const mixed = summarizeLearning([...rows, updated]); assert.equal(mixed.comparisonGroups.length, 3); assert.equal(mixed.firstMean, null); assert.equal(mixed.sounds.length, 0);
});
test('unmeasured records are not zero scores; pair means require three matched sessions', () => {
  const records = [session('1', assessment(60), assessment(50)), session('2', assessment(60), assessment(50)), session('3')];
  const summary = summarizeLearning(records); assert.equal(summary.saved, 3); assert.equal(summary.pairs, 2); assert.equal(summary.firstMean, null); assert.equal(summary.unmeasured, 1);
  records.push(session('4', assessment(60), assessment(50)), session('5', assessment(99)));
  const enough = summarizeLearning(records); assert.equal(enough.firstMean, 60); assert.equal(enough.repeatMean, 50); assert.equal(enough.delta, -10); assert.equal(enough.partial, 1);
});
test('repeated phonemes count once per first-reading session, not repeated takes', () => {
  const records = [session('1', assessment(60), assessment(100, [100, 100]))];
  const one = summarizeLearning(records); assert.equal(one.sounds[0].sessions, 1); assert.equal(one.sounds[0].average, 50); assert.equal(one.sounds[0].practice, false);
  const three = summarizeLearning([...records, session('2', assessment(60)), session('3', assessment(60)), ...records]);
  assert.equal(three.saved, 3); assert.equal(three.sounds[0].sessions, 3); assert.equal(three.sounds[0].practice, true);
});
test('class denominator includes only children with enough exposure for that sound', () => {
  const child = (soundScore: number, count = 3) => summarizeLearning(Array.from({ length: count }, (_, i) => session(String(i), assessment(60, [soundScore]))));
  assert.deepEqual(summarizeClass([child(30), child(40), child(80, 2)]), []);
  const common = summarizeClass([child(30), child(40), child(80), child(50, 1), summarizeLearning([session('none')])]);
  assert.equal(common[0].eligible, 3); assert.equal(common[0].practice, 2); assert.equal(common[0].ratio, 2 / 3);
});
test('passage mismatches, malformed evaluations and inserted words are excluded', () => {
  const mismatch = { ...session('bad-version', assessment(100)), passageVersion: 2 };
  const invalid = session('bad-score', assessment(100)); invalid.first.assessment!.result.confidence = NaN;
  const insertion = session('inserted', assessment(60)); insertion.first.assessment!.result.words[0].errorType = 'Insertion';
  const result = summarizeLearning([mismatch, invalid, insertion]); assert.equal(result.saved, 2); assert.equal(result.invalid, 2); assert.equal(result.sounds[0].sessions, 1); assert.equal(result.pairs, 0);
  assert.deepEqual(summarizeLearning([session('b', assessment(60)), session('a', assessment(60))]), summarizeLearning([session('a', assessment(60)), session('b', assessment(60))]));
});
