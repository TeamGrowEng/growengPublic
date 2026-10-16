export const passage = {
  id: 'little-seed', version: 1, title: 'The little seed',
  sentences: ['The little seed is in the garden.', 'The sun is warm and bright.', 'The seed grows into a little tree.'],
  source: 'seed', phonemeMappingReady: false,
} as const;
export type Material = { id: string; version: number; title: string; sentences: readonly string[]; source: 'seed' | 'teacher'; phonemeMappingReady: false };
const customId = /^teacher-[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export function parseMaterial(value: unknown): Material {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('읽기 지문을 확인하지 못했어요.');
  const row = value as Record<string, unknown>;
  if (row.id === passage.id) {
    if (row.version !== 1 || row.title !== passage.title || JSON.stringify(row.sentences) !== JSON.stringify(passage.sentences) || row.source !== 'seed' || row.phonemeMappingReady !== false) throw new Error('기본 지문 내용이 일치하지 않아요.');
    return passage;
  }
  if (typeof row.id !== 'string' || !customId.test(row.id) || typeof row.version !== 'number' || !Number.isSafeInteger(row.version) || row.version < 1 || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 80 || row.source !== 'teacher' || row.phonemeMappingReady !== false || !Array.isArray(row.sentences) || row.sentences.length < 1 || row.sentences.length > 15 || row.sentences.some(line => typeof line !== 'string' || !/[a-z]/i.test(line) || line !== line.trim() || line.length > 200 || !/^[\x20-\x7e]+$/.test(line))) throw new Error('읽기용 지문은 한 줄에 한 영어 문장씩, 문장마다 200자 이내로 준비해 주세요. 음소·글자 대응은 아직 미준비 상태예요.');
  return { id: row.id, version: row.version, title: row.title, sentences: [...row.sentences] as string[], source: 'teacher', phonemeMappingReady: false };
}
export function materialFromDraft(draft: { id: string; revision: number; title: string; sentences: string[] }): Material {
  return parseMaterial({ id: `teacher-${draft.id}`, version: draft.revision, title: draft.title, sentences: draft.sentences, source: 'teacher', phonemeMappingReady: false });
}
export function referenceSentence(index: unknown, material: Material = passage): string {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= material.sentences.length) throw new Error('지원하는 문장을 선택해 주세요.');
  return material.sentences[index];
}
export function materialForSession(record: { passageId: string; passageVersion: number; sentenceIndex: number; sentence: string; material?: unknown }): Material {
  const material = record.material ? parseMaterial(record.material) : passage;
  if (record.passageId !== material.id || record.passageVersion !== material.version || referenceSentence(record.sentenceIndex, material) !== record.sentence) throw new Error('녹음 회차와 지문 버전이 일치하지 않아요.');
  return material;
}
