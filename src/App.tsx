import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { children, readState, saveState, type DemoState, type Mode } from './state';
import StudentView from './StudentView';
import ParentView from './ParentView';
import { loadSessions, pauseAudio, type ReadingSession, type SessionRecord } from './recordings';
import { storageLabel } from './storage-config';
import MaterialPicker from './MaterialPicker';
import { passage, type Material } from '../shared/material';
const TeacherView = lazy(() => import('./TeacherView'));

export default function App() {
  const [material, setMaterial] = useState<Material>(passage); const [materialRevision, setMaterialRevision] = useState(0);
  const [state, setState] = useState(readState);
  const [storageError, setStorageError] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [teacherBusy, setTeacherBusy] = useState(false);
  const loadGeneration = useRef(0);
  const busy = mediaBusy || teacherBusy;
  const [recordings, setRecordings] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const child = children.find(item => item.id === state.childId)!;
  useEffect(() => {
    let cancelled = false;
    const generation = ++loadGeneration.current;
    setLoading(true); setLoadError('');
    loadSessions(state.childId).then(items => { if (!cancelled && generation === loadGeneration.current) setRecordings(items); })
      .catch(error => { if (!cancelled && generation === loadGeneration.current) setLoadError(error instanceof Error ? error.message : '녹음을 불러오지 못했어요.'); })
      .finally(() => { if (!cancelled && generation === loadGeneration.current) setLoading(false); });
    return () => { cancelled = true; };
  }, [state.childId, reload]);
  function update(next: DemoState) {
    setState(next);
    setStorageError(!saveState(next));
  }
  function changeMode(mode: Mode) { if (busy) return; pauseAudio(); update({ ...state, mode }); }
  function chooseChild(id: DemoState['childId'], mode: Mode = state.mode) { if (busy) return; pauseAudio(); update({ ...state, childId: id, mode }); }
  function onSaved(session: ReadingSession) {
    setRecordings(items => [session, ...items.filter(item => item.id !== session.id)]);
  }
  return <div className={`app ${state.mode}`}>
    <a className="skip-link" href="#main">본문으로 이동</a>
    <header className="mode-header">
      <button className={`mode-button student-button ${state.mode === 'student' ? 'selected' : ''}`} disabled={busy} aria-pressed={state.mode === 'student'} onClick={() => changeMode('student')}>
        <span aria-hidden="true">✦</span> 학생용 모드 <span className="mode-check" aria-hidden="true">{state.mode === 'student' ? '✓' : ''}</span>
      </button>
      <a className="brand" href="#main" aria-label="GrowEng 본문"><img src="/sprout.svg" alt="" />Grow<span>Eng</span></a>
      <button className={`mode-button parent-button ${state.mode === 'parent' ? 'selected' : ''}`} disabled={busy} aria-pressed={state.mode === 'parent'} onClick={() => changeMode('parent')}>
        <span aria-hidden="true">♡</span> 학부모용 모드 <span className="mode-check" aria-hidden="true">{state.mode === 'parent' ? '✓' : ''}</span>
      </button>
    </header>
    <div className="workspace-bar">
      <span className="academy"><span className="academy-dot" />그로우 영어학원 <span className="class-name">새싹반</span></span>
      <button className={`teacher-mode-button ${state.mode === 'teacher' ? 'selected' : ''}`} disabled={busy} aria-pressed={state.mode === 'teacher'} onClick={() => changeMode('teacher')}>강사용 모드</button>
      <label className="profile-picker"><span className={`avatar ${child.color}`}>{child.name[0]}</span><select disabled={busy} aria-label="아이 선택" value={state.childId} onChange={event => chooseChild(event.target.value as DemoState['childId'])}>{children.map(item => <option key={item.id} value={item.id}>{item.name} · 데모 프로필</option>)}</select></label>
    </div>
    <MaterialPicker key={`${state.childId}-local-${materialRevision}`} childId={state.childId} material={material} disabled={busy} onChange={value => { if (!busy) { pauseAudio(); setMaterial(value); } }} />
    {storageError ? <p className="storage-error" role="alert">기기에 기록을 저장하지 못했어요. 현재 화면에서는 사용할 수 있지만, 새로고침하면 사라질 수 있어요.</p> : null}
    {busy ? <p className="media-notice" role="status">{teacherBusy ? '수업 준비 내용을 저장하거나 변경을 되돌리면 모드와 아이를 바꿀 수 있어요.' : '녹음·평가를 끝내고 목소리를 저장하면 모드와 아이·지문을 바꿀 수 있어요. 저장하지 않으려면 처음부터 다시 녹음하기로 비워 주세요.'}</p> : null}
    <main id="main" tabIndex={-1}>
      {state.mode === 'teacher' ? <Suspense fallback={<p role="status">강사 화면을 준비하고 있어요.</p>}><TeacherView key="local" material={material} onPublished={value => { setMaterial(value); setMaterialRevision(count => count + 1); }} childId={state.childId} blocked={mediaBusy} onBusy={setTeacherBusy} onSelect={id => chooseChild(id)} onCompare={id => chooseChild(id, 'parent')} onRead={id => chooseChild(id, 'student')} /></Suspense> : null}
      <div hidden={state.mode !== 'student'}><StudentView key={`${state.childId}-local-${material.id}-${material.version}`} material={material} childId={state.childId} name={child.name} active={state.mode === 'student'} externalBusy={false} onBusy={setMediaBusy} onSaved={onSaved} onParent={() => changeMode('parent')} /></div>
      <div hidden={state.mode !== 'parent'}><ParentView key={`${state.childId}-local`} active={state.mode === 'parent'} blocked={false} childId={state.childId} name={child.name} activities={state.activities.filter(item => item.childId === state.childId)} sessions={recordings.filter(item => item.childId === state.childId)} loading={loading} loadError={loadError} onReload={() => setReload(value => value + 1)} onStudent={() => changeMode('student')} /></div>
    </main>
    <footer><span>작은 소리가, 큰 자신감으로.</span><span className="demo-label">데모 · 가상 프로필 · 녹음 저장: {storageLabel}</span></footer>
  </div>;
}
