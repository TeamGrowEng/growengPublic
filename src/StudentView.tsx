import { useState } from 'react';
import ReadingExercise from './ReadingExercise';
import { type ReadingSession } from './recordings';
import type { Material } from '../shared/material';
import type { ChildId } from './state';

export default function StudentView({ material: passage, name, childId, active, externalBusy, onBusy, onSaved, onParent }: { material: Material; name: string; childId: ChildId; active: boolean; externalBusy: boolean; onBusy: (busy: boolean) => void; onSaved: (session: ReadingSession) => void; onParent: () => void }) {
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  function advance() {
    if (step < passage.sentences.length - 1) setStep(step + 1);
    else setFinished(true);
  }
  return <>
    <section className="welcome"><div><span className="greeting">{name}, 오늘도 반가워!</span><h1>우리, 영어 한 그루<br />키워 볼까?</h1><p>천천히 읽어도 괜찮아. 너의 목소리로 시작해 봐.</p></div><div className="welcome-stamp" aria-hidden="true">작은 씨앗의<br />큰 모험<span>✦</span></div></section>
    <div className="student-layout">
      <section className="reading-card" aria-labelledby="reading-title">
        <div className="reading-top"><span className="book-label">오늘의 이야기</span><span className="sample-tag">{passage.source === 'seed' ? '샘플 지문' : '선생님이 준비한 지문'}</span></div>
        <div className="story-scene" aria-hidden="true"><div className="sun" /><div className="cloud cloud-one" /><div className="cloud cloud-two" /><div className="hill hill-back" /><div className="hill hill-front" /><div className="plant"><span className="leaf leaf-left" /><span className="leaf leaf-right" /><span className="stem" /></div><div className="ground-dot dot-one" /><div className="ground-dot dot-two" /><span className="scene-spark">✧</span></div>
        <div className="story-content"><h2 id="reading-title">{passage.title}</h2><p className="story-subtitle">한 문장씩 함께 읽는 이야기</p>
          {finished ? <div className="completion" role="status"><span className="completion-icon" aria-hidden="true">✓</span><h3>이야기를 끝까지 읽었어!</h3><p>읽은 목소리를 저장했어. 학부모 화면에서도 들을 수 있어.</p><button className="primary" disabled={externalBusy} onClick={onParent}>학부모 화면에서 확인하기</button><button className="text-button" disabled={externalBusy} onClick={() => { setStep(0); setFinished(false); }}>이야기 다시 읽기</button></div> : <ReadingExercise key={step} material={passage} childId={childId} sentenceIndex={step} active={active} externalBusy={externalBusy} onBusy={onBusy} onSaved={onSaved} onNext={advance} />}
        </div>
      </section>
      <aside className="student-aside"><section className="companion"><div className="companion-face" aria-hidden="true"><span>•</span><span className="smile">⌣</span><span>•</span></div><h2>작은 시작도 멋진 시작!</h2><p>틀려도 괜찮아.<br />한 문장씩 함께 읽어 보자.</p><span className="companion-sign">너의 읽기 친구, 그로</span></section><section className="journey"><h2>오늘의 작은 모험</h2><ol><li className="active"><span>✦</span><div>내 목소리로 읽기<small>문장을 읽고 녹음을 끝내 줘</small></div></li><li><span>♬</span><div>듣고 따라 읽기<small>같은 문장을 다시 읽어 봐</small></div></li><li><span>❀</span><div>두 목소리 남기기<small>학부모 화면에서 함께 들어 봐</small></div></li></ol></section><div className="gentle-note"><span aria-hidden="true">♡</span> 빠르게보다, 즐겁게 읽어요.</div></aside>
    </div>
  </>;
}
