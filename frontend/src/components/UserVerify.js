import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService, handleApiError } from '../services/api';
const UserVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  const state = location.state;

  useEffect(() => {
    if (!state?.userId) {
      navigate('/register');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          navigate('/register');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!state?.userId) return;

    setError('');
    setIsLoading(true);

    try {
      const response = await authService.verifyEmail({
        userId: state.userId,
        verificationCode: verificationCode.trim()
      });
      
      login(response.user, response.token);
      navigate('/', { 
        state: { 
          successMessage: response.message,
          email: state.email 
        } 
      });
    } catch (err) {
      const apiError = handleApiError(err);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!state?.userId) {
    return null;
  }

  return (
    <div className="bg-genealogy family-tree-bg min-vh-100 d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="text-center mb-4">
              <h1 className="welcome-title">
                <i className="bi bi-envelope-check-fill me-3"></i>
                Verify Your Email
              </h1>
              <p className="welcome-subtitle">
                We sent a code to {state.email}
              </p>
            </div>

            <div className="card card-custom">
              <div className="card-body p-5">
                <div className="text-center mb-4">
                  <i className="bi bi-clock text-genealogy" style={{ fontSize: '2rem' }}></i>
                  <p className="mt-2 mb-0">Time remaining:</p>
                  <h3 className="text-genealogy">{formatTime(timeLeft)}</h3>
                </div>

                {error && (
                  <div className="error-message">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleVerify}>
                  <div className="mb-4">
                    <label htmlFor="verificationCode" className="form-label text-center d-block">
                      Enter the 6-digit verification code
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-custom verification-code"
                      id="verificationCode"
                      value={verificationCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 6) {
                          setVerificationCode(value);
                        }
                      }}
                      maxLength={6}
                      placeholder="000000"
                      required
                    />
                  </div>

                  <div className="d-grid gap-2">
                    <button
                      type="submit"
                      className="btn btn-genealogy"
                      disabled={isLoading || verificationCode.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Verifying...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          Verify Email
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
                      Back to Registration
                    </button>
                  </div>
                </form>

                <div className="text-center mt-4">
                  <small className="text-muted">
                    Didn't receive the code? Check your spam folder or try registering again.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserVerify;