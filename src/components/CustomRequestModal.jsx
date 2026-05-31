import { useState, useEffect } from 'react';
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
  const [focusedField, setFocusedField] = useState(null);

  // Update type if prop changes
  useEffect(() => {
    if (requestType) {
      setFormData(prev => ({ ...prev, type: requestType }));
    }
  }, [requestType]);

  // Reset form on open/close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setFormData({ name: '', email: '', type: requestType || 'flow', details: '' });
        setIsSuccess(false);
        setIsSubmitting(false);
        setFocusedField(null);
      }, 300);
    }
  }, [isOpen, requestType]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      
      // Auto close after 3.5 seconds
      setTimeout(() => {
        if (isOpen) onClose();
      }, 3500);
    }, 1500);
  };

  const isFlow = formData.type === 'flow';

  return (
    <div className="custom-request-overlay" onClick={onClose}>
      <div className="custom-request-container" onClick={e => e.stopPropagation()}>
        
        {/* Left: Dynamic Visual Panel */}
        <div className={`visual-panel ${isFlow ? 'theme-flow' : 'theme-consulting'}`}>
          <div className="dynamic-bg"></div>
          
          {/* Animated decorative shapes */}
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>

          <div className="visual-content">
            <div className="badge">{isFlow ? 'Custom Development' : 'Expert Guidance'}</div>
            <h2>{isFlow ? 'Architect Your Vision.' : 'Strategic Growth.'}</h2>
            <p>
              {isFlow 
                ? 'Tell us what you want to build. From custom automation to complete workflows, we bring your ideas to life with precision.' 
                : 'Need expert direction? Let\'s discuss your goals and map out a comprehensive strategy for success.'}
            </p>
          </div>
        </div>

        {/* Right: Interactive Form Panel */}
        <div className="form-panel">
          <button className="panel-close-btn" onClick={onClose} aria-label="Close modal">
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
                <h3>Request Initiated</h3>
                <p>We've received your requirements. Our team will review the details and contact you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="premium-form">
                <div className="form-header">
                  <h3>Project Details</h3>
                  <p>Fill out the form below to get started.</p>
                </div>

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
                    required
                  />
                  <div className="input-line"></div>
                </div>

                <button type="submit" className={`premium-submit-btn ${isSubmitting ? 'submitting' : ''}`} disabled={isSubmitting}>
                  <span className="btn-text">{isSubmitting ? 'Processing...' : 'Submit Request'}</span>
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
