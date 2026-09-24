import { Routes, Route } from 'react-router';
import { Loader, ProtectedRoute } from '@tumbaland/frontend-core';
import SharePage from '../pages/SharePage';
import { authService } from '../services/authService';
import HomePage from '../pages/HomePage';
import LandingPage from '../pages/LandingPage';
import PrivacyPage from '../pages/PrivacyPage';
import ConnectPage from '../pages/ConnectPage';
import TermsPage from '../pages/TermsPage';
import { useAuthState } from '../hooks/useAuthState';

/**
 * `/` serves two audiences: signed-out visitors get the public landing page
 * (what the product is, and a way in), signed-in users get the dashboard. The
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
      {/* Public and unauthenticated: both are read by people deciding whether to
          sign up at all, and by connector-directory reviewers who have no account. */}
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/connect" element={<ConnectPage />} />
      <Route path="/terms" element={<TermsPage />} />
      {/* What another app's share menu opens. Signed out, the share waits in
          the worker's cache through the login and is still here after it. */}
      <Route
        path="/share"
        element={
          <ProtectedRoute authService={authService}>
            <SharePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
