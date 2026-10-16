import { useEffect, useRef, useState } from 'react';
import { passage, type Material } from '../shared/material';
import type { PassageDraft } from '../shared/editorial';
import { loadPassageDrafts, publishPassageDraft, savePassageDraft } from './editorial-store';
import useUnsavedWork from './useUnsavedWork';
export default function PassageDraftEditor({ blocked, onBusy, onPublished }: { blocked: boolean; onBusy: (value: boolean) => void; onPublished: (value: Material) => void }) {
  const [drafts, setDrafts] = useState<PassageDraft[]>([]); const [selected, setSelected] = useState<PassageDraft | null>(null);
  const [title, setTitle] = useState(''); const [text, setText] = useState(''); const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [reload, setReload] = useState(0);
  const id = useRef<string>(crypto.randomUUID()); const mounted = useRef(true); const pending = useRef(false);
  const dirty = title !== (selected?.title ?? '') || text !== (selected?.sentences.join('\n') ?? '');
  useUnsavedWork(dirty || saving);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onBusy(dirty || saving); return () => onBusy(false); }, [dirty, saving, onBusy]);
  useEffect(() => {
    let cancelled = false; setLoading(true); setLoaded(false); setError('');
    loadPassageDrafts().then(value => { if (!cancelled) { setDrafts(value); setLoaded(true); setSelected(null); setTitle(''); setText(''); id.current = crypto.randomUUID(); } }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : '지문을 불러오지 못했어요.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);
  function select(value: string) { const next = drafts.find(draft => draft.id === value) ?? null; setSelected(next); setTitle(next?.title ?? ''); setText(next?.sentences.join('\n') ?? ''); id.current = next?.id ?? crypto.randomUUID(); setError(''); setNotice(''); }
  async function save() {
    if (!loaded || blocked || pending.current) return; pending.current = true; setSaving(true); setError(''); setNotice('');
    try { const value = await savePassageDraft(id.current, title, text, selected?.revision ?? 0); if (mounted.current) { setSelected(value); setTitle(value.title); setText(value.sentences.join('\n')); setDrafts(previous => [value, ...previous.filter(draft => draft.id !== value.id)].slice(0, 50)); setNotice('지문 초안을 저장했어요. 읽기용으로 등록하면 학생 화면에서 사용할 수 있어요.'); } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '지문을 저장하지 못했어요.'); }
    finally { pending.current = false; if (mounted.current) setSaving(false); }
  }
  async function publish() {
    if (!selected || dirty || blocked || pending.current) return; pending.current = true; setSaving(true); setError(''); setNotice('');
    try { const value = await publishPassageDraft(selected); if (mounted.current) { onPublished(value); setNotice(`읽기용 버전 ${value.version}을 등록하고 선택했어요. 기존 녹음의 지문은 바뀌지 않아요.`); } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '읽기용 등록에 실패했어요.'); }
    finally { pending.current = false; if (mounted.current) setSaving(false); }
  }
  return <section className="passage-draft-editor"><div className="passage-editor-heading"><div><h2>다음 수업 지문 준비</h2><p>내 지문 초안을 저장하고 문장별로 다듬어요. 최근 수정한 50개를 표시해요.</p></div><span className="sample-tag">초안 보관</span></div>
    <div className="ready-passage"><strong>기본으로 제공하는 지문 · {passage.title}</strong><span>버전 {passage.version} · {passage.sentences.length}문장</span></div><p className="demo-note">영어 문장을 저장한 뒤 읽기용으로 등록해 주세요. 등록본은 버전별로 보관하며 음소·글자 교정은 아직 제공하지 않아요.</p>
    {loading ? <p role="status">지문 초안을 불러오고 있어요.</p> : <div className="passage-editor-form"><label>초안 선택<select disabled={!loaded || blocked || saving || dirty} value={selected?.id ?? ''} onChange={event => select(event.target.value)}><option value="">새 지문 초안</option>{drafts.map(draft => <option key={draft.id} value={draft.id}>{draft.title} · 초안 {draft.revision}</option>)}</select></label><label>지문 제목<input value={title} maxLength={80} disabled={!loaded || blocked || saving} onChange={event => { setTitle(event.target.value); setNotice(''); }} /></label><label>본문 · 한 줄에 한 문장<textarea value={text} rows={6} maxLength={3200} disabled={!loaded || blocked || saving} onChange={event => { setText(event.target.value); setNotice(''); }} placeholder={'The little bird is on the tree.\nThe bird sings in the morning.'} /></label><p className="demo-note">1~15문장 · 문장마다 최대 200자. 입력 중에는 저장하거나 변경을 되돌린 뒤 화면을 바꿔 주세요.</p><div className="editor-actions"><button className="primary" disabled={!loaded || blocked || saving || !dirty} onClick={() => void save()}>{saving ? '저장하고 있어요…' : '지문 초안 저장'}</button><button className="secondary" disabled={!selected || dirty || blocked || saving} onClick={() => void publish()}>읽기용으로 등록</button>{dirty ? <button className="text-button" disabled={blocked || saving} onClick={() => { setTitle(selected?.title ?? ''); setText(selected?.sentences.join('\n') ?? ''); setError(''); }}>변경 되돌리기</button> : null}<button className="text-button" disabled={blocked || saving || dirty} onClick={() => setReload(value => value + 1)}>초안 목록 다시 불러오기</button></div></div>}
    {notice ? <p className="editor-notice" role="status">{notice}</p> : null}{error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
