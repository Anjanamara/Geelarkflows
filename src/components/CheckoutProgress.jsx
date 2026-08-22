import React from 'react';
import './CheckoutProgress.css';

const STEPS = [
  { id: 'cart', label: 'Cart' },
  { id: 'checkout', label: 'Checkout' },
  { id: 'payment', label: 'Payment' },
  { id: 'confirmation', label: 'Confirmation' },
];

export default function CheckoutProgress({ currentStep = 'cart', onStepClick }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  const activeIdx = currentIndex >= 0 ? currentIndex : 0;

  return (
    <nav className="checkout-progress-nav" aria-label="Checkout Progress">
      <ol className="progress-steps-list">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          const isUpcoming = idx > activeIdx;
          const isClickable = isCompleted && typeof onStepClick === 'function';

          return (
            <li
              key={step.id}
              className={`progress-step-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isUpcoming ? 'upcoming' : ''}`}
            >
              <div
                className={`step-bubble-wrap ${isClickable ? 'clickable' : ''}`}
                onClick={() => isClickable && onStepClick(step.id)}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    onStepClick(step.id);
                  }
                }}
              >
                <span className="step-badge">
                  {isCompleted ? (
                    <svg className="check-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2.5 6 4.8 8.5 9.5 3.5" />
                    </svg>
                  ) : (
                    <span className="font-mono">{idx + 1}</span>
                  )}
                </span>
                <span className="step-label">{step.label}</span>
              </div>
              {idx < STEPS.length - 1 && <span className="step-connector" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
