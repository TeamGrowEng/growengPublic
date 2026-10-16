export type PublishedComment = { body: string; publishedAt: string };
export type TeacherComment = { childId: string; draft: string; revision: number; updatedAt: string | null; published: PublishedComment | null };
export type PassageDraft = { id: string; title: string; sentences: string[]; revision: number; updatedAt: string; status: 'draft' };
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export function commentBody(value: string, publish = false) {
  const body = value.trim();
  if (body.length > 500) throw new Error('코멘트는 500자 이내로 작성해 주세요.');
  if (publish && !body) throw new Error('학부모에게 보여 줄 코멘트를 입력해 주세요.');
  return body;
}
export function passageInput(title: string, text: string) {
  const name = title.trim(); const sentences = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!name || name.length > 80) throw new Error('지문 제목을 1~80자로 입력해 주세요.');
  if (!sentences.length || sentences.length > 15 || sentences.some(sentence => sentence.length > 200)) throw new Error('한 줄에 한 문장씩, 1~15문장을 입력해 주세요. 문장마다 최대 200자예요.');
  return { title: name, sentences };
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('저장된 내용의 형식을 확인하지 못했어요.'); return value as Record<string, unknown>; }
function date(value: unknown): string { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('저장 날짜를 확인하지 못했어요.'); return value; }
function revision(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('저장 버전을 확인하지 못했어요.'); return value; }
export function parsePublished(value: unknown): PublishedComment | null {
  if (value === null || value === undefined) return null;
  const row = object(value); if (typeof row.body !== 'string') throw new Error('코멘트를 읽지 못했어요.');
  return { body: commentBody(row.body, true), publishedAt: date(row.publishedAt) };
}
export function parseComment(value: unknown, childId: string): TeacherComment {
  const row = object(value); if (row.childId !== childId || typeof row.draft !== 'string') throw new Error('선택한 아이의 코멘트가 아니에요.');
  return { childId, draft: commentBody(row.draft), revision: revision(row.revision), updatedAt: row.updatedAt === null ? null : date(row.updatedAt), published: parsePublished(row.published) };
}
export function parsePassageDraft(value: unknown): PassageDraft {
  const row = object(value);
  if (typeof row.id !== 'string' || !uuid.test(row.id) || row.status !== 'draft' || typeof row.title !== 'string' || !Array.isArray(row.sentences) || row.sentences.some(line => typeof line !== 'string' || /[\r\n]/.test(line))) throw new Error('지문 초안을 읽지 못했어요.');
  return { id: row.id, ...passageInput(row.title, row.sentences.join('\n')), revision: revision(row.revision), updatedAt: date(row.updatedAt), status: 'draft' };
}
export function nextComment(previous: TeacherComment, draft: string, expectedRevision: number, action: 'save' | 'publish' | 'withdraw', now: string): TeacherComment {
  if (previous.revision !== expectedRevision) throw new Error('다른 화면에서 내용이 변경됐어요. 입력 내용을 복사한 뒤 다시 불러와 주세요.');
  const body = commentBody(draft, action === 'publish');
  return { ...previous, draft: body, revision: previous.revision + 1, updatedAt: now, published: action === 'publish' ? { body, publishedAt: now } : action === 'withdraw' ? null : previous.published };
}
