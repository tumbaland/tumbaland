import { Routes, Route } from 'react-router';
import { Loader } from '@tumbaland/components';
import HomePage from '../pages/HomePage';
import LandingPage from '../pages/LandingPage';
import { useAuthState } from '../hooks/useAuthState';

/**
 * `/` serves two audiences: signed-out visitors get the public landing page
 * (the product and its pricing), signed-in users get the dashboard. The
 * loading state renders a spinner rather than the landing page so a returning
 * user never sees the marketing copy flash before their own content.
 */
export function Home() {
  const { loading, authenticated, user } = useAuthState();

  if (loading) {
    return <Loader message="Loading" />;
  }

  return authenticated ? <HomePage user={user} /> : <LandingPage />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
