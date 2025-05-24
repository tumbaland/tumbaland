import React from 'react';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => {
  return (
    <div className="error-display">
      <div className="error-content">
        <h3>Oops! Something went wrong</h3>
        <p className="error-message">{error}</p>
        <button onClick={onRetry} className="retry-button">
          Try Again
        </button>
      </div>
    </div>
  );
};

export default ErrorDisplay;
