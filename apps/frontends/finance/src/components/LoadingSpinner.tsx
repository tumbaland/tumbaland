import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="finance-app">
      <header className="finance-header">
        <h2>Finance Portfolio</h2>
      </header>
      <div className="loading">Loading assets...</div>
    </div>
  );
};

export default LoadingSpinner;
