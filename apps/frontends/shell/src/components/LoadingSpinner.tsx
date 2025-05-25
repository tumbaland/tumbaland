import { type FC } from 'react';

const LoadingSpinner: FC = () => {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner"></div>
      <p>Loading application...</p>
    </div>
  );
};

export default LoadingSpinner;
