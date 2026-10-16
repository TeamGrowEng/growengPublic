import { children, type ChildId } from './state';
import { loadSessions, type SessionRecord } from './recordings';
export type TeacherRow = { childId: ChildId; sessions: SessionRecord[]; error: string };
export async function loadTeacherRecords(): Promise<TeacherRow[]> {
  const ids: readonly ChildId[] = children.map(child => child.id);
  const results = await Promise.allSettled(ids.map(id => loadSessions(id)));
  return results.map((result, index) => ({ childId: ids[index], error: result.status === 'rejected' ? result.reason instanceof Error ? result.reason.message : '기록을 불러오지 못했어요.' : '', sessions: result.status === 'fulfilled' ? result.value.map(session => ({ ...session, first: { ...session.first, blob: undefined }, repeat: { ...session.repeat, blob: undefined } })) : [] }));
}
