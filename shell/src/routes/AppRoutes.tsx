import { Routes, Route } from 'react-router-dom';
import { AppLink } from '../types/AppLink';
import { routeConfigs, RouteElementProps } from './routeConfigs';

interface AppRoutesProps {
  apps: AppLink[];
  loading: boolean;
  onIframeLoad: () => void;
}

const AppRoutes = ({ apps, loading, onIframeLoad }: AppRoutesProps) => {
  const routeProps: RouteElementProps = {
    apps,
    loading,
    onIframeLoad
  };

  return (
    <Routes>
      {routeConfigs.map((routeConfig) => (
        <Route 
          key={routeConfig.path}
          path={routeConfig.path}
          element={routeConfig.element(routeProps)}
        />
      ))}
    </Routes>
  );
};

export default AppRoutes;
