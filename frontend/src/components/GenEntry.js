import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gedcomService, handleApiError } from '../services/api';

const GenEntry = () => {
  const { user, logout } = useAuth();
  const [gedcomStats, setGedcomStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPersonId, setCurrentPersonId] = useState(null);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedPersonName, setSelectedPersonName] = useState(null);

  useEffect(() => {
    loadGedcomStats();
  }, []);

  const loadGedcomStats = async (personId = null) => {
    try {
      setIsLoading(true);
      console.log('🔍 Fetching GEDCOM stats for person:', personId || 'default user');
      
      let stats;
      if (personId) {
        // Load specific person by ID
        stats = await loadPersonById(personId);
      } else {
        // Load default user's stats
        stats = await gedcomService.getStats();
      }
      
      console.log('� Stats received:', stats);
      console.log('👤 Central person:', stats?.centralPerson);
      setGedcomStats(stats);
      setCurrentPersonId(stats?.centralPerson?.id);
    } catch (err) {
      console.error('❌ Error fetching stats:', err);
      const apiError = handleApiError(err);
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPersonById = async (personId) => {
    try {
      const response = await fetch(`/api/gedcom/person/${personId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load person: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Error loading person by ID:', error);
      throw error;
    }
  };

  const handlePersonClick = async (personId) => {
    console.log('👤 Loading person:', personId);
    await loadGedcomStats(personId);
  };

  const handleLocationClick = (location, personName) => {
    console.log('🌍 Location clicked:', location, 'for person:', personName);
    setSelectedLocation(location);
    setSelectedPersonName(personName);
    setShowLocationPopup(true);
  };

  const openLocationLink = (type) => {
    const encodedLocation = encodeURIComponent(selectedLocation);
    const encodedPersonName = encodeURIComponent(selectedPersonName);
    let url;

    switch (type) {
      case 'wikipedia':
        url = `https://en.wikipedia.org/wiki/Special:Search/${encodedLocation}`;
        break;
      case 'maps':
        url = `https://www.google.com/maps/search/${encodedLocation}`;
        break;
      case 'search':
        url = `https://www.google.com/search?q=${encodedPersonName}+${encodedLocation}`;
        break;
      default:
        return;
    }

    window.open(url, '_blank');
    setShowLocationPopup(false);
  };

  const LocationLink = ({ location, personName, children }) => {
    if (!location) return children;
    
    return (
      <button 
        className="location-link" 
        onClick={() => handleLocationClick(location, personName)}
        title={`Click to explore ${location}`}
      >
        {children || location}
      </button>
    );
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
          <div className="navbar-nav ms-auto d-flex align-items-center">
            <span className="text-white me-3">
              <i className="bi bi-person-circle me-1"></i>
              {user?.givenNames} {user?.familyNames}
            </span>
            <button 
              className="btn btn-logout" 
              onClick={handleLogout}
              title="Logout"
            >
              <i className="bi bi-box-arrow-right me-1"></i>
              Logout
            </button>
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

            {/* Genealogical Person Display */}
            {gedcomStats?.centralPerson ? (
              <div className={`genealogy-person-card ${gedcomStats.centralPerson.sex === 'M' ? 'gender-male' : gedcomStats.centralPerson.sex === 'F' ? 'gender-female' : 'gender-unknown'}`}>
                <div className="person-header">
                  <div className="person-avatar">
                    <i className="bi bi-person-fill"></i>
                  </div>
                  <div className="person-main">
                    <div className="person-title-line">
                      <span className="person-name">
                        {gedcomStats.centralPerson.givenNames || 'UNK'} {gedcomStats.centralPerson.familyNames || 'UNK'}
                      </span>
                      {gedcomStats.centralPerson.sex && (
                        <span className="person-gender">({gedcomStats.centralPerson.sex})</span>
                      )}
                      <span className="person-id">#{gedcomStats.centralPerson.id}</span>
                    </div>
                    
                    <div className="person-events">
                      <div className="event-line">
                        <span className="event-label">Born:</span>
                        <span className="event-details">
                          {gedcomStats.centralPerson.birthDate || 'UNK'}
                          {gedcomStats.centralPerson.birthPlace && (
                            <span className="event-location">
                              , <LocationLink 
                                  location={gedcomStats.centralPerson.birthPlace} 
                                  personName={`${gedcomStats.centralPerson.givenNames} ${gedcomStats.centralPerson.familyNames}`}
                                >
                                  {gedcomStats.centralPerson.birthPlace}
                                </LocationLink>
                            </span>
                          )}
                        </span>
                      </div>
                      
                      {/* Parents Information */}
                      {gedcomStats.centralPerson.parents && (
                        <>
                          {gedcomStats.centralPerson.parents.father && (
                            <div className="event-line">
                              <span className="event-label">Father:</span>
                              <span className="event-details">
                                <button className="person-link" onClick={() => handlePersonClick(gedcomStats.centralPerson.parents.father.id)}>
                                  {gedcomStats.centralPerson.parents.father.givenNames} {gedcomStats.centralPerson.parents.father.familyNames}
                                </button>
                              </span>
                            </div>
                          )}
                          
                          {gedcomStats.centralPerson.parents.mother && (
                            <div className="event-line">
                              <span className="event-label">Mother:</span>
                              <span className="event-details">
                                <button className="person-link" onClick={() => handlePersonClick(gedcomStats.centralPerson.parents.mother.id)}>
                                  {gedcomStats.centralPerson.parents.mother.givenNames} {gedcomStats.centralPerson.parents.mother.familyNames}
                                </button>
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Marriage/Spouse Information */}
                      {gedcomStats.centralPerson.spouses && gedcomStats.centralPerson.spouses.length > 0 && (
                        gedcomStats.centralPerson.spouses.map((spouse, index) => (
                          <div key={spouse.id} className="event-line">
                            <span className="event-label">Married:</span>
                            <span className="event-details">
                              <button className="person-link" onClick={() => handlePersonClick(spouse.id)}>
                                {spouse.givenNames} {spouse.familyNames}
                              </button>
                              {spouse.marriageDate && (
                                <span className="marriage-date"> on {spouse.marriageDate}</span>
                              )}
                              {spouse.marriagePlace && (
                                <span className="event-location">
                                  {' in '}
                                  <LocationLink 
                                    location={spouse.marriagePlace} 
                                    personName={`${gedcomStats.centralPerson.givenNames} ${gedcomStats.centralPerson.familyNames}`}
                                  >
                                    {spouse.marriagePlace}
                                  </LocationLink>
                                </span>
                              )}
                            </span>
                          </div>
                        ))
                      )}

                      {/* Children Information */}
                      {gedcomStats.centralPerson.children && gedcomStats.centralPerson.children.length > 0 && (
                        gedcomStats.centralPerson.children.map((child, index) => (
                          <div key={child.id} className="event-line">
                            <span className="event-label">{child.relationshipLabel}:</span>
                            <span className="event-details">
                              <button className="person-link" onClick={() => handlePersonClick(child.id)}>
                                {child.givenNames} {child.familyNames}
                              </button>
                            </span>
                          </div>
                        ))
                      )}
                      
                      {gedcomStats.centralPerson.deathDate ? (
                        <div className="event-line">
                          <span className="event-label">Died:</span>
                          <span className="event-details">
                            {gedcomStats.centralPerson.deathDate}
                            {gedcomStats.centralPerson.deathPlace && (
                              <span className="event-location">
                                , <LocationLink 
                                    location={gedcomStats.centralPerson.deathPlace} 
                                    personName={`${gedcomStats.centralPerson.givenNames} ${gedcomStats.centralPerson.familyNames}`}
                                  >
                                    {gedcomStats.centralPerson.deathPlace}
                                  </LocationLink>
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="event-line">
                          <span className="event-label">Status:</span>
                          <span className="event-details living-status">(LIVING)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : gedcomStats && (
              <div 
                style={{
                  backgroundColor: '#f8d7da',
                  border: '2px solid #f5c6cb',
                  color: '#721c24',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  marginBottom: '1rem',
                  boxShadow: '0 0.25rem 0.5rem rgba(220, 53, 69, 0.15)'
                }}
                role="alert"
              >
                <div className="d-flex align-items-center">
                  <i 
                    className="bi bi-exclamation-triangle fa-2x me-3"
                    style={{ color: '#dc3545' }}
                  ></i>
                  <div>
                    <h5 
                      style={{ 
                        color: '#721c24', 
                        fontWeight: '600', 
                        marginBottom: '0.5rem',
                        fontSize: '1.2rem'
                      }}
                    >
                      No Central Person Found
                    </h5>
                    <p 
                      style={{ 
                        color: '#721c24', 
                        marginBottom: '0', 
                        lineHeight: '1.5' 
                      }}
                    >
                      No central person found in your GEDCOM file. This may occur if the file format is unusual or if no individuals were properly parsed from the genealogy data.
                    </p>
                  </div>
                </div>
              </div>
            )}

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

      {/* Location Popup Modal */}
      {showLocationPopup && (
        <div className="location-popup-overlay" onClick={() => setShowLocationPopup(false)}>
          <div className="location-popup" onClick={(e) => e.stopPropagation()}>
            <div className="location-popup-header">
              <h3>{selectedLocation}</h3>
              <button 
                className="location-popup-close" 
                onClick={() => setShowLocationPopup(false)}
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="location-popup-content">
              <p>Explore this location:</p>
              <div className="location-options">
                <button 
                  className="location-option-btn wikipedia-btn" 
                  onClick={() => openLocationLink('wikipedia')}
                >
                  <i className="bi bi-book"></i>
                  Wikipedia Page
                </button>
                <button 
                  className="location-option-btn maps-btn" 
                  onClick={() => openLocationLink('maps')}
                >
                  <i className="bi bi-geo-alt-fill"></i>
                  Google Maps
                </button>
                <button 
                  className="location-option-btn search-btn" 
                  onClick={() => openLocationLink('search')}
                >
                  <i className="bi bi-search"></i>
                  Google Search: {selectedPersonName}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenEntry;