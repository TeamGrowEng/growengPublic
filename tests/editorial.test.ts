import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextComment, parseComment, parsePassageDraft, passageInput, commentBody } from '../shared/editorial.ts';
const empty = { childId: 'jiwoo', draft: '', revision: 0, updatedAt: null, published: null };
const time = '2026-10-08T00:00:00Z';
test('draft edits do not change the published copy; withdrawal preserves private text', () => {
  const saved = nextComment(empty, '처음 도전', 0, 'save', time); assert.equal(saved.published, null);
  const published = nextComment(saved, '처음 도전', 1, 'publish', time); assert.equal(published.published?.body, '처음 도전');
  const edited = nextComment(published, '다음 연습 준비', 2, 'save', time); assert.equal(edited.published?.body, '처음 도전'); assert.equal(edited.draft, '다음 연습 준비');
  const withdrawn = nextComment(edited, edited.draft, 3, 'withdraw', time); assert.equal(withdrawn.published, null); assert.equal(withdrawn.draft, '다음 연습 준비'); assert.equal(withdrawn.revision, 4);
});
test('stale revisions fail before replacing a comment, and empty text cannot be published', () => {
  const saved = nextComment(empty, 'saved', 0, 'save', time);
  assert.throws(() => nextComment(saved, 'stale', 0, 'publish', time), /다른 화면/);
  assert.equal(saved.draft, 'saved'); assert.equal(saved.published, null);
  assert.throws(() => nextComment(empty, '  ', 0, 'publish', time));
  assert.throws(() => commentBody('가'.repeat(501))); assert.equal(commentBody('  a  '), 'a');
});
test('passage inputs preserve sentence boundaries and enforce size limits', () => {
  assert.deepEqual(passageInput('  New lesson ', ' First sentence.\r\n\r\nSecond sentence. '), { title: 'New lesson', sentences: ['First sentence.', 'Second sentence.'] });
  for (const [title, text] of [['', 'a'], ['a', ' '], ['a', 'a'.repeat(201)], ['a', Array(16).fill('a').join('\n')]]) assert.throws(() => passageInput(title, text));
});
test('stored editorial data cannot silently change child, status or revision', () => {
  assert.throws(() => parseComment(empty, 'minjun'));
  assert.throws(() => parseComment({ ...empty, revision: -1 }, 'jiwoo'));
  const draft = { id: '00000000-0000-4000-8000-000000000001', title: 'Title', sentences: ['One sentence.'], status: 'draft', revision: 1, updatedAt: time };
  assert.equal(parsePassageDraft(draft).status, 'draft');
  assert.throws(() => parsePassageDraft({ ...draft, status: 'ready' }));
  assert.throws(() => parsePassageDraft({ ...draft, sentences: ['Two\nlines'] }));
  assert.throws(() => parseComment({ ...empty, published: { body: '', publishedAt: time } }, 'jiwoo'));
});
