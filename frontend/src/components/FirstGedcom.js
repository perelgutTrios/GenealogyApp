import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService, handleApiError } from '../services/api';
const FirstGedcom = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state;

  const [formData, setFormData] = useState({
    givenNames: '',
    familyNames: '',
    birthDate: '',
    birthCity: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleCreateEntry = async (e) => {
    e.preventDefault();
    if (!state?.registrationData) {
      setError('Registration data not found. Please start registration again.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const registrationData = {
        ...state.registrationData,
        ...formData
      };

      const response = await authService.registerFirstGedcom(registrationData);
      
      navigate('/verify', { 
        state: { 
          userId: response.userId, 
          email: response.email, 
          hasGedcom: false 
        } 
      });
    } catch (err) {
      const apiError = handleApiError(err);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-genealogy family-tree-bg min-vh-100 d-flex align-items-center py-4">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="text-center mb-4">
              <h1 className="welcome-title">
                <i className="bi bi-person-fill me-3"></i>
                Your First Entry
              </h1>
              <p className="welcome-subtitle">
                Tell us about yourself to start your family tree
              </p>
            </div>

            <div className="card card-custom">
              <div className="card-body p-5">
                <h2 className="text-center text-genealogy mb-4">Basic Information</h2>
                
                {error && (
                  <div className="error-message">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleCreateEntry}>
                  <div className="mb-3">
                    <label htmlFor="givenNames" className="form-label">
                      Given Name(s) *
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-custom"
                      id="givenNames"
                      name="givenNames"
                      value={formData.givenNames}
                      onChange={handleInputChange}
                      required
                      placeholder="Your first name(s)"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="familyNames" className="form-label">
                      Family Name(s) *
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-custom"
                      id="familyNames"
                      name="familyNames"
                      value={formData.familyNames}
                      onChange={handleInputChange}
                      required
                      placeholder="Your family name(s)"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="birthDate" className="form-label">
                      Birth Date *
                    </label>
                    <input
                      type="date"
                      className="form-control form-control-custom"
                      id="birthDate"
                      name="birthDate"
                      value={formData.birthDate}
                      onChange={handleInputChange}
                      required
                      max={new Date(new Date().getFullYear() - 13, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]}
                    />
                    <small className="form-text text-muted">
                      Must be at least 13 years ago
                    </small>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="birthCity" className="form-label">
                      Birth City *
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-custom"
                      id="birthCity"
                      name="birthCity"
                      value={formData.birthCity}
                      onChange={handleInputChange}
                      required
                      placeholder="City where you were born"
                    />
                  </div>

                  <div className="d-grid gap-2">
                    <button
                      type="submit"
                      className="btn btn-genealogy"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Creating Entry...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          Create Entry
                        </>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      className="btn btn-genealogy-outline"
                      onClick={() => navigate('/register')}
                      disabled={isLoading}
                    >
                      <i className="bi bi-arrow-left me-2"></i>
                      Return to Registration
                    </button>

                    <button
                      type="button"
                      className="btn btn-link text-genealogy"
                      onClick={() => navigate('/')}
                      disabled={isLoading}
                    >
                      Return to Login
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstGedcom;