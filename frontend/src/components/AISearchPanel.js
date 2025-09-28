import React, { useEffect, useState } from 'react';
import { aiResearchService } from '../services/api';

const AISearchPanel = ({ person, onResultsFound }) => {
  const [isGeneratingQueries, setIsGeneratingQueries] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQueries, setSearchQueries] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchSummary, setSearchSummary] = useState(null); // { text, type }
  const [hasSearchedOnce, setHasSearchedOnce] = useState(false);
  const [error, setError] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchTextError, setSearchTextError] = useState('');
  const [searchBaseline, setSearchBaseline] = useState('');
  // Breadth controls (synced with JSON in the modal)
  const [breadthOptions, setBreadthOptions] = useState({
    maxNameVariations: 12,
    maxLocationVariations: 3,
    maxRequests: 30,
    delayMs: 300,
  });
  const [sourceOptions, setSourceOptions] = useState({
    familySearch: true,
    chroniclingAmerica: true,
    wikitree: true,
    findAGrave: false,
    newspapers: false,
    enableMocks: false,
  });
  const [timeRangesText, setTimeRangesText] = useState(''); // comma or newline separated ranges like 1890-1900
  const [parsedSearchObj, setParsedSearchObj] = useState(null);
  const storageKey = (id) => `aiSearchQueries:${id}`;

  // Load persisted search for this person on mount/person change
  useEffect(() => {
    try {
      if (!person?.id) return;
      // reset per-person search UI state
      setSearchResults([]);
      setSearchSummary(null);
      setHasSearchedOnce(false);
      setError('');
      const raw = localStorage.getItem(storageKey(person.id));
      if (!raw) {
        // Clear local state for new person
        setSearchQueries(null);
        setSearchBaseline('');
        return;
      }
      const saved = JSON.parse(raw);
      // saved = { baseline: object|null, edited: object|null }
      const baselineObj = saved?.baseline || null;
      const editedObj = saved?.edited || null;
      const effective = editedObj || baselineObj || null;
      setSearchQueries(effective);
      setSearchBaseline(baselineObj ? JSON.stringify(baselineObj, null, 2) : '');
    } catch (e) {
      console.warn('Failed to load persisted search:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id]);

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
        // Persist baseline (freshly generated) and clear edited
        try {
          if (person?.id) {
            localStorage.setItem(
              storageKey(person.id),
              JSON.stringify({ baseline: response.searchQueries, edited: null })
            );
          }
        } catch {}
        console.log('✅ Search queries generated:', response.searchQueries);
        return response.searchQueries;
      } else {
        throw new Error(response.message || 'Failed to generate search queries');
      }

    } catch (err) {
      console.error('❌ Error generating search queries:', err);
      setError(err.message || 'Failed to generate search queries');
      return null;
    } finally {
      setIsGeneratingQueries(false);
    }
  };

  /**
   * Search external sources using provided or existing queries
   */
  const searchExternalSources = async (queriesOverride = null) => {
    const queries = queriesOverride || searchQueries;
    if (!queries) {
      const generated = await generateSearchQueries();
      if (!generated) return; // failed to generate
      // Open the editor after generation instead of auto-searching
      openSearchEditor(generated);
      return;
    }

    try {
      setIsSearching(true);
      setError('');

      console.log('🔍 Searching external sources...');

      const response = await aiResearchService.searchExternal(person.id, queries);
      
      if (response.success) {
        setSearchResults(response.scoredResults);
        setHasSearchedOnce(true);

        // Build a concise summary line always visible, even for 0 results
        const summary = `External search: ${response.scoredResults.length} results` +
          (response.rejectedCount > 0 ? ` (${response.rejectedCount} rejected filtered out of ${response.totalResults})` : '');
        setSearchSummary({ text: summary, type: response.scoredResults.length > 0 ? 'success' : 'warning' });

        // Optional toast-like alert only when filtering happens
        if (response.rejectedCount > 0) {
          setTimeout(() => {
            alert(`Found ${response.totalResults} total records. ${response.rejectedCount} previously rejected records were filtered out, showing ${response.scoredResults.length} new results.`);
          }, 500);
        }

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
   * Open editable search modal with current or generated queries
   */
  const openSearchEditor = async (prefill = null) => {
    try {
      setSearchTextError('');
      let queries = prefill || searchQueries;
      if (!queries) {
        const generated = await generateSearchQueries();
        if (!generated) return;
        queries = generated;
      }
      const json = JSON.stringify(queries, null, 2);
      setSearchText(json);
      // Only set baseline if we explicitly passed freshly generated queries or no baseline exists
      if (prefill || !searchBaseline) {
        setSearchBaseline(json);
      }
      // Sync controls from object
      setParsedSearchObj(queries);
      const opts = queries?.options || {};
      setBreadthOptions({
        maxNameVariations: Number.isFinite(opts.maxNameVariations) ? opts.maxNameVariations : 12,
        maxLocationVariations: Number.isFinite(opts.maxLocationVariations) ? opts.maxLocationVariations : 3,
        maxRequests: Number.isFinite(opts.maxRequests) ? opts.maxRequests : 30,
        delayMs: Number.isFinite(opts.delayMs) ? opts.delayMs : 300,
      });
      const srcs = opts.sources || {};
      setSourceOptions({
        familySearch: srcs.familySearch !== false,
        chroniclingAmerica: srcs.chroniclingAmerica !== false,
        wikitree: srcs.wikitree !== false,
        findAGrave: !!srcs.findAGrave,
        newspapers: !!srcs.newspapers,
        enableMocks: opts.enableMocks === true,
      });
      const tr = Array.isArray(queries?.timeRangeQueries) ? queries.timeRangeQueries : [];
      setTimeRangesText(tr.join(', '));
      setShowSearchModal(true);
    } catch (e) {
      setError('Failed to prepare search editor: ' + (e.message || e));
    }
  };

  /**
   * Confirm and run search with edited JSON
   */
  const confirmAndSearch = async () => {
    try {
      setSearchTextError('');
      let parsed;
      try {
        parsed = JSON.parse(searchText);
      } catch (e) {
        setSearchTextError('Invalid JSON. Please fix formatting or CANCEL.');
        return;
      }
      // keep parsed cache in sync
      setParsedSearchObj(parsed);
      setShowSearchModal(false);
      setSearchQueries(parsed);
      // Persist edited search
      try {
        if (person?.id) {
          const baselineObj = searchBaseline ? JSON.parse(searchBaseline) : null;
          localStorage.setItem(
            storageKey(person.id),
            JSON.stringify({ baseline: baselineObj, edited: parsed })
          );
        }
      } catch {}
      await searchExternalSources(parsed);
    } catch (e) {
      setError('Search failed: ' + (e.message || e));
    }
  };

  // Helper: update JSON text from control states (if JSON can be parsed)
  const updateSearchTextFromControls = () => {
    let baseObj = parsedSearchObj;
    try {
      baseObj = JSON.parse(searchText);
    } catch {
      // if current JSON is invalid, fallback to last parsed object
    }
    if (!baseObj || typeof baseObj !== 'object') return;
    const next = { ...baseObj };
    next.options = { ...next.options, ...breadthOptions };
  next.options.sources = { ...next.options?.sources, ...sourceOptions };
    next.options.enableMocks = !!sourceOptions.enableMocks;
    const ranges = timeRangesText
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (ranges.length > 0) {
      next.timeRangeQueries = ranges;
    } else {
      delete next.timeRangeQueries;
    }
    const pretty = JSON.stringify(next, null, 2);
    setSearchText(pretty);
    setParsedSearchObj(next);
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
   * Reject a record match and remember the rejection
   */
  const rejectMatch = async (result, reason = null) => {
    try {
      console.log('❌ Rejecting record:', result.id, 'for person:', person.id);
      
      // Prompt for rejection reason
      const userReason = reason || prompt('Why are you rejecting this match? (Optional)', 
        'Age impossible / Wrong person / Poor quality / Other');
      
      await aiResearchService.rejectMatch(person.id, result.id, userReason);
      
      // Remove from current results
      setSearchResults(prev => prev.filter(r => r.id !== result.id));
      
      // Close analysis modal if it's open for this record
      if (selectedResult && selectedResult.id === result.id) {
        setShowAnalysis(false);
        setSelectedResult(null);
      }
      
      alert(`Record "${result.name}" has been rejected and will not be shown again.`);
      
    } catch (err) {
      console.error('❌ Error rejecting record:', err);
      setError('Failed to reject record: ' + err.message);
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
            onClick={() => openSearchEditor()}
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
            onClick={() => openSearchEditor()}
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

      {/* Search Query Preview (only before first search) */}
      {searchQueries && !isSearching && !hasSearchedOnce && (
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

      {/* Search Summary */}
      {hasSearchedOnce && searchSummary && (
        <div className={`alert alert-${searchSummary.type}`}>
          <i className="bi bi-info-circle me-1"></i>
          {searchSummary.text}
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
                onReject={(result) => rejectMatch(result)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Explicit 0-results feedback */}
      {hasSearchedOnce && !isSearching && searchResults.length === 0 && (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-1"></i>
          0 records found. Try widening time ranges, enabling additional sources (e.g., WikiTree, Chronicling America), or increasing name/location variations.
        </div>
      )}

      {/* Analysis Modal */}
      {showAnalysis && selectedResult && (
        <AnalysisModal 
          result={selectedResult}
          person={person}
          onClose={() => setShowAnalysis(false)}
          onAttach={() => attachRecord(selectedResult)}
          onReject={(result, reason) => rejectMatch(result, reason)}
        />
      )}

      {/* Search Edit Modal */}
      {showSearchModal && (
        <div 
          className="search-modal-overlay"
          onClick={() => setShowSearchModal(false)}
          style={{position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050}}
        >
          <div 
            className="search-modal"
            onClick={(e) => e.stopPropagation()}
            style={{backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', width: '90%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column'}}
          >
            <div className="modal-header" style={{padding: '10px 16px', borderBottom: '1px solid #e9ecef'}}>
              <h5 className="modal-title" style={{margin: 0}}>Edit Search Query</h5>
              <button className="btn-close" onClick={() => setShowSearchModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{padding: 16, overflow: 'auto', color: '#212529'}}>
              <p className="text-muted" style={{marginTop: 0}}>You can fine‑tune the AI‑generated search JSON before running the search.</p>
              {/* Source Selection */}
              <div className="source-controls" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, padding: 12, border: '1px solid #e9ecef', borderRadius: 6, background: '#ffffff', color: '#212529'}}>
                <div style={{gridColumn: '1 / -1', fontWeight: '600', fontSize: 13}}>Sources</div>
                <label className="form-check" style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <input className="form-check-input" type="checkbox" checked={sourceOptions.familySearch}
                    onChange={(e) => { setSourceOptions(o => ({...o, familySearch: e.target.checked})); setTimeout(updateSearchTextFromControls, 0); }} />
                  <span>FamilySearch</span>
                </label>
                <label className="form-check" style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <input className="form-check-input" type="checkbox" checked={sourceOptions.chroniclingAmerica}
                    onChange={(e) => { setSourceOptions(o => ({...o, chroniclingAmerica: e.target.checked})); setTimeout(updateSearchTextFromControls, 0); }} />
                  <span>Chronicling America (LOC)</span>
                </label>
                <label className="form-check" style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <input className="form-check-input" type="checkbox" checked={sourceOptions.wikitree}
                    onChange={(e) => { setSourceOptions(o => ({...o, wikitree: e.target.checked})); setTimeout(updateSearchTextFromControls, 0); }} />
                  <span>WikiTree</span>
                </label>
                <label className="form-check" style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <input className="form-check-input" type="checkbox" checked={sourceOptions.findAGrave}
                    onChange={(e) => { setSourceOptions(o => ({...o, findAGrave: e.target.checked})); setTimeout(updateSearchTextFromControls, 0); }} />
                  <span>FindAGrave (mock)</span>
                </label>
                <label className="form-check" style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <input className="form-check-input" type="checkbox" checked={sourceOptions.newspapers}
                    onChange={(e) => { setSourceOptions(o => ({...o, newspapers: e.target.checked})); setTimeout(updateSearchTextFromControls, 0); }} />
                  <span>Newspaper Archives (mock)</span>
                </label>
                <label className="form-check" style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <input className="form-check-input" type="checkbox" checked={sourceOptions.enableMocks}
                    onChange={(e) => { setSourceOptions(o => ({...o, enableMocks: e.target.checked})); setTimeout(updateSearchTextFromControls, 0); }} />
                  <span>Enable all mock sources by default</span>
                </label>
              </div>
              {/* Breadth Controls */}
              <div className="breadth-controls" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, padding: 12, border: '1px solid #e9ecef', borderRadius: 6, background: '#f8f9fa'}}>
                <div>
                  <label className="form-label" style={{fontSize: 12}}>Max Name Variations</label>
                  <input type="number" min={1} max={100} className="form-control"
                    value={breadthOptions.maxNameVariations}
                    onChange={(e) => { setBreadthOptions(o => ({...o, maxNameVariations: Math.max(1, Math.min(100, Number(e.target.value)||0))})); setTimeout(updateSearchTextFromControls, 0); }} />
                </div>
                <div>
                  <label className="form-label" style={{fontSize: 12}}>Max Location Variations</label>
                  <input type="number" min={1} max={10} className="form-control"
                    value={breadthOptions.maxLocationVariations}
                    onChange={(e) => { setBreadthOptions(o => ({...o, maxLocationVariations: Math.max(1, Math.min(10, Number(e.target.value)||0))})); setTimeout(updateSearchTextFromControls, 0); }} />
                </div>
                <div>
                  <label className="form-label" style={{fontSize: 12}}>Max Requests Cap</label>
                  <input type="number" min={1} max={200} className="form-control"
                    value={breadthOptions.maxRequests}
                    onChange={(e) => { setBreadthOptions(o => ({...o, maxRequests: Math.max(1, Math.min(200, Number(e.target.value)||0))})); setTimeout(updateSearchTextFromControls, 0); }} />
                </div>
                <div>
                  <label className="form-label" style={{fontSize: 12}}>Delay Between Requests (ms)</label>
                  <input type="number" min={0} max={5000} className="form-control"
                    value={breadthOptions.delayMs}
                    onChange={(e) => { setBreadthOptions(o => ({...o, delayMs: Math.max(0, Math.min(5000, Number(e.target.value)||0))})); setTimeout(updateSearchTextFromControls, 0); }} />
                </div>
                <div style={{gridColumn: '1 / -1'}}>
                  <label className="form-label" style={{fontSize: 12}}>Time Ranges (comma or newline separated, e.g., 1890-1900, 1900-1910)</label>
                  <textarea className="form-control" rows={2}
                    value={timeRangesText}
                    onChange={(e) => { setTimeRangesText(e.target.value); setTimeout(updateSearchTextFromControls, 0); }} />
                </div>
              </div>
              <textarea 
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{width: '100%', height: '50vh', fontFamily: 'monospace', fontSize: 13, padding: 10, borderRadius: 6, border: '1px solid #ced4da'}}
              />
              {searchTextError && (
                <div className="alert alert-warning" style={{marginTop: 10}}>
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  {searchTextError}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{padding: '10px 16px', borderTop: '1px solid #e9ecef', display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
              <button 
                className="btn btn-outline-secondary" 
                onClick={() => { 
                  setSearchText(searchBaseline || ''); 
                  setSearchTextError(''); 
                  try {
                    const obj = searchBaseline ? JSON.parse(searchBaseline) : null;
                    if (obj) {
                      setParsedSearchObj(obj);
                      const opts = obj?.options || {};
                      setBreadthOptions({
                        maxNameVariations: Number.isFinite(opts.maxNameVariations) ? opts.maxNameVariations : 12,
                        maxLocationVariations: Number.isFinite(opts.maxLocationVariations) ? opts.maxLocationVariations : 3,
                        maxRequests: Number.isFinite(opts.maxRequests) ? opts.maxRequests : 30,
                        delayMs: Number.isFinite(opts.delayMs) ? opts.delayMs : 300,
                      });
                      const srcs = opts.sources || {};
                      setSourceOptions({
                        familySearch: srcs.familySearch !== false,
                        findAGrave: !!srcs.findAGrave,
                        newspapers: !!srcs.newspapers,
                        enableMocks: opts.enableMocks === true,
                      });
                      const tr = Array.isArray(obj?.timeRangeQueries) ? obj.timeRangeQueries : [];
                      setTimeRangesText(tr.join(', '));
                    }
                  } catch {}
                }}
                disabled={!searchBaseline || searchText === searchBaseline}
                style={{ marginRight: 'auto' }}
              >
                Reset to Generated
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSearchModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmAndSearch} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Individual search result card component
 */
const SearchResultCard = ({ result, index, onAnalyze, onAttach, onReject }) => {
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
        
        <button 
          className="btn btn-sm btn-outline-danger"
          onClick={() => onReject(result)}
          title="Reject this match permanently"
        >
          <i className="bi bi-x-circle"></i>
          Reject
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
const AnalysisModal = ({ result, person, onClose, onAttach, onReject }) => {
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
                        <strong style={{color: '#333'}}>Method:</strong> {
                          result.detailedAnalysis.ai.method === 'enhanced_fallback' ? '🧬 Enhanced Analysis (with validation)' :
                          result.detailedAnalysis.ai.method === 'fallback' ? '🔄 Rule-based Analysis (OpenAI unavailable)' : 
                          '🤖 AI-Powered Analysis'
                        }
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

              {/* Data Validation Analysis */}
              {result.detailedAnalysis.ai && result.detailedAnalysis.ai.validation && (
                <div className="validation-analysis" style={{marginBottom: '15px', padding: '10px', border: '1px solid #17a2b8', borderRadius: '5px', backgroundColor: '#f0fbff'}}>
                  <h6 style={{color: '#17a2b8', marginBottom: '10px', fontSize: '16px'}}>🧬 Data Validation:</h6>
                  
                  <div style={{display: 'flex', gap: '15px', marginBottom: '10px'}}>
                    <div style={{flex: 1, padding: '8px', backgroundColor: '#e6f7ff', borderRadius: '4px', textAlign: 'center'}}>
                      <div style={{fontSize: '14px', color: '#666', marginBottom: '3px'}}>Person Validation</div>
                      <div style={{fontSize: '18px', fontWeight: 'bold', color: result.detailedAnalysis.ai.validation.personValidation.score >= 0.8 ? '#28a745' : result.detailedAnalysis.ai.validation.personValidation.score >= 0.6 ? '#ffc107' : '#dc3545'}}>
                        {Math.round(result.detailedAnalysis.ai.validation.personValidation.score * 100)}%
                      </div>
                    </div>
                    <div style={{flex: 1, padding: '8px', backgroundColor: '#e6f7ff', borderRadius: '4px', textAlign: 'center'}}>
                      <div style={{fontSize: '14px', color: '#666', marginBottom: '3px'}}>Match Validation</div>
                      <div style={{fontSize: '18px', fontWeight: 'bold', color: result.detailedAnalysis.ai.validation.matchValidation.score >= 0.8 ? '#28a745' : result.detailedAnalysis.ai.validation.matchValidation.score >= 0.6 ? '#ffc107' : '#dc3545'}}>
                        {Math.round(result.detailedAnalysis.ai.validation.matchValidation.score * 100)}%
                      </div>
                    </div>
                  </div>
                  
                  {(result.detailedAnalysis.ai.validation.personValidation.issues > 0 || result.detailedAnalysis.ai.validation.matchValidation.issues > 0) && (
                    <div style={{marginTop: '10px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107'}}>
                      <strong style={{color: '#856404', fontSize: '14px'}}>⚠️ Validation Issues Detected:</strong>
                      <div style={{marginTop: '5px', fontSize: '13px', color: '#856404'}}>
                        Person record: {result.detailedAnalysis.ai.validation.personValidation.issues} issues, {result.detailedAnalysis.ai.validation.personValidation.warnings} warnings
                        <br/>
                        Match record: {result.detailedAnalysis.ai.validation.matchValidation.issues} issues, {result.detailedAnalysis.ai.validation.matchValidation.warnings} warnings
                      </div>
                    </div>
                  )}
                  
                  {result.detailedAnalysis.ai.validation.personValidation.quality && (
                    <div style={{marginTop: '10px'}}>
                      <strong style={{color: '#333', fontSize: '14px'}}>📊 Data Quality Assessment:</strong>
                      <div style={{marginTop: '5px', display: 'flex', gap: '10px'}}>
                        <div style={{flex: 1, fontSize: '13px'}}>
                          <span style={{color: '#666'}}>Person Quality: </span>
                          <span style={{color: result.detailedAnalysis.ai.validation.personValidation.quality.score >= 0.7 ? '#28a745' : result.detailedAnalysis.ai.validation.personValidation.quality.score >= 0.4 ? '#ffc107' : '#dc3545', fontWeight: 'bold'}}>
                            {Math.round((result.detailedAnalysis.ai.validation.personValidation.quality.score || 0) * 100)}%
                          </span>
                        </div>
                        <div style={{flex: 1, fontSize: '13px'}}>
                          <span style={{color: '#666'}}>Match Quality: </span>
                          <span style={{color: result.detailedAnalysis.ai.validation.matchValidation.quality.score >= 0.7 ? '#28a745' : result.detailedAnalysis.ai.validation.matchValidation.quality.score >= 0.4 ? '#ffc107' : '#dc3545', fontWeight: 'bold'}}>
                            {Math.round((result.detailedAnalysis.ai.validation.matchValidation.quality.score || 0) * 100)}%
                          </span>
                        </div>
                      </div>
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
            className="btn btn-danger" 
            onClick={() => {
              const reason = result.detailedAnalysis?.ai?.concerns?.join(', ') || 
                           result.detailedAnalysis?.confidence?.concerns?.join(', ') || 
                           null;
              onReject(result, reason);
            }}
            title="Reject this match permanently"
          >
            <i className="bi bi-x-circle"></i>
            Reject Match
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