import { type FC } from 'react';
import AppCard from './AppCard';
import QuickStats from './QuickStats';
import { AppLink } from '../types/AppLink';

interface WelcomeScreenProps {
  apps: AppLink[];
}

const WelcomeScreen: FC<WelcomeScreenProps> = ({ apps }) => {
  return (
    <div className="welcome-content">
      <div className="welcome-section">
        <h2 className="welcome-title">Welcome to Your Digital Life</h2>
        <p className="welcome-description">
          Seamlessly manage your finances and relationships in one integrated platform.
          Choose an application below to get started.
        </p>
      </div>

      {/* App Cards */}
      <div className="apps-grid">
        {apps.map((app) => (
          <AppCard
            key={app.name}
            app={app}
          />
        ))}
      </div>

      <QuickStats />
    </div>
  );
};

export default WelcomeScreen;
