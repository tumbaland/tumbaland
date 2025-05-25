import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { AppLink } from '../types/AppLink';

interface AppCardProps {
  app: AppLink;
}

const AppCard: FC<AppCardProps> = ({ app }) => {
  return (
    <Link
      to={app.route}
      className="app-card"
      style={{ '--app-color': app.color, '--app-gradient': app.gradient } as React.CSSProperties}
    >
      <div className="app-icon">{app.icon}</div>
      <div className="app-content">
        <h3 className="app-name">{app.name}</h3>
        <p className="app-description">{app.description}</p>
        <div className="app-action">
          <span className="launch-text">Launch Application</span>
          <svg className="launch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
            />
          </svg>
        </div>
      </div>
    </Link>
  );
};

export default AppCard;
