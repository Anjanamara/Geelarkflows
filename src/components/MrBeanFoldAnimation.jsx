import { useEffect, useRef, useState } from 'react';
import './MrBeanFoldAnimation.css';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function MrBeanFoldAnimation({ activeFlow, onArrival, onComplete }) {
  const [stage, setStage] = useState('tiptoe');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [facingLeft, setFacingLeft] = useState(false);
  const arrivedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!activeFlow) return undefined;

    const { sourceRect, targetRect } = activeFlow;
    const isMobile = window.innerWidth < 640;
    const actorWidth = isMobile ? 64 : 78;
    const actorHeight = isMobile ? 88 : 108;
    const edge = isMobile ? 6 : 12;
    const maxX = Math.max(edge, window.innerWidth - actorWidth - edge);
    const maxY = Math.max(70, window.innerHeight - actorHeight - edge);

    const sourceX = clamp(sourceRect.right - actorWidth - 14, edge, maxX);
    const sourceY = clamp(sourceRect.bottom - actorHeight - 10, 72, maxY);
    const targetX = clamp(targetRect.left + (targetRect.width / 2) - (actorWidth / 2), edge, maxX);
    const targetY = clamp(targetRect.bottom + (isMobile ? 5 : 9), 72, maxY);
    const exitDirection = targetX < sourceX ? -1 : 1;

    arrivedRef.current = false;
    completedRef.current = false;
    setPosition({ x: sourceX, y: sourceY });
    setFacingLeft(false);
    setStage('tiptoe');

    const schedule = (delay, callback) => window.setTimeout(callback, delay);
    const timers = [
      schedule(480, () => setStage('inspect')),
      schedule(820, () => setStage('lift')),
      schedule(1160, () => setStage('fold')),
      schedule(1500, () => setStage('proud')),
      schedule(1740, () => setStage('panic')),
      schedule(1910, () => {
        setFacingLeft(targetX < sourceX);
        setStage('sprint');
        setPosition({ x: targetX, y: targetY });
      }),
      schedule(2440, () => {
        setStage('deliver');
        if (!arrivedRef.current) {
          arrivedRef.current = true;
          onArrival();
        }
      }),
      schedule(2670, () => {
        setStage('exit');
        setPosition({
          x: clamp(targetX + (exitDirection * (isMobile ? 44 : 68)), edge, maxX),
          y: targetY,
        });
      }),
      schedule(2970, () => {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
      }),
    ];

    return () => timers.forEach(window.clearTimeout);
  }, [activeFlow, onArrival, onComplete]);

  if (!activeFlow) return null;

  const showSheet = ['inspect', 'lift', 'fold'].includes(stage);
  const showParcel = ['proud', 'panic', 'sprint', 'deliver'].includes(stage);
  const { targetRect, product } = activeFlow;

  return (
    <div className={`mrbean-fold-overlay bean-stage-${stage}`} aria-hidden="true">
      <div
        className="bean-cart-impact"
        style={{
          left: `${targetRect.left + (targetRect.width / 2)}px`,
          top: `${targetRect.top + (targetRect.height / 2)}px`,
        }}
      >
        <i /><i /><i /><span>Flow added</span>
      </div>

      <div
        className={`mrbean-actor ${facingLeft ? 'faces-left' : ''}`}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      >
        {stage === 'panic' && <span className="bean-alert">!</span>}

        {showSheet && (
          <div className="bean-flow-sheet">
            <div className="bean-sheet-face">
              <span>GEELARK FLOW</span>
              <strong>{product.title}</strong>
              <small>${product.price?.toLocaleString('en-US')} · unlimited runs</small>
            </div>
            <i className="bean-sheet-fold bean-sheet-fold-left" />
            <i className="bean-sheet-fold bean-sheet-fold-right" />
            <b className="bean-sheet-seal">GF</b>
          </div>
        )}

        <span className="bean-speed-lines"><i /><i /><i /></span>

        <svg className="mrbean-svg" viewBox="0 0 100 138" xmlns="http://www.w3.org/2000/svg">
          <ellipse className="bean-shadow" cx="50" cy="130" rx="23" ry="5" />

          <g className="bean-legs">
            <path className="bean-leg bean-leg-left" d="M40 91 38 118 29 122 30 127 44 126 46 92Z" />
            <path className="bean-leg bean-leg-right" d="M55 92 58 118 68 122 67 127 52 126 50 92Z" />
          </g>

          <g className="bean-body">
            <path className="bean-jacket" d="M29 52 70 52 66 95 34 95Z" />
            <path className="bean-shirt" d="m42 52 16 0-8 20Z" />
            <path className="bean-lapel bean-lapel-left" d="m29 52 15 18-10 25Z" />
            <path className="bean-lapel bean-lapel-right" d="m70 52-14 18 10 25Z" />
            <g className="bean-tie">
              <path d="m47 54 6 0-1 24-3 7-3-7Z" />
              <path d="m47 52 6 0-2 5-2 0Z" />
            </g>
            <path className="bean-pocket" d="M36 77h8" />
            <circle className="bean-button" cx="51" cy="75" r="1.6" />
          </g>

          <g className="bean-arms">
            <path className="bean-arm bean-arm-left" d="M30 55Q20 70 27 85l6-3q-7-12 2-25Z" />
            <circle className="bean-hand" cx="29" cy="85" r="4.6" />
            <path className="bean-arm bean-arm-right" d="M69 55q10 15 3 30l-6-3q7-12-2-25Z" />
            <circle className="bean-hand" cx="70" cy="85" r="4.6" />
          </g>

          {showParcel && (
            <g className="bean-parcel">
              <rect x="27" y="68" width="46" height="23" rx="5" />
              <path d="M27 79h46M49 68v23" />
              <rect x="32" y="72" width="13" height="10" rx="2" />
              <text x="34" y="80">GF</text>
            </g>
          )}

          <g className="bean-head">
            <path className="bean-neck" d="M46 44h8v10h-8z" />
            <ellipse className="bean-face" cx="50" cy="29" rx="17" ry="19" />
            <path className="bean-hair" d="M33 25q1-15 17-15 16 0 18 15-7-10-17-9-10 0-18 9Zm1-2q-2 11 1 17l3-7-1-10Zm33 0q2 11-1 17l-3-7 1-10Z" />
            <ellipse className="bean-ear" cx="33" cy="31" rx="3.2" ry="5.2" />
            <ellipse className="bean-ear" cx="67" cy="31" rx="3.2" ry="5.2" />
            <g className="bean-eyes">
              <ellipse cx="43" cy="27" rx="4.6" ry="5.2" />
              <ellipse cx="57" cy="27" rx="4.6" ry="5.2" />
              <circle className="bean-pupil bean-pupil-left" cx="43" cy="27" r="2.1" />
              <circle className="bean-pupil bean-pupil-right" cx="57" cy="27" r="2.1" />
            </g>
            <g className="bean-brows">
              <path className="bean-brow-left" d="M38 20q5-3 10 0" />
              <path d="M52 20q5-3 10 0" />
            </g>
            <path className="bean-nose" d="m50 24 4 10-7 1Z" />
            {stage === 'panic'
              ? <ellipse className="bean-mouth bean-mouth-panic" cx="50" cy="40" rx="3" ry="4" />
              : <path className="bean-mouth" d="M45 39q5 3 10 0" />}
          </g>
        </svg>
      </div>
    </div>
  );
}
