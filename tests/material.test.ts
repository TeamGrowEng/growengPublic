import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materialFromDraft, materialForSession, parseMaterial, passage, referenceSentence } from '../shared/material.ts';
const draft = { id: '11111111-1111-4111-8111-111111111111', revision: 1, title: 'The little bird', sentences: ['The bird sings in the morning.'] };
test('published versions retain their own text after a draft changes', () => {
  const first = materialFromDraft(draft);
  draft.sentences[0] = 'The bird flies over the garden.'; draft.revision++;
  const second = materialFromDraft(draft);
  assert.equal(referenceSentence(0, first), 'The bird sings in the morning.');
  assert.equal(second.id, first.id); assert.equal(second.version, 2);
  const record = { passageId: first.id, passageVersion: 1, sentenceIndex: 0, sentence: first.sentences[0], material: first };
  assert.equal(materialForSession(record).version, 1);
  assert.throws(() => materialForSession({ ...record, material: second }));
  assert.throws(() => materialForSession({ ...record, material: undefined }));
});
test('legacy seed recordings remain readable; malformed published inputs are rejected', () => {
  assert.equal(materialForSession({ passageId: passage.id, passageVersion: 1, sentenceIndex: 0, sentence: passage.sentences[0] }), passage);
  const material = materialFromDraft(draft);
  for (const bad of [{ ...passage, sentences: ['Changed seed.'] }, { ...material, id: 'unregistered' }, { ...material, version: 0 }, { ...material, sentences: ['한국어'] }, { ...material, sentences: ['A'.repeat(201)] }, { ...material, sentences: [] }, { ...material, phonemeMappingReady: true }]) assert.throws(() => parseMaterial(bad));
  assert.throws(() => referenceSentence(1, material));
});
