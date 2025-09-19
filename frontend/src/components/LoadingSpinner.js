import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="text-center">
        <div className="loading-spinner"></div>
        <p className="mt-3 text-muted">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;