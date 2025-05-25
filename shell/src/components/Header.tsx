import { type FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppLink } from '../types/AppLink';

interface HeaderProps {
  apps: AppLink[];
}

const Header: FC<HeaderProps> = ({ apps }) => {
  const location = useLocation();

  return (
    <header className="shell-header">
      <div className="header-content">
        <Link to="/" className="logo-link">
          <h1 className="logo">
            <span className="logo-icon">🌍</span>
            TumbaLand
          </h1>
        </Link>
        <nav className="app-nav">
          {apps.map((app) => (
            <Link
              key={app.name}
              to={app.route}
              className={`nav-button ${location.pathname === app.route ? 'active' : ''}`}
              style={{ '--app-color': app.color } as React.CSSProperties}
            >
              <span className="nav-icon">{app.icon}</span>
              {app.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
