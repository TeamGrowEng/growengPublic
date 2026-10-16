import { useState } from 'react';
import type { ChildId, DemoActivity } from './state';
import { pauseAudio, type SessionRecord } from './recordings';
import SavedAudio from './SavedAudio';
import AssessmentComparison from './AssessmentComparison';
import PublishedComment from './PublishedComment';

const dateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export default function ParentView({ childId, name, activities, sessions, loading, loadError, onReload, onStudent, active, blocked }: {
  childId: ChildId; name: string; activities: DemoActivity[]; sessions: SessionRecord[]; loading: boolean; active: boolean; blocked: boolean;
  loadError: string; onReload: () => void; onStudent: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sessions.find(item => item.id === selectedId) ?? sessions[0];
  return <>
    <section className="welcome parent-welcome"><div><span className="greeting">{name}의 읽기 여정을 함께해요</span><h1>오늘의 작은 도전을<br />함께 발견해 주세요.</h1><p>학생 화면에서 남긴 두 목소리를 함께 들어 보세요.</p></div><div className="parent-illustration" aria-hidden="true"><span>♡</span><div className="mini-sprout">❀</div></div></section>
    <div className="parent-layout"><section className="activity-panel"><div className="panel-heading"><div><h2>최근 학습 활동</h2><p>{name}의 읽기 활동을 확인하세요.</p></div><span className="sample-tag">기기 저장 기록</span></div>
      {loading ? <p className="loading-recordings" role="status">저장된 목소리를 불러오고 있어요.</p> : null}
      {loadError ? <div className="load-error"><p role="alert">{loadError}</p><button className="secondary" onClick={onReload}>다시 불러오기</button></div> : null}
      {!loading && !loadError && sessions.length === 0 ? <div className="empty-state"><span className="empty-book" aria-hidden="true">▤</span><h3>첫 목소리를 기다리고 있어요.</h3><p>학생용 모드에서 처음 읽기와 따라 읽기를<br />저장하면 여기에 표시돼요.</p><button className="secondary" onClick={onStudent}>학생용 모드로 이동</button></div> : null}
      <ul className="recording-list">{sessions.map(session => <li key={session.id}><button className={selected?.id === session.id ? 'selected-session' : ''} aria-pressed={selected?.id === session.id} onClick={() => { pauseAudio(); setSelectedId(session.id); }}><span className="activity-icon" aria-hidden="true">♬</span><span className="session-summary"><strong>{session.material?.title ?? 'The little seed'} · 버전 {session.passageVersion}</strong><span>{session.sentence}</span><time dateTime={session.date}>{dateFormat.format(new Date(session.date))}</time></span><span className="activity-badge">실제 녹음</span></button></li>)}</ul>
      {activities.length ? <details className="legacy-activities"><summary>이전 화면 체험 기록 ({activities.length})</summary><ul>{activities.map(item => <li key={item.id}>The little seed · {dateFormat.format(new Date(item.date))} · 샘플 활동</li>)}</ul><p>이 기록에는 녹음이나 평가 결과가 없습니다.</p></details> : null}
      <div className="record-disclosure">성인 시연자의 녹음입니다. 이 기기에 보관해요. 온라인 평가는 제공하지 않아요. 장기 성장 분석은 아직 제공하지 않아요.</div>
    </section><aside className="parent-aside"><section className="comparison-panel"><span className="audio-symbol" aria-hidden="true">♬</span><h2>목소리로 느끼는 변화</h2>{selected ? <><p className="comparison-sentence">{selected.sentence}</p><p className="comparison-meta">같은 문장 · 같은 회차 · 지문 버전 {selected.passageVersion}</p><SavedAudio key={`${selected.id}-first`} take={selected.first} accountId={selected.accountId} label="처음 읽기" active={active} disabled={blocked} /><SavedAudio key={`${selected.id}-repeat`} take={selected.repeat} accountId={selected.accountId} label="따라 읽기" active={active} disabled={blocked} /><AssessmentComparison session={selected} /></> : <><p>처음 읽기와 따라 읽기를<br />나란히 들어 보세요.</p><div className="audio-placeholder"><span>처음 읽기</span><span>녹음 대기</span></div><div className="audio-placeholder"><span>따라 읽기</span><span>녹음 대기</span></div><p className="demo-note">저장한 회차를 선택하면 두 녹음을 들을 수 있어요.</p></>}</section><PublishedComment childId={childId} active={active} blocked={blocked} /><section className="parent-tip"><h2>오늘 건네면 좋은 한마디</h2><blockquote>“네 목소리로 끝까지 읽어 줘서<br />정말 즐거웠어!”</blockquote><p>결과보다 도전한 순간을 응원해 주세요.</p></section></aside></div>
  </>;
}
