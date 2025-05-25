import { type FC } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface AppIframeProps {
  src: string;
  loading: boolean;
  onLoad: () => void;
}

const AppIframe: FC<AppIframeProps> = ({ src, loading, onLoad }) => {
  return (
    <div className="iframe-container">
      {loading && <LoadingSpinner />}
      <iframe
        src={src}
        title="Application"
        className="app-iframe"
        onLoad={onLoad}
      />
    </div>
  );
};

export default AppIframe;
