import { useEffect, useRef, useState } from 'react';
import type { ChildId } from './state';
import { emptyComment, loadComment, saveComment } from './editorial-store';
import useUnsavedWork from './useUnsavedWork';
export default function TeacherCommentEditor({ childId, name, blocked, onBusy }: { childId: ChildId; name: string; blocked: boolean; onBusy: (value: boolean) => void }) {
  const [record, setRecord] = useState(() => emptyComment(childId)); const [text, setText] = useState('');
  const [loading, setLoading] = useState(true); const [loaded, setLoaded] = useState(false); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [reload, setReload] = useState(0);
  const mounted = useRef(true); const pending = useRef(false); const dirty = text !== record.draft;
  useUnsavedWork(dirty || saving);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onBusy(saving || dirty); return () => onBusy(false); }, [saving, dirty, onBusy]);
  useEffect(() => {
    let cancelled = false; setLoading(true); setLoaded(false); setError(''); setNotice('');
    loadComment(childId).then(value => { if (!cancelled) { setRecord(value); setText(value.draft); setLoaded(true); } }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : '코멘트를 불러오지 못했어요.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [childId, reload]);
  async function save(action: 'save' | 'publish' | 'withdraw') {
    if (!loaded || pending.current || blocked) return; pending.current = true; setSaving(true); setError(''); setNotice('');
    try { const value = await saveComment(childId, text, record.revision, action); if (mounted.current) { setRecord(value); setText(value.draft); setNotice(action === 'publish' ? '학부모 화면에 표시했어요.' : action === 'withdraw' ? '학부모 표시를 거뒀어요. 강사 초안은 보관해요.' : '강사 초안을 저장했어요.'); } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '코멘트를 저장하지 못했어요.'); }
    finally { pending.current = false; if (mounted.current) setSaving(false); }
  }
  return <section className="teacher-comment-editor"><h3>{name}에게 남길 코멘트</h3><p className="demo-note">초안은 강사만 확인해요. 학부모에게 보이려면 표시 버튼을 눌러 주세요.</p>
    {loading ? <p role="status">코멘트를 불러오고 있어요.</p> : <><label htmlFor="teacher-comment">수업에서 발견한 작은 도전</label><textarea id="teacher-comment" maxLength={500} rows={4} value={text} disabled={!loaded || blocked || saving} onChange={event => { setText(event.target.value); setNotice(''); }} placeholder="직접 들은 읽기 모습과 다음 연습을 남겨 주세요." /><p className="editor-character-count">{text.length} / 500자{dirty ? ' · 저장하지 않은 변경' : ''}</p>
    <div className="editor-actions"><button className="secondary" disabled={!loaded || blocked || saving || !dirty} onClick={() => void save('save')}>초안 저장</button><button className="primary" disabled={!loaded || blocked || saving || !text.trim()} onClick={() => void save('publish')}>학부모 화면에 표시</button>{record.published ? <button className="text-button" disabled={blocked || saving} onClick={() => void save('withdraw')}>학부모 표시 거두기</button> : null}{dirty ? <button className="text-button" disabled={blocked || saving} onClick={() => { setText(record.draft); setError(''); }}>변경 되돌리기</button> : null}</div>
    {record.published ? <div className="published-preview"><strong>현재 학부모에게 보이는 내용</strong><p>{record.published.body}</p></div> : <p className="demo-note">학부모에게 표시한 코멘트가 없어요.</p>}
    <button className="text-button" disabled={blocked || saving || dirty} onClick={() => setReload(value => value + 1)}>코멘트 다시 불러오기</button></>}
    {dirty || saving ? <p className="demo-note">저장하거나 변경을 되돌린 뒤 아이·모드를 바꿀 수 있어요.</p> : null}{notice ? <p className="editor-notice" role="status">{notice}</p> : null}{error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
