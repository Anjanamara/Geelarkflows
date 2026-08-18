import { useEffect, useState } from 'react';
import './MrBeanFoldAnimation.css';

/**
 * MrBeanFoldAnimation — Iconic Mr. Bean "Fold the Flow into Cart" Micro-Interaction
 *
 * Timeline (Total: ~3.9s):
 * 0.0s - 0.7s : Mr. Bean tiptoes awkwardly onto the card
 * 0.7s - 1.1s : Suspicious check (looks left, right, raises eyebrow at user)
 * 1.1s - 1.4s : Grabs & lifts the workflow card
 * 1.4s - 1.8s : FOLD 1 — Left panel folds 3D inward (rotateY)
 * 1.8s - 2.2s : FOLD 2 — Right & Top panels fold 3D downward into a compact parcel
 * 2.2s - 2.55s: Smug pride pause (holds folded flow, smiles proudly)
 * 2.55s - 2.85s: Panic realization! (eyes widen, shock exclamation)
 * 2.85s - 3.40s: Rapid comedic sprint to floating cart
 * 3.40s - 3.60s: Shoves parcel into cart -> CART BOOM & badge pop!
 * 3.60s - 4.00s: Straightens red tie, brushes tweed suit, casually exits
 */
export default function MrBeanFoldAnimation({ activeFlow, onArrival, onComplete }) {
  const [stage, setStage] = useState('tiptoe'); // tiptoe | look | lift | fold1 | fold2 | smug | panic | sprint | deliver | aftermath
  const [beanPos, setBeanPos] = useState({ x: 0, y: 0 });
  const [flipX, setFlipX] = useState(false);

  useEffect(() => {
    if (!activeFlow) return;

    const { sourceRect, targetRect, product } = activeFlow;
    const isMobile = window.innerWidth <= 600;

    // Anchor coordinates around the clicked card
    const cardCenterX = sourceRect.left + sourceRect.width / 2;
    const cardCenterY = sourceRect.top + sourceRect.height / 2;

    // Mr. Bean positions
    const startX = Math.max(10, sourceRect.left - (isMobile ? 25 : 55));
    const startY = Math.max(40, sourceRect.top + (isMobile ? 10 : 30));

    const atCardX = Math.max(10, cardCenterX - (isMobile ? 40 : 50));
    const atCardY = startY;

    // Floating cart target
    const endX = targetRect.left + targetRect.width / 2 - (isMobile ? 30 : 40);
    const endY = targetRect.top + targetRect.height / 2 - (isMobile ? 20 : 30);

    // Initial positioning
    setBeanPos({ x: startX, y: startY });
    setStage('tiptoe');
    setFlipX(false);

    // Step 1: Walk to card
    const t1 = setTimeout(() => {
      setBeanPos({ x: atCardX, y: atCardY });
      setStage('look');
    }, 650);

    // Step 2: Lift card into hands
    const t2 = setTimeout(() => {
      setStage('lift');
    }, 1100);

    // Step 3: FOLD 1 (Horizontal 3D flap folds)
    const t3 = setTimeout(() => {
      setStage('fold1');
    }, 1450);

    // Step 4: FOLD 2 (Vertical 3D flap fold into compact parcel)
    const t4 = setTimeout(() => {
      setStage('fold2');
    }, 1850);

    // Step 5: Smug pride pause
    const t5 = setTimeout(() => {
      setStage('smug');
    }, 2250);

    // Step 6: Sudden panic!
    const t6 = setTimeout(() => {
      setStage('panic');
    }, 2550);

    // Step 7: Sprint to Floating Cart
    const t7 = setTimeout(() => {
      setStage('sprint');
      setFlipX(endX < atCardX);
      setBeanPos({ x: endX, y: endY + (isMobile ? 25 : 35) });
    }, 2850);

    // Step 8: Deliver into cart -> CART IMPACT
    const t8 = setTimeout(() => {
      setStage('deliver');
      onArrival(); // Triggers cart state update and pulse
    }, 3400);

    // Step 9: Straighten tie & casually stroll away
    const t9 = setTimeout(() => {
      setStage('aftermath');
      setBeanPos((prev) => ({ x: prev.x + (isMobile ? 50 : 80), y: prev.y }));
    }, 3650);

    // Step 10: Complete & unmount
    const t10 = setTimeout(() => {
      onComplete();
    }, 4050);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(t7);
      clearTimeout(t8);
      clearTimeout(t9);
      clearTimeout(t10);
    };
  }, [activeFlow, onArrival, onComplete]);

  if (!activeFlow) return null;

  const { sourceRect, product } = activeFlow;
  const isCarrying = ['smug', 'panic', 'sprint', 'deliver'].includes(stage);
  const showFoldingCard = ['lift', 'fold1', 'fold2'].includes(stage);

  return (
    <div className={`mrbean-fold-overlay stage-${stage}`}>
      {/* 3D Folding Card Representation (Renders right in Mr. Bean's hands) */}
      {showFoldingCard && (
        <div
          className={`card-fold-rig stage-${stage}`}
          style={{
            left: `${sourceRect.left + (sourceRect.width - Math.min(300, sourceRect.width)) / 2}px`,
            top: `${sourceRect.top + 20}px`,
            width: `${Math.min(300, sourceRect.width)}px`,
            height: `${Math.min(360, sourceRect.height)}px`,
          }}
        >
          <div className="card-fold-3d-scene">
            {/* Center Base Card */}
            <div className="fold-panel-base">
              <div className="fold-card-top-bar">
                <span className="fold-card-badge">GEELARK FLOW</span>
                <span className="fold-card-tag">UNLIMITED RUNS</span>
              </div>
              <div className="fold-card-circuit">
                <span className="node active" />
                <span className="line" />
                <span className="node active" />
                <span className="line" />
                <span className="node" />
              </div>
              <div className="fold-card-info">
                <h4 className="fold-card-title">{product.title}</h4>
                <div className="fold-card-price">${product.price?.toLocaleString('en-US')} USD</div>
              </div>
            </div>

            {/* Left 3D Folding Flap */}
            <div className="fold-panel-flap-left">
              <div className="flap-inner">
                <span className="flap-text">FLOW</span>
              </div>
            </div>

            {/* Right 3D Folding Flap */}
            <div className="fold-panel-flap-right">
              <div className="flap-inner">
                <span className="flap-text">GF</span>
              </div>
            </div>

            {/* Top 3D Folding Flap */}
            <div className="fold-panel-flap-top">
              <div className="flap-seal">
                <span>GF</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mr. Bean Character Rig */}
      <div
        className={`mrbean-actor ${flipX ? 'flip-actor' : ''}`}
        style={{
          transform: `translate3d(${beanPos.x}px, ${beanPos.y}px, 0)`,
        }}
      >
        {/* Panic Exclamation Bubble */}
        {stage === 'panic' && (
          <div className="mrbean-panic-bubble">
            <span className="panic-exclaim">!</span>
            <span className="panic-sweatdrop" />
          </div>
        )}

        <div className="mrbean-svg-wrapper">
          <svg
            viewBox="0 0 100 135"
            width="85"
            height="115"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mrbean-svg"
          >
            {/* Ground Shadow */}
            <ellipse cx="50" cy="128" rx="22" ry="5" fill="rgba(0,0,0,0.4)" />

            {/* Legs & Shoes (Dark charcoal suit trousers & black shoes) */}
            <g className="mrbean-legs">
              <path
                className="bean-leg-left"
                d="M40 92 L38 118 L30 121 L30 125 L44 125 L45 92 Z"
                fill="#181B19"
              />
              <path
                className="bean-leg-right"
                d="M56 92 L58 118 L66 121 L66 125 L52 125 L51 92 Z"
                fill="#121513"
              />
            </g>

            {/* Torso — Classic Mr. Bean Brown Tweed Jacket & Red Tie */}
            <g className="mrbean-torso">
              {/* Tweed Jacket Base */}
              <path
                d="M30 52 L70 52 L66 94 L34 94 Z"
                fill="#6A4E38"
                stroke="#4A3423"
                strokeWidth="1.5"
              />

              {/* White Shirt V */}
              <polygon points="44,52 56,52 50,70" fill="#FFFFFF" />

              {/* Skinny Red Tie */}
              <g className="mrbean-tie">
                <polygon points="48,54 52,54 53,78 50,84 47,78" fill="#DC2626" />
                <polygon points="48,52 52,52 51,56 49,56" fill="#991B1B" />
              </g>

              {/* Tweed Jacket Lapels */}
              <path d="M30 52 L44 70 L34 94 L30 52 Z" fill="#7C5D44" />
              <path d="M70 52 L56 70 L66 94 L70 52 Z" fill="#58402D" />
              {/* Suit Pocket & Button */}
              <rect x="35" y="76" width="8" height="2" fill="#4A3423" />
              <circle cx="51" cy="74" r="1.5" fill="#3D2B1D" />
            </g>

            {/* Arms & Hands */}
            <g className="mrbean-arms">
              <path
                className="bean-arm-left"
                d="M30 54 Q20 70 26 84 Q28 86 32 82 Q26 70 34 56 Z"
                fill="#7C5D44"
              />
              <circle className="bean-hand-left" cx="28" cy="85" r="4.5" fill="#F3CA9E" />

              <path
                className="bean-arm-right"
                d="M70 54 Q78 70 72 84 Q70 86 66 82 Q72 70 66 56 Z"
                fill="#58402D"
              />
              <circle className="bean-hand-right" cx="70" cy="85" r="4.5" fill="#F3CA9E" />
            </g>

            {/* Compact Folded Parcel in Hands (Carried during sprint & smug stages) */}
            {isCarrying && (
              <g className="mrbean-held-package">
                <rect
                  x="28"
                  y="68"
                  width="44"
                  height="22"
                  rx="5"
                  fill="#141715"
                  stroke="#A7FF4F"
                  strokeWidth="1.5"
                />
                <rect x="32" y="72" width="12" height="10" rx="2" fill="#A7FF4F" />
                <text x="34" y="80" fontSize="6.5" fontWeight="900" fill="#09100D" fontFamily="monospace">
                  GF
                </text>
                <text x="47" y="80" fontSize="6" fontWeight="800" fill="#F1F3F1" fontFamily="sans-serif">
                  FLOW
                </text>
                {/* Lime Ribbon Accent */}
                <line x1="28" y1="79" x2="72" y2="79" stroke="rgba(167, 255, 79, 0.45)" strokeWidth="1.2" />
              </g>
            )}

            {/* Iconic Mr. Bean Head Group (Expressive eyebrows, comic nose, dark side-part hair) */}
            <g className="mrbean-head">
              <rect x="46" y="44" width="8" height="9" fill="#F3CA9E" />
              <ellipse cx="50" cy="28" rx="16" ry="18" fill="#F3CA9E" />

              {/* Side-parted black/dark-brown hair */}
              <path
                d="M34 24 C34 12 66 12 66 24 C66 16 60 12 50 12 C40 12 34 16 34 24 Z"
                fill="#1C1815"
              />
              <path d="M34 24 C33 30 35 36 34 38 L37 34 C36 30 36 24 34 24 Z" fill="#1C1815" />
              <path d="M66 24 C67 30 65 36 66 38 L63 34 C64 30 64 24 66 24 Z" fill="#1C1815" />

              {/* Prominent Comic Ears */}
              <ellipse cx="33" cy="30" rx="3" ry="5" fill="#F3CA9E" stroke="#DCA270" strokeWidth="0.8" />
              <ellipse cx="67" cy="30" rx="3" ry="5" fill="#F3CA9E" stroke="#DCA270" strokeWidth="0.8" />

              {/* Eyes & Pupils */}
              <g className="bean-eyes">
                <ellipse className="bean-eye-l" cx="43" cy="26" rx="4.5" ry="5" fill="#FFFFFF" stroke="#222" strokeWidth="0.6" />
                <circle className="bean-pupil-l" cx="43" cy="26" r="2.2" fill="#1C1815" />

                <ellipse className="bean-eye-r" cx="57" cy="26" rx="4.5" ry="5" fill="#FFFFFF" stroke="#222" strokeWidth="0.6" />
                <circle className="bean-pupil-r" cx="57" cy="26" r="2.2" fill="#1C1815" />
              </g>

              {/* Classic Expressive Bushy Eyebrows */}
              <g className="bean-eyebrows">
                <path className="bean-brow-l" d="M38 19 Q43 17 48 19" stroke="#1C1815" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path className="bean-brow-r" d="M52 19 Q57 17 62 19" stroke="#1C1815" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </g>

              {/* Prominent Mr. Bean Nose */}
              <path d="M50 24 L53 33 L47 34 Z" fill="#E2A676" />

              {/* Mouth (Transitions from smirk to 'O' panic to whistle) */}
              <path className="bean-mouth" d="M45 37 Q50 39 55 37" stroke="#1C1815" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
