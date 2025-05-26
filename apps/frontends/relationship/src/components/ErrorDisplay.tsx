import React from 'react';
import Header from './Header';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => {
  return (
    <div className="finance-app">
      <Header onRefresh={function (): void {
        throw new Error('Function not implemented.');
      } } />
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
