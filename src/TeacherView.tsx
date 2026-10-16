import { useEffect, useMemo, useState } from 'react';
import { children, type ChildId } from './state';
import { loadTeacherRecords, type TeacherRow } from './teacher-records';
import { summarizeClass, summarizeLearning, statisticsRules } from './learning-statistics';
import TeacherCommentEditor from './TeacherCommentEditor';
import PassageDraftEditor from './PassageDraftEditor';
import type { Material } from '../shared/material';

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '아직 없음';
const number = (value: number | null) => value === null ? '표본 부족' : value.toFixed(1);
export default function TeacherView({ material, onPublished, childId, blocked, onBusy, onSelect, onCompare, onRead }: { material: Material; onPublished: (value: Material) => void; childId: ChildId; blocked: boolean; onBusy: (value: boolean) => void; onSelect: (id: ChildId) => void; onCompare: (id: ChildId) => void; onRead: (id: ChildId) => void }) {
  const [commentBusy, setCommentBusy] = useState(false); const [passageBusy, setPassageBusy] = useState(false);
  const navigationBlocked = blocked || commentBusy || passageBusy;
  useEffect(() => { onBusy(commentBusy || passageBusy); return () => onBusy(false); }, [commentBusy, passageBusy, onBusy]);
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false; setLoading(true); setError(''); setRows([]);
    loadTeacherRecords().then(value => { if (!cancelled) setRows(value); }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : '반 현황을 불러오지 못했어요.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);
  const summaries = useMemo(() => rows.map(row => ({ ...row, summary: summarizeLearning(row.sessions.filter(session => session.passageId === material.id && session.passageVersion === material.version)) })), [rows, material.id, material.version]);
  const common = useMemo(() => summarizeClass(summaries.filter(row => !row.error).map(row => row.summary)).slice(0, 5), [summaries]);
  const selected = summaries.find(row => row.childId === childId) ?? summaries[0];
  const selectedName = children.find(child => child.id === selected?.childId)?.name;
  const total = summaries.filter(row => !row.error).reduce((sum, row) => sum + row.summary.saved, 0);
  const paired = summaries.filter(row => !row.error).reduce((sum, row) => sum + row.summary.measured, 0);
  return <div className="teacher-view">
    <section className="teacher-intro"><div><span className="greeting">새싹반 · 강사 수업 준비</span><h1>한 명의 목소리부터,<br />우리 반의 다음 연습까지.</h1><p>저장한 읽기 기록을 살피고, 다시 들어 볼 소리를 찾아요.</p></div><button className="secondary" disabled={loading || navigationBlocked} onClick={() => setReload(value => value + 1)}>기록 새로고침</button></section>
    <p className="teacher-scope">이 브라우저에 저장한 가상 아이 {children.length}명의 문장 회차를 집계해요. 과거 샘플 활동은 제외해요. 녹음 품질 확인이 필요한 회차는 비교에서 제외하며 평가 설정이 섞이면 평균과 소리 후보를 보류해요.</p>
    {loading ? <p role="status" className="loading-recordings">반의 읽기 기록을 불러오고 있어요.</p> : error ? <p className="inline-error" role="alert">{error}</p> : <>
      <p className="teacher-counts">{material.title} · 버전 {material.version}<br />조회한 아이 <strong>{rows.length}명</strong> · 저장 <strong>{total}회차</strong> · 두 녹음 평가 완료 <strong>{paired}회차</strong>{rows.some(row => row.error) ? <span> · 일부 아이 조회 실패, 해당 기록은 집계 제외</span> : null}</p>
      <div className="teacher-layout"><section className="teacher-roster"><h2>아이별 읽기 기록</h2>{rows.length ? <div className="teacher-table-scroll"><table><caption className="sr-only">담당 아이별 저장 및 평가 회차</caption><thead><tr><th scope="col">아이</th><th scope="col">저장</th><th scope="col">두 녹음 평가</th><th scope="col">일부 / 미평가</th><th scope="col">마지막 기록</th></tr></thead><tbody>{summaries.map(row => { const profile = children.find(child => child.id === row.childId)!; return <tr key={row.childId} className={row.childId === selected?.childId ? 'teacher-selected' : ''}><th scope="row"><button disabled={navigationBlocked} aria-pressed={row.childId === selected?.childId} onClick={() => onSelect(row.childId)}><span className={`avatar ${profile.color}`}>{profile.name[0]}</span>{profile.name}</button></th>{row.error ? <td colSpan={4} className="teacher-row-error">조회 실패 · 아이를 선택해 안내를 확인하세요.</td> : <><td>{row.summary.saved}회</td><td>{row.summary.measured}회</td><td>{row.summary.partial} / {row.summary.unmeasured}회</td><td>{formatDate(row.summary.lastDate)}</td></>}</tr>; })}</tbody></table></div> : <p className="teacher-empty">담당 가상 아이가 없어요. 반 배정과 계정 연결을 확인해 주세요.</p>}</section>
      <aside className="teacher-detail"><h2>{selectedName ? `${selectedName}의 다음 읽기` : '아이를 선택해 주세요'}</h2>{selected ? selected.error ? <p className="inline-error" role="alert">{selected.error}</p> : <>
        <p>저장 {selected.summary.saved}회차 · 같은 회차 비교 {selected.summary.pairs}쌍</p>
        <dl className="teacher-pair-summary"><div><dt>처음 읽기 평균</dt><dd>{number(selected.summary.firstMean)}</dd></div><div><dt>따라 읽기 평균</dt><dd>{number(selected.summary.repeatMean)}</dd></div><div><dt>평균 차이</dt><dd>{selected.summary.delta === null ? '표본 부족' : `${selected.summary.delta > 0 ? '+' : ''}${selected.summary.delta.toFixed(1)}`}</dd></div></dl>
        <p className="demo-note">두 녹음의 종합 발음이 모두 측정된 {statisticsRules.minimumSessions}회차부터 비교해요. 동일 회차의 차이이며 장기 성장 판단이 아니에요.</p>
        {selected.summary.comparisonGroups.length > 1 ? <p className="demo-note">문장 또는 평가 설정이 달라 전체 평균을 합치지 않습니다.</p> : null}{selected.summary.comparisonGroups.map(group => <div className="report-reading-group" key={group.key}><strong>{group.sentence}</strong><p>유효 비교 {group.pairs}쌍 · 처음 {number(group.firstMean)} · 따라 읽기 {number(group.repeatMean)} · 차이 {number(group.delta)}</p><small>{group.configuration}</small></div>)}
        <h3>다시 들어 볼 소리 후보</h3>{selected.summary.sounds.some(sound => sound.practice) ? <ul className="teacher-sound-list">{selected.summary.sounds.filter(sound => sound.practice).slice(0, 5).map(sound => <li key={sound.phoneme}><strong>/{sound.phoneme}/</strong><span>처음 읽기 {sound.sessions}회차 · 평균 {sound.average.toFixed(1)}</span></li>)}</ul> : <p className="teacher-empty">{selected.summary.sounds.some(sound => sound.sessions >= statisticsRules.minimumSessions) ? '충분히 측정된 소리에서 연습 후보가 없어요.' : '소리별 평가가 3회차 이상 쌓이면 후보를 보여 드려요.'}</p>}
        {selected.summary.invalid ? <p className="inline-error">형식이 맞지 않는 기록·평가 {selected.summary.invalid}건은 해당 통계에서 제외했어요.</p> : null}
        <div className="teacher-detail-actions"><button className="primary" disabled={navigationBlocked} onClick={() => onRead(selected.childId)}>이 아이 읽기 시작</button><button className="secondary" disabled={navigationBlocked || !selected.summary.saved} onClick={() => onCompare(selected.childId)}>두 녹음과 회차 보기</button></div>
        <TeacherCommentEditor key={selected.childId} childId={selected.childId} name={selectedName ?? ''} blocked={blocked || passageBusy} onBusy={setCommentBusy} />
      </> : null}</aside></div>
      <section className="teacher-common"><h2>우리 반이 함께 연습할 소리</h2><p>소리마다 충분히 측정된 아이만 분모에 포함해요. 처음 읽기만 집계합니다.</p>{common.length ? <ul className="teacher-common-list">{common.map(sound => <li key={sound.phoneme}><strong>/{sound.phoneme}/</strong><span>연습 후보 {sound.practice}명 / 유효한 아이 {sound.eligible}명</span></li>)}</ul> : <p className="teacher-empty">각 소리가 아이별 3회차, 3명 이상에게 측정되면 반 공통 후보를 표시해요.</p>}<p className="demo-note">평균 70점 미만을 참고 후보로 둡니다. 교육 진단 기준이나 글자별 교정을 뜻하지 않아요. 미평가·조회 실패는 0점으로 처리하지 않아요.</p></section>
      <p className="demo-note">온라인 평가·과제·리포트는 이 공개본에서 사용할 수 없어요.</p>
      <PassageDraftEditor blocked={blocked || commentBusy} onBusy={setPassageBusy} onPublished={onPublished} />
    </>}
  </div>;
}
