import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, handleApiError } from '../services/api';
const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    givenNames: '',
    familyNames: '',
  });
  const [gedcomFile, setGedcomFile] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  // Handle file selection
  const handleFileSelect = (file) => {
    setGedcomFile(file);
    if (error) setError('');
  };

  // Handle drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.ged') || file.name.toLowerCase().endsWith('.gedcom')) {
        handleFileSelect(file);
      } else {
        setError('Please select a valid GEDCOM file (.ged or .gedcom)');
      }
    }
  };

  // Validate form
  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword || 
        !formData.givenNames || !formData.familyNames) {
      return 'All fields are required';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (!/(?=.*[a-z])/.test(formData.password)) {
      return 'Password must contain at least one lowercase letter';
    }

    if (!/(?=.*[A-Z])/.test(formData.password)) {
      return 'Password must contain at least one uppercase letter';
    }

    if (!/(?=.*\d)/.test(formData.password)) {
      return 'Password must contain at least one digit';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }

    return null;
  };

  // Handle register with GEDCOM
  const handleRegisterWithGedcom = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!gedcomFile) {
      setError('Please select a GEDCOM file');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.registerWithGedcom({
        ...formData,
        gedcomFile
      });
      
      // Navigate to verification with user data
      navigate('/verify', { 
        state: { 
          userId: response.userId, 
          email: response.email, 
          hasGedcom: true 
        } 
      });
    } catch (err) {
      const apiError = handleApiError(err);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle register without GEDCOM
  const handleRegisterWithoutGedcom = () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Navigate to first GEDCOM entry page
    navigate('/first-gedcom', { 
      state: { 
        registrationData: formData 
      } 
    });
  };

  // Return to login
  const handleReturnToLogin = () => {
    navigate('/');
  };

  return (
    <div className="bg-genealogy family-tree-bg min-vh-100 d-flex align-items-center py-4">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-7">
            <div className="text-center mb-4">
              <h1 className="welcome-title">
                <i className="bi bi-person-plus-fill me-3"></i>
                Join Our Family
              </h1>
              <p className="welcome-subtitle">
                Create your account and start your genealogy journey
              </p>
            </div>

            <div className="card card-custom">
              <div className="card-body p-5">
                <h2 className="text-center text-genealogy mb-4">Registration</h2>
                
                {error && (
                  <div className="error-message">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleRegisterWithGedcom}>
                  <div className="row">
                    <div className="col-md-6 mb-3">
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
                        placeholder="First Middle"
                      />
                    </div>
                    <div className="col-md-6 mb-3">
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
                        placeholder="Last"
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      className="form-control form-control-custom"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="your-email@example.com"
                    />
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="password" className="form-label">
                        Password *
                      </label>
                      <input
                        type="password"
                        className="form-control form-control-custom"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        placeholder="At least 8 characters"
                      />
                      <small className="form-text text-muted">
                        Must contain uppercase, lowercase, and digit
                      </small>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="confirmPassword" className="form-label">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        className="form-control form-control-custom"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        placeholder="Repeat password"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label">GEDCOM File (Optional)</label>
                    <div
                      className={`file-upload-area ${dragOver ? 'dragover' : ''}`}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('gedcomFile')?.click()}
                    >
                      {gedcomFile ? (
                        <div>
                          <i className="bi bi-file-earmark-check text-success" style={{ fontSize: '2rem' }}></i>
                          <p className="mt-2 mb-1"><strong>{gedcomFile.name}</strong></p>
                          <p className="text-muted">
                            {(gedcomFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGedcomFile(null);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div>
                          <i className="bi bi-cloud-upload text-genealogy" style={{ fontSize: '2rem' }}></i>
                          <p className="mt-2 mb-1">
                            <strong>Click to upload or drag & drop</strong>
                          </p>
                          <p className="text-muted">
                            GEDCOM files (.ged, .gedcom) up to 10MB
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      id="gedcomFile"
                      accept=".ged,.gedcom"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
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
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Registering...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-file-earmark-arrow-up me-2"></i>
                          Register with GEDCOM
                        </>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      className="btn btn-genealogy-outline"
                      onClick={handleRegisterWithoutGedcom}
                      disabled={isLoading}
                    >
                      <i className="bi bi-person-plus me-2"></i>
                      Register without GEDCOM
                    </button>

                    <button
                      type="button"
                      className="btn btn-link text-genealogy"
                      onClick={handleReturnToLogin}
                      disabled={isLoading}
                    >
                      <i className="bi bi-arrow-left me-2"></i>
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

export default RegisterPage;