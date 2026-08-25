import { useState, useEffect, useRef } from 'react';
import './CustomRequestModal.css';

export default function CustomRequestModal({ isOpen, onClose, requestType }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: requestType || 'flow',
    details: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [referenceId, setReferenceId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Update type if prop changes
  useEffect(() => {
    if (requestType) {
      setFormData(prev => ({ ...prev, type: requestType }));
    }
  }, [requestType]);

  // Reset form on open/close
  useEffect(() => {
    if (!isOpen) {
      const resetTimer = setTimeout(() => {
        setFormData({ name: '', email: '', type: requestType || 'flow', details: '' });
        setIsSuccess(false);
        setIsSubmitting(false);
        setReferenceId(null);
        setErrorMessage(null);
        setFocusedField(null);
      }, 300);
      return () => clearTimeout(resetTimer);
    }
    return undefined;
  }, [isOpen, requestType]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Client-side quick validation
    if (!formData.name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    if (!formData.details.trim() || formData.details.trim().length < 10) {
      setErrorMessage('Please provide at least 10 characters describing your requirements.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/custom-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          type: formData.type || 'flow',
          details: formData.details.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        setReferenceId(data.request_id || null);
        setIsSuccess(true);
      } else if (response.status === 429) {
        setErrorMessage(data?.error || 'Too many requests submitted recently. Please wait a few minutes before trying again.');
      } else {
        setErrorMessage(data?.error || 'Unable to submit your request at this moment. Please try again or contact support@geelarkflows.com.');
      }
    } catch (err) {
      setErrorMessage('Network connection error. Please check your connection and try again, or email support@geelarkflows.com directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFlow = formData.type === 'flow';

  return (
    <div className="custom-request-overlay" onClick={onClose}>
      <div ref={dialogRef} className="custom-request-container" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="custom-request-title">
        
        {/* Left: Dynamic Visual Panel */}
        <div className={`visual-panel ${isFlow ? 'theme-flow' : 'theme-consulting'}`}>
          <div className="dynamic-bg"></div>
          
          {/* Animated decorative shapes */}
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>

          <div className="visual-content">
            <div className="badge">{isFlow ? 'Custom Development' : 'Expert Guidance'}</div>
            <h2 id="custom-request-title">{isFlow ? 'Build the flow your operation needs.' : 'Get a clear automation plan.'}</h2>
            <p>
              {isFlow 
                ? 'Tell us what you want to build. From custom automation to complete workflows, we bring your ideas to life with precision.' 
                : 'Need expert direction? Let\'s discuss your goals and map out a comprehensive strategy for success.'}
            </p>
          </div>
        </div>

        {/* Right: Interactive Form Panel */}
        <div className="form-panel">
          <button ref={closeButtonRef} className="panel-close-btn" onClick={onClose} aria-label="Close modal">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div className="form-content-wrapper">
            {isSuccess ? (
              <div className="success-state">
                <div className="success-icon-wrapper">
                  <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <h3>Request Received</h3>
                {referenceId && (
                  <div className="request-reference-badge">
                    <span>Reference ID:</span>
                    <strong>{referenceId}</strong>
                  </div>
                )}
                <p>
                  Your requirements have been securely recorded. Our team will review your specifications and contact you at <strong>{formData.email}</strong>.
                </p>
                <div className="success-footer-note">
                  <small>For direct inquiries or follow-ups: <a href="mailto:support@geelarkflows.com">support@geelarkflows.com</a></small>
                </div>
                <button type="button" className="success-done-btn" onClick={onClose}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="premium-form">
                <div className="form-header">
                  <h3>Project Details</h3>
                  <p>Fill out the form below to submit your requirements.</p>
                </div>

                {errorMessage && (
                  <div className="form-error-banner" role="alert">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="form-row">
                  <div className={`input-group ${focusedField === 'name' || formData.name ? 'active' : ''}`}>
                    <label htmlFor="name">Full Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      maxLength={100}
                      disabled={isSubmitting}
                      required
                    />
                    <div className="input-line"></div>
                  </div>

                  <div className={`input-group ${focusedField === 'email' || formData.email ? 'active' : ''}`}>
                    <label htmlFor="email">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      maxLength={254}
                      disabled={isSubmitting}
                      required
                    />
                    <div className="input-line"></div>
                  </div>
                </div>

                <div className="input-group select-group">
                  <label htmlFor="type">Service Required</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="flow">Custom Flow Creation</option>
                    <option value="consulting">Consulting & Strategy</option>
                  </select>
                  <svg className="select-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>

                <div className={`input-group textarea-group ${focusedField === 'details' || formData.details ? 'active' : ''}`}>
                  <label htmlFor="details">Project Requirements</label>
                  <textarea
                    id="details"
                    name="details"
                    value={formData.details}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('details')}
                    onBlur={() => setFocusedField(null)}
                    maxLength={5000}
                    disabled={isSubmitting}
                    placeholder="Describe the platform, workflow steps, triggers, volume, and target outcomes..."
                    required
                  />
                  <div className="input-line"></div>
                </div>

                <button type="submit" className={`premium-submit-btn ${isSubmitting ? 'submitting' : ''}`} disabled={isSubmitting}>
                  <span className="btn-text">{isSubmitting ? 'Submitting Request...' : 'Submit Request'}</span>
                  <span className="btn-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
