import { ReactElement } from 'react';
import { WelcomeScreen, AppIframe, Footer } from '../components';
import { AppLink } from '../types/AppLink';

export interface RouteConfig {
  path: string;
  element: (props: RouteElementProps) => ReactElement;
}

export interface RouteElementProps {
  apps: AppLink[];
  loading: boolean;
  onIframeLoad: () => void;
}

export const routeConfigs: RouteConfig[] = [
  {
    path: '/',
    element: ({ apps }: RouteElementProps) => (
      <>
        <WelcomeScreen apps={apps} />
        <Footer />
      </>
    )
  },
  {
    path: '/finance',
    element: ({ loading, onIframeLoad }: RouteElementProps) => (
      <AppIframe 
        src="http://localhost:3001"
        loading={loading}
        onLoad={onIframeLoad}
      />
    )
  },
  {
    path: '/relationship',
    element: ({ loading, onIframeLoad }: RouteElementProps) => (
      <AppIframe 
        src="http://localhost:3002"
        loading={loading}
        onLoad={onIframeLoad}
      />
    )
  }
];