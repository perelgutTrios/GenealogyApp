import React, { useState } from 'react';
import { aiResearchService } from '../services/api';

const AISearchPanel = ({ person, onResultsFound }) => {
  const [isGeneratingQueries, setIsGeneratingQueries] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQueries, setSearchQueries] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  /**
   * Generate AI-powered search queries for the person
   */
  const generateSearchQueries = async () => {
    try {
      setIsGeneratingQueries(true);
      setError('');

      console.log('🤖 Generating AI search queries for:', person.givenNames, person.familyNames);

      const response = await aiResearchService.generateQueries(person.id);
      
      if (response.success) {
        setSearchQueries(response.searchQueries);
        console.log('✅ Search queries generated:', response.searchQueries);
      } else {
        throw new Error(response.message || 'Failed to generate search queries');
      }

    } catch (err) {
      console.error('❌ Error generating search queries:', err);
      setError(err.message || 'Failed to generate search queries');
    } finally {
      setIsGeneratingQueries(false);
    }
  };

  /**
   * Search external sources using the generated queries
   */
  const searchExternalSources = async () => {
    if (!searchQueries) {
      await generateSearchQueries();
      return;
    }

    try {
      setIsSearching(true);
      setError('');

      console.log('🔍 Searching external sources...');

      const response = await aiResearchService.searchExternal(person.id, searchQueries);
      
      if (response.success) {
        setSearchResults(response.scoredResults);
        console.log('✅ External search complete:', response.scoredResults.length, 'results');
        
        if (onResultsFound) {
          onResultsFound(response.scoredResults);
        }
      } else {
        throw new Error(response.message || 'Failed to search external sources');
      }

    } catch (err) {
      console.error('❌ Error searching external sources:', err);
      setError(err.message || 'Failed to search external sources');
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Attach a record to the person's profile
   */
  const attachRecord = async (result) => {
    try {
      console.log('📎 Attaching record:', result.id, 'to person:', person.id);
      
      // For now, just show success message - this would integrate with your GEDCOM updating system
      alert(`Record "${result.name}" has been attached to ${person.givenNames} ${person.familyNames}`);
      
      // TODO: Implement actual record attachment to GEDCOM database
      // This would typically:
      // 1. Create a new source citation in the GEDCOM
      // 2. Link it to the person's record
      // 3. Update the encrypted GEDCOM data in the database
      
    } catch (err) {
      console.error('❌ Error attaching record:', err);
      setError('Failed to attach record: ' + err.message);
    }
  };

  /**
   * Analyze a specific record match
   */
  const analyzeMatch = async (result) => {
    try {
      setSelectedResult(result);
      setShowAnalysis(true);

      console.log('🧠 Analyzing match for record:', result.id);

      const response = await aiResearchService.analyzeMatch(person.id, result.id, result);
      
      // Debug: log the actual response structure
      console.log('🔍 Analysis Response:', response);
      console.log('🔍 Analysis Data:', response.analysis);
      
      if (response.success) {
        const updatedResult = {
          ...result,
          detailedAnalysis: response.analysis
        };
        setSelectedResult(updatedResult);
        console.log('✅ Match analysis complete:', updatedResult.detailedAnalysis);
      } else {
        throw new Error(response.message || 'Failed to analyze match');
      }

    } catch (err) {
      console.error('❌ Error analyzing match:', err);
      setError(err.message || 'Failed to analyze record match');
    }
  };

  return (
    <div className="ai-search-panel">
      <div className="ai-panel-header">
        <h3>
          <i className="bi bi-robot"></i>
          AI Research Assistant
        </h3>
        <p className="text-muted">
          Use AI to find additional records and information about {person.givenNames} {person.familyNames}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {/* Search Actions */}
      <div className="ai-actions">
        {!searchQueries ? (
          <button 
            className="btn btn-primary ai-action-btn"
            onClick={generateSearchQueries}
            disabled={isGeneratingQueries}
          >
            {isGeneratingQueries ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Generating Search Strategies...
              </>
            ) : (
              <>
                <i className="bi bi-lightbulb me-2"></i>
                Generate AI Search Queries
              </>
            )}
          </button>
        ) : (
          <button 
            className="btn btn-success ai-action-btn"
            onClick={searchExternalSources}
            disabled={isSearching}
          >
            {isSearching ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Searching External Sources...
              </>
            ) : (
              <>
                <i className="bi bi-search me-2"></i>
                Search External Records
              </>
            )}
          </button>
        )}
      </div>

      {/* Search Query Preview */}
      {searchQueries && !isSearching && searchResults.length === 0 && (
        <div className="search-queries-preview">
          <h5>Generated Search Strategies</h5>
          <div className="query-categories">
            
            {searchQueries.nameVariations && (
              <div className="query-category">
                <h6><i className="bi bi-person"></i> Name Variations ({searchQueries.nameVariations.length})</h6>
                <div className="query-tags">
                  {searchQueries.nameVariations.slice(0, 5).map((name, index) => (
                    <span key={index} className="badge bg-primary me-1 mb-1">{name}</span>
                  ))}
                  {searchQueries.nameVariations.length > 5 && (
                    <span className="badge bg-secondary">+{searchQueries.nameVariations.length - 5} more</span>
                  )}
                </div>
              </div>
            )}

            {searchQueries.locationVariations && (
              <div className="query-category">
                <h6><i className="bi bi-geo-alt"></i> Location Variations ({searchQueries.locationVariations.length})</h6>
                <div className="query-tags">
                  {searchQueries.locationVariations.slice(0, 3).map((location, index) => (
                    <span key={index} className="badge bg-success me-1 mb-1">{location}</span>
                  ))}
                </div>
              </div>
            )}

            {searchQueries.recordTypeTargets && (
              <div className="query-category">
                <h6><i className="bi bi-archive"></i> Target Record Types ({searchQueries.recordTypeTargets.length})</h6>
                <div className="query-tags">
                  {searchQueries.recordTypeTargets.slice(0, 4).map((type, index) => (
                    <span key={index} className="badge bg-info me-1 mb-1">{type}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="search-results">
          <h5>
            <i className="bi bi-collection"></i>
            Found {searchResults.length} Potential Records
          </h5>
          
          <div className="results-list">
            {searchResults.map((result, index) => (
              <SearchResultCard 
                key={result.id} 
                result={result} 
                index={index}
                onAnalyze={() => analyzeMatch(result)}
                onAttach={() => attachRecord(result)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {showAnalysis && selectedResult && (
        <AnalysisModal 
          result={selectedResult}
          person={person}
          onClose={() => setShowAnalysis(false)}
          onAttach={() => attachRecord(selectedResult)}
        />
      )}
    </div>
  );
};

/**
 * Individual search result card component
 */
const SearchResultCard = ({ result, index, onAnalyze, onAttach }) => {
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'danger';
  };

  return (
    <div className={`search-result-card confidence-${getConfidenceColor(result.confidence)}`}>
      <div className="result-header">
        <div className="result-title">
          <h6>{result.name}</h6>
          <small className="text-muted">{result.source}</small>
        </div>
        <div className="confidence-badge">
          <span className={`badge bg-${getConfidenceColor(result.confidence)}`}>
            {Math.round(result.confidence * 100)}%
          </span>
        </div>
      </div>

      <div className="result-details">
        {result.birth && (
          <div className="detail-item">
            <i className="bi bi-calendar"></i>
            <span>Born: {result.birth}</span>
          </div>
        )}
        
        {result.location && (
          <div className="detail-item">
            <i className="bi bi-geo-alt"></i>
            <span>Location: {result.location}</span>
          </div>
        )}
        
        {result.additionalInfo && (
          <div className="detail-item">
            <i className="bi bi-info-circle"></i>
            <span>{result.additionalInfo}</span>
          </div>
        )}
      </div>

      {/* Matching Factors */}
      {result.confidenceAnalysis?.matchingFactors && result.confidenceAnalysis.matchingFactors.length > 0 && (
        <div className="matching-factors">
          <small className="text-muted">Matches: </small>
          {result.confidenceAnalysis.matchingFactors.map((factor, idx) => (
            <span key={idx} className="badge bg-secondary me-1">{factor}</span>
          ))}
        </div>
      )}

      <div className="result-actions">
        <button 
          className="btn btn-sm btn-outline-primary"
          onClick={onAnalyze}
        >
          <i className="bi bi-search"></i>
          Analyze Match
        </button>
        
        <button 
          className={`btn btn-sm btn-outline-${getConfidenceColor(result.confidence)}`}
          onClick={onAttach}
          disabled={result.confidence < 0.6}
        >
          <i className="bi bi-link-45deg"></i>
          {result.confidence >= 0.8 ? 'Auto-Attach' : 'Review & Attach'}
        </button>

        {result.url && (
          <a 
            href={result.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline-info"
          >
            <i className="bi bi-box-arrow-up-right"></i>
            View Source
          </a>
        )}
      </div>
    </div>
  );
};

/**
 * Analysis modal for detailed record examination
 */
const AnalysisModal = ({ result, person, onClose, onAttach }) => {
  return (
    <div className="analysis-modal-overlay" onClick={onClose} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050}}>
      <div 
        className="analysis-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          margin: '20px'
        }}
      >
        <div className="modal-header">
          <h4>AI Match Analysis</h4>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="comparison-section" style={{marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
            <div className="row">
              <div className="col-md-6">
                <h6 style={{color: '#495057', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', borderBottom: '2px solid #6c757d', paddingBottom: '5px'}}>👤 Your Record</h6>
                <div className="person-summary" style={{padding: '10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e9ecef'}}>
                  <p style={{marginBottom: '6px', color: '#333', fontSize: '14px'}}><strong style={{color: '#333'}}>{person.givenNames} {person.familyNames}</strong></p>
                  <p style={{marginBottom: '6px', color: '#333', fontSize: '14px'}}>Born: {person.birthDate || 'Unknown'}</p>
                  <p style={{marginBottom: '0', color: '#333', fontSize: '14px'}}>Location: {person.birthPlace || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="col-md-6">
                <h6 style={{color: '#495057', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', borderBottom: '2px solid #6c757d', paddingBottom: '5px'}}>🔍 Potential Match</h6>
                <div className="person-summary" style={{padding: '10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e9ecef'}}>
                  <p style={{marginBottom: '6px', color: '#333', fontSize: '14px'}}><strong style={{color: '#333'}}>{result.name}</strong></p>
                  <p style={{marginBottom: '6px', color: '#333', fontSize: '14px'}}>Born: {result.birth || 'Unknown'}</p>
                  <p style={{marginBottom: '6px', color: '#333', fontSize: '14px'}}>Location: {result.location || 'Unknown'}</p>
                  <p style={{marginBottom: '0', color: '#333', fontSize: '14px'}}>Source: {result.source}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Analysis */}
          {result.detailedAnalysis && (
            <div className="detailed-analysis">
              <h6>Analysis Results</h6>
              
              {result.detailedAnalysis.ai && (
                <div className="ai-analysis" style={{marginBottom: '15px', padding: '10px', border: '1px solid #007bff', borderRadius: '5px', backgroundColor: '#f8f9ff'}}>
                  <h6 style={{color: '#007bff', marginBottom: '10px', fontSize: '16px'}}>🤖 AI Analysis:</h6>
                  
                  <div style={{marginBottom: '15px'}}>
                    <div style={{marginBottom: '10px', padding: '8px', backgroundColor: '#f0f8ff', borderRadius: '4px'}}>
                      <p style={{marginBottom: '5px', fontSize: '16px', color: '#333'}}>
                        <strong style={{color: '#333'}}>Confidence:</strong> <span style={{color: '#007bff', fontWeight: 'bold', fontSize: '18px'}}>{Math.round(result.detailedAnalysis.ai.confidence * 100)}%</span>
                      </p>
                      <p style={{marginBottom: '5px', fontSize: '14px', color: '#333'}}>
                        <strong style={{color: '#333'}}>Method:</strong> {result.detailedAnalysis.ai.method === 'fallback' ? '🔄 Rule-based Analysis (OpenAI unavailable)' : '🤖 AI-Powered Analysis'}
                      </p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <p style={{marginBottom: '10px', fontSize: '14px', lineHeight: '1.5', color: '#333'}}>
                        <strong style={{color: '#333'}}>Analysis Details:</strong><br/>
                        {result.detailedAnalysis.ai.reasoning}
                      </p>
                    </div>
                  </div>
                  
                  {result.detailedAnalysis.ai.matchingFactors && result.detailedAnalysis.ai.matchingFactors.length > 0 && (
                    <div className="factors" style={{marginTop: '10px'}}>
                      <strong style={{color: '#333'}}>Matching Factors:</strong>
                      <ul style={{marginTop: '5px', paddingLeft: '20px'}}>
                        {result.detailedAnalysis.ai.matchingFactors.map((factor, idx) => (
                          <li key={idx} style={{marginBottom: '3px', color: '#333'}}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.detailedAnalysis.ai.concerns && result.detailedAnalysis.ai.concerns.length > 0 && (
                    <div className="concerns" style={{marginTop: '10px'}}>
                      <strong style={{color: '#dc3545'}}>Concerns:</strong>
                      <ul style={{marginTop: '5px', paddingLeft: '20px'}}>
                        {result.detailedAnalysis.ai.concerns.map((concern, idx) => (
                          <li key={idx} style={{marginBottom: '3px', color: '#dc3545'}}>{concern}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Confidence Analysis */}
              {result.detailedAnalysis.confidence && (
                <div className="confidence-analysis" style={{marginBottom: '15px', padding: '10px', border: '1px solid #28a745', borderRadius: '5px', backgroundColor: '#f8fff8'}}>
                  <h6 style={{color: '#28a745', marginBottom: '10px', fontSize: '16px'}}>📊 Confidence Analysis:</h6>
                  <p style={{marginBottom: '5px', color: '#333', fontWeight: 'bold'}}>Overall Confidence: {Math.round(result.detailedAnalysis.confidence.overallConfidence * 100)}%</p>
                  
                  {result.detailedAnalysis.confidence.analysis && (
                    <div style={{marginTop: '10px'}}>
                      <strong style={{color: '#333'}}>Detailed Breakdown:</strong>
                      <div style={{marginTop: '8px'}}>
                        {result.detailedAnalysis.confidence.analysis.map((item, idx) => (
                          <div key={idx} style={{
                            marginBottom: '6px', 
                            fontSize: '14px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: '#333',
                            fontWeight: '500',
                            backgroundColor: item.includes('✅') ? '#d4edda' : 
                                           item.includes('❌') ? '#f8d7da' : '#fff3cd'
                          }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Final Recommendation */}
              <div className="final-recommendation" style={{marginTop: '15px', padding: '10px', borderRadius: '5px', backgroundColor: '#fff9e6', border: '1px solid #ffc107'}}>
                <h6 style={{color: '#856404', marginBottom: '10px', fontSize: '16px'}}>🎯 Final Recommendation:</h6>
                <div 
                  className={`recommendation-badge ${result.detailedAnalysis.finalRecommendation?.action}`}
                  style={{
                    marginTop: '5px',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    backgroundColor: result.detailedAnalysis.finalRecommendation?.action === 'accept' ? '#d4edda' : 
                                   result.detailedAnalysis.finalRecommendation?.action === 'review' ? '#fff3cd' : '#f8d7da',
                    color: result.detailedAnalysis.finalRecommendation?.action === 'accept' ? '#155724' : 
                           result.detailedAnalysis.finalRecommendation?.action === 'review' ? '#856404' : '#721c24',
                    border: '1px solid ' + (result.detailedAnalysis.finalRecommendation?.action === 'accept' ? '#c3e6cb' : 
                                           result.detailedAnalysis.finalRecommendation?.action === 'review' ? '#ffeaa7' : '#f5c6cb')
                  }}
                >
                  {result.detailedAnalysis.finalRecommendation?.action?.toUpperCase()}: {result.detailedAnalysis.finalRecommendation?.reasoning}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button 
            className="btn btn-success" 
            onClick={onAttach}
            disabled={result.detailedAnalysis?.finalRecommendation?.action === 'reject'}
          >
            <i className="bi bi-link-45deg"></i>
            Attach Record
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISearchPanel;