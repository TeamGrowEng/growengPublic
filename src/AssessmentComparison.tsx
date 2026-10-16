import type { SessionRecord } from './recordings';
import { comparisonEligible, sameAssessmentConfig, type Scores } from '../shared/assessment';
import ObservationDetails from './ObservationDetails';
const metrics: { key: keyof Scores; label: string }[] = [
  { key: 'accuracy', label: '발음 정확도' }, { key: 'fluency', label: '유창성' },
  { key: 'completeness', label: '문장 완성도' }, { key: 'pronunciation', label: '종합 발음' },
];
const display = (value: number | null | undefined) => value === null || value === undefined ? '미측정' : value.toFixed(1);
export default function AssessmentComparison({ session }: { session: SessionRecord }) {
  const first = session.first.assessment?.result; const repeat = session.repeat.assessment?.result;
  const comparable = !!first && !!repeat && comparisonEligible(first, session.first.observation) && comparisonEligible(repeat, session.repeat.observation) && sameAssessmentConfig(first, repeat);
  if (!first && !repeat) return <div><p className="demo-note">이 회차는 발음 평가를 측정하지 않았어요. 두 목소리를 직접 들어 보세요.</p>{(['first', 'repeat'] as const).map(kind => session[kind].observation ? <div key={kind}><strong>{kind === 'first' ? '처음 읽기' : '따라 읽기'}</strong><ObservationDetails stored={session[kind].observation} /></div> : null)}</div>;
  return <div className="assessment-comparison"><h3>같은 문장의 발음 측정</h3><p>{first && repeat ? '두 녹음을 Azure로 각각 평가했어요.' : '한 녹음만 평가했어요. 측정하지 않은 값은 비교하지 않아요.'}</p>
    {first && repeat && !comparable ? <p className="demo-note">녹음 품질 또는 평가 설정이 달라 차이를 계산하지 않았어요. 아래 점수는 Azure 원본 측정값입니다.</p> : null}
    <div className="score-table-wrap"><table><caption className="sr-only">Azure 발음 평가 결과, 100점 척도</caption><thead><tr><th scope="col">항목</th><th scope="col">처음</th><th scope="col">따라 읽기</th><th scope="col">차이</th></tr></thead><tbody>{metrics.map(({ key, label }) => {
      const before = first?.scores[key]; const after = repeat?.scores[key];
      const delta = comparable && typeof before === 'number' && typeof after === 'number' ? after - before : null;
      return <tr key={key}><th scope="row">{label}</th><td>{display(before)}</td><td>{display(after)}</td><td>{delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}</td></tr>;
    })}</tbody></table></div>
    <details><summary>평가 출처와 다시 읽을 단어</summary>{([['처음 읽기', first, session.first.observation], ['따라 읽기', repeat, session.repeat.observation]] as const).map(([label, result, stored]) => <div key={label}><strong>{label}</strong>{result ? <><p>Azure · 영어(미국) · 평가 버전 {result.assessmentConfigVersion ?? result.version}<br />{new Date(result.assessedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p><p>{comparisonEligible(result, stored) ? result.words.filter(word => word.errorType === 'Omission' || word.errorType === 'Mispronunciation' || word.accuracy !== null && word.accuracy < 70).map(word => word.word).join(', ') || '다시 읽을 단어 후보 없음' : '녹음 상태 확인 전에는 단어 교정을 제안하지 않아요.'}</p><ObservationDetails result={result} stored={stored} /></> : <p>미측정</p>}</div>)}</details>
    <p className="demo-note">100점 척도의 서비스 측정값입니다. 같은 회차의 차이는 장기 성장이나 학습 효과를 뜻하지 않아요. 단어 후보는 참고용이며 글자별 소리 교정은 아직 제공하지 않아요.</p>
  </div>;
}
