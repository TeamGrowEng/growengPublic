import type { ChildId } from './state';
import type { Assessment, EvaluationStatus } from '../shared/assessment';
import { materialForSession, type Material } from '../shared/material';
export { passage } from '../shared/material';

export type Take = { blob: Blob; durationMs: number; stopReason?: import('../shared/audio-observations').StopReason; observation?: import('../shared/audio-observations').StoredObservations; assessment?: Assessment };
export type ReadingSession = {
  id: string; childId: ChildId; date: string; source: 'local-recording' | 'cloud-recording'; accountId?: string;
  passageId: string; passageVersion: number; sentenceIndex: number; sentence: string;
  material?: Material;
  first: Take; repeat: Take; evaluationStatus: EvaluationStatus;
};
export type StoredTake = Omit<Take, 'blob'> & { blob?: Blob; storagePath?: string };
export type SessionRecord = Omit<ReadingSession, 'first' | 'repeat'> & { first: StoredTake; repeat: StoredTake };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('이 브라우저는 녹음 저장을 지원하지 않아요. Chrome에서 다시 열어 주세요.')); return; }
    const request = indexedDB.open('groweng-recordings', 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('sessions', { keyPath: 'id' });
      store.createIndex('childId', 'childId');
    };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(new Error('기기 저장소를 열지 못했어요. 브라우저의 사이트 저장 설정을 확인해 주세요.'));
    request.onblocked = () => { blocked = true; reject(new Error('다른 GrowEng 탭을 닫은 뒤 다시 시도해 주세요.')); };
  });
}

async function saveLocalSession(session: ReadingSession): Promise<void> {
  if (!session.first.blob.size || !session.repeat.blob.size) throw new Error('두 녹음이 모두 있어야 저장할 수 있어요.');
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('sessions', 'readwrite');
      transaction.objectStore('sessions').put(session);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error('녹음을 저장하지 못했어요. 저장 공간을 확인하고 다시 저장해 주세요.'));
      transaction.onerror = () => reject(new Error('녹음을 저장하지 못했어요. 두 녹음은 화면에 남아 있으니 다시 저장해 주세요.'));
    });
  } finally { database.close(); }
}

export async function loadLocalSessions(childId: ChildId): Promise<ReadingSession[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('sessions', 'readonly');
      const request = transaction.objectStore('sessions').index('childId').getAll(childId);
      transaction.oncomplete = () => resolve((request.result as ReadingSession[]).sort((a, b) => b.date.localeCompare(a.date)));
      transaction.onabort = () => reject(new Error('저장된 녹음을 불러오지 못했어요. 다시 불러오기를 눌러 주세요.'));
      transaction.onerror = () => reject(new Error('저장된 녹음을 불러오지 못했어요. 다시 불러오기를 눌러 주세요.'));
    });
  } finally { database.close(); }
}

export async function saveSession(session: ReadingSession): Promise<ReadingSession> {
  materialForSession(session);
  await saveLocalSession(session);
  return session;
}
export async function loadSessions(childId: ChildId): Promise<SessionRecord[]> {
  return loadLocalSessions(childId);
}
export async function loadTake(take: StoredTake, _accountId?: string): Promise<Blob> {
  if (take.blob) return take.blob;
  throw new Error('이 기기에 저장한 녹음만 재생할 수 있어요.');
}

export function pauseAudio() {
  document.querySelectorAll('audio').forEach(audio => audio.pause());
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
