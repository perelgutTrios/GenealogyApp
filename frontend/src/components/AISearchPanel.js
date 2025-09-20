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
   * Analyze a specific record match
   */
  const analyzeMatch = async (result) => {
    try {
      setSelectedResult(result);
      setShowAnalysis(true);

      console.log('🧠 Analyzing match for record:', result.id);

      const response = await aiResearchService.analyzeMatch(person.id, result.id, result);
      
      if (response.success) {
        setSelectedResult({
          ...result,
          detailedAnalysis: response.analysis
        });
        console.log('✅ Match analysis complete');
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
                onAttach={() => console.log('Attach record:', result.id)}
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
          onAttach={() => console.log('Attach analyzed record:', selectedResult.id)}
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
    <div className="analysis-modal-overlay" onClick={onClose}>
      <div className="analysis-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>AI Match Analysis</h4>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="comparison-section">
            <div className="row">
              <div className="col-md-6">
                <h6>Your Record</h6>
                <div className="person-summary">
                  <p><strong>{person.givenNames} {person.familyNames}</strong></p>
                  <p>Born: {person.birthDate || 'Unknown'}</p>
                  <p>Location: {person.birthPlace || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="col-md-6">
                <h6>Potential Match</h6>
                <div className="person-summary">
                  <p><strong>{result.name}</strong></p>
                  <p>Born: {result.birth || 'Unknown'}</p>
                  <p>Location: {result.location || 'Unknown'}</p>
                  <p>Source: {result.source}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Analysis */}
          {result.detailedAnalysis && (
            <div className="detailed-analysis">
              <h6>Analysis Results</h6>
              
              {result.detailedAnalysis.ai && (
                <div className="ai-analysis">
                  <strong>AI Analysis:</strong>
                  <p>Confidence: {Math.round(result.detailedAnalysis.ai.confidence * 100)}%</p>
                  <p>Reasoning: {result.detailedAnalysis.ai.reasoning}</p>
                  
                  {result.detailedAnalysis.ai.matchingFactors && (
                    <div className="factors">
                      <strong>Matching Factors:</strong>
                      <ul>
                        {result.detailedAnalysis.ai.matchingFactors.map((factor, idx) => (
                          <li key={idx}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="final-recommendation">
                <strong>Recommendation:</strong>
                <div className={`recommendation-badge ${result.detailedAnalysis.finalRecommendation?.action}`}>
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