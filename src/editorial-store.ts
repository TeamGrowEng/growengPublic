import type { ChildId } from './state';
import { commentBody, nextComment, parseComment, parsePassageDraft, passageInput, type PassageDraft, type TeacherComment } from '../shared/editorial';
import { materialFromDraft, parseMaterial, passage, type Material } from '../shared/material';
export const emptyComment = (childId: ChildId): TeacherComment => ({ childId, draft: '', revision: 0, updatedAt: null, published: null });
async function database(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) throw new Error('이 브라우저는 수업 준비 저장을 지원하지 않아요. Chrome에서 다시 열어 주세요.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('groweng-teacher-work', 2); let blocked = false;
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('comments')) db.createObjectStore('comments', { keyPath: 'childId' }); if (!db.objectStoreNames.contains('passages')) db.createObjectStore('passages', { keyPath: 'id' }); if (!db.objectStoreNames.contains('published')) db.createObjectStore('published', { keyPath: ['id', 'version'] }); };
    request.onsuccess = () => { if (blocked) { request.result.close(); return; } request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(new Error('수업 준비 저장소를 열지 못했어요. 사이트 저장 설정을 확인해 주세요.'));
    request.onblocked = () => { blocked = true; reject(new Error('다른 GrowEng 탭을 닫은 뒤 다시 시도해 주세요.')); };
  });
}
async function read(store: string, key?: string): Promise<unknown> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const transaction = db.transaction(store, 'readonly'); const request = key ? transaction.objectStore(store).get(key) : transaction.objectStore(store).getAll(); transaction.oncomplete = () => resolve(request.result); transaction.onabort = () => reject(new Error('저장된 내용을 읽지 못했어요. 다시 불러와 주세요.')); }); }
  finally { db.close(); }
}
async function mutate<T>(store: string, key: string, update: (previous: unknown) => T): Promise<T> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite'); const request = transaction.objectStore(store).get(key); let result: T; let failure: unknown;
    request.onsuccess = () => { try { result = update(request.result); transaction.objectStore(store).put(result); } catch (error) { failure = error; transaction.abort(); } };
    transaction.oncomplete = () => resolve(result); transaction.onabort = () => reject(failure ?? new Error('저장하지 못했어요. 입력 내용은 남아 있으니 다시 저장해 주세요.'));
  }); } finally { db.close(); }
}
export async function loadComment(childId: ChildId): Promise<TeacherComment> {
  const value = await read('comments', childId); return value ? parseComment(value, childId) : emptyComment(childId);
}
export async function loadPublishedComment(childId: ChildId) {
  return (await loadComment(childId)).published;
}
export async function saveComment(childId: ChildId, draft: string, expectedRevision: number, action: 'save' | 'publish' | 'withdraw') {
  commentBody(draft, action === 'publish');
  return mutate('comments', childId, value => nextComment(value ? parseComment(value, childId) : emptyComment(childId), draft, expectedRevision, action, new Date().toISOString()));
}
export async function loadPassageDrafts(): Promise<PassageDraft[]> {
  return (await read('passages') as unknown[]).map(parsePassageDraft).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).slice(0, 50);
}
export async function savePassageDraft(id: string, title: string, text: string, expectedRevision: number): Promise<PassageDraft> {
  const input = passageInput(title, text);
  return mutate('passages', id, value => {
    const previous = value ? parsePassageDraft(value) : null;
    if ((previous?.revision ?? 0) !== expectedRevision) throw new Error('다른 화면에서 지문을 수정했어요. 입력 내용을 복사한 뒤 다시 불러와 주세요.');
    return parsePassageDraft({ id, ...input, revision: expectedRevision + 1, status: 'draft', updatedAt: new Date().toISOString() });
  });
}
export async function loadMaterials(_childId: ChildId): Promise<Material[]> {
  const materials = (await read('published') as unknown[]).map(parseMaterial).sort((a, b) => a.title.localeCompare(b.title) || b.version - a.version || a.id.localeCompare(b.id));
  return [passage, ...materials];
}
export async function publishPassageDraft(draft: PassageDraft): Promise<Material> {
  const material = materialFromDraft(draft);
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const transaction = db.transaction(['passages', 'published'], 'readwrite'); let failure: unknown;
    const request = transaction.objectStore('passages').get(draft.id);
    request.onsuccess = () => { try {
      const current = parsePassageDraft(request.result);
      if (current.revision !== draft.revision || JSON.stringify(materialFromDraft(current)) !== JSON.stringify(material)) throw new Error('저장한 초안이 변경됐어요. 최신 내용을 다시 불러와 주세요.');
      const published = transaction.objectStore('published').get([material.id, material.version]);
      published.onsuccess = () => { try { if (published.result) { if (JSON.stringify(parseMaterial(published.result)) !== JSON.stringify(material)) throw new Error('이미 등록한 지문 버전과 내용이 달라요.'); } else transaction.objectStore('published').add(material); } catch (error) { failure = error; transaction.abort(); } };
    } catch (error) { failure = error; transaction.abort(); } };
    transaction.oncomplete = () => resolve(material); transaction.onabort = () => reject(failure ?? new Error('읽기용 지문을 등록하지 못했어요. 다시 시도해 주세요.'));
  }); } finally { db.close(); }
}
