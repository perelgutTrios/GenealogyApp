import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gedcomService, handleApiError } from '../services/api';
const GenEntry = () => {
  const { user, logout } = useAuth();
  const [gedcomStats, setGedcomStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadGedcomStats();
  }, []);

  const loadGedcomStats = async () => {
    try {
      setIsLoading(true);
      const stats = await gedcomService.getStats();
      setGedcomStats(stats);
    } catch (err) {
      const apiError = handleApiError(err);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <div className="loading-spinner"></div>
          <p className="mt-3 text-muted">Loading your genealogy data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-genealogy family-tree-bg min-vh-100">
      {/* Navigation Header */}
      <nav className="navbar navbar-expand-lg navbar-dark" style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}>
        <div className="container">
          <span className="navbar-brand">
            <i className="bi bi-tree-fill me-2"></i>
            Steve's Genealogy Tool
          </span>
          <div className="navbar-nav ms-auto">
            <div className="nav-item dropdown">
              <a
                className="nav-link dropdown-toggle text-white"
                href="#"
                id="navbarDropdown"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="bi bi-person-circle me-1"></i>
                {user?.givenNames} {user?.familyNames}
              </a>
              <ul className="dropdown-menu">
                <li>
                  <button className="dropdown-item" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Logout
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            {/* Welcome Message */}
            <div className="card card-custom mb-4">
              <div className="card-body p-5 text-center">
                <h1 className="text-genealogy mb-3">
                  <i className="bi bi-check-circle-fill text-success me-3"></i>
                  Welcome, You Have Made a Great Start!
                </h1>
                <p className="lead text-muted">
                  Congratulations on setting up your genealogy database. Your family history journey begins here.
                </p>
              </div>
            </div>

            {/* GEDCOM Database Info */}
            {gedcomStats && (
              <div className="card card-custom mb-4">
                <div className="card-body p-4">
                  <h3 className="text-genealogy mb-4">
                    <i className="bi bi-database me-2"></i>
                    Your GEDCOM Database
                  </h3>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <strong>Database ID:</strong>
                        <br />
                        <code className="text-muted">{gedcomStats.databaseId}</code>
                      </div>
                      <div className="mb-3">
                        <strong>GEDCOM Version:</strong>
                        <br />
                        <span className="badge bg-primary">{gedcomStats.version}</span>
                      </div>
                      {gedcomStats.sourceFile && (
                        <div className="mb-3">
                          <strong>Source File:</strong>
                          <br />
                          <span className="text-muted">{gedcomStats.sourceFile}</span>
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <strong>Total Individuals:</strong>
                        <br />
                        <span className="text-genealogy fs-4 fw-bold">{gedcomStats.totalIndividuals}</span>
                      </div>
                      <div className="mb-3">
                        <strong>Total Families:</strong>
                        <br />
                        <span className="text-genealogy fs-4 fw-bold">{gedcomStats.totalFamilies}</span>
                      </div>
                      <div className="mb-3">
                        <strong>Last Modified:</strong>
                        <br />
                        <span className="text-muted">
                          {new Date(gedcomStats.lastModified).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="error-message">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </div>
            )}

            {/* Next Steps */}
            <div className="card card-custom">
              <div className="card-body p-4">
                <h3 className="text-genealogy mb-4">
                  <i className="bi bi-list-check me-2"></i>
                  What's Next?
                </h3>
                
                <div className="row">
                  <div className="col-md-6">
                    <div className="d-grid gap-2 mb-3">
                      <button className="btn btn-genealogy" disabled>
                        <i className="bi bi-people me-2"></i>
                        View Family Tree
                        <small className="d-block">Coming Soon</small>
                      </button>
                      <button className="btn btn-genealogy-outline" disabled>
                        <i className="bi bi-person-plus me-2"></i>
                        Add Family Members
                        <small className="d-block">Coming Soon</small>
                      </button>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-grid gap-2 mb-3">
                      <button className="btn btn-genealogy-outline" disabled>
                        <i className="bi bi-search me-2"></i>
                        Search Records
                        <small className="d-block">Coming Soon</small>
                      </button>
                      <button className="btn btn-genealogy-outline" disabled>
                        <i className="bi bi-file-earmark-text me-2"></i>
                        Generate Reports
                        <small className="d-block">Coming Soon</small>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-4">
                  <p className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    More features will be added in future releases. Stay tuned!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenEntry;