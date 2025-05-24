import React from 'react';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => {
  return (
    <div className="finance-app">
      <header className="finance-header">
        <h2>Finance Portfolio</h2>
      </header>
      <div className="error">
        <p>Error: {error}</p>
        <button onClick={onRetry} className="retry-button">
          Retry
        </button>
      </div>
    </div>
  );
};

export default ErrorDisplay;
