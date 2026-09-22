import { Routes, Route } from 'react-router';
import { ProtectedRoute } from '@tumbaland/frontend-core';
import ConversationsPage from '../pages/ConversationsPage';
import ThreadPage from '../pages/ThreadPage';
import CallCheckPage from '../pages/CallCheckPage';
import { authService } from '../services/authService';
import { useCurrentUser } from '../hooks/useCurrentUser';

/** Passes the signed-in user down, which the conversation list needs to name a thread. */
const Conversations = () => {
  const { user } = useCurrentUser();
  return <ConversationsPage currentUserId={user?.id ?? ''} />;
};

const AppRoutes = () => (
  <Routes>
    <Route
      path="/"
      element={
        <ProtectedRoute authService={authService}>
          <Conversations />
        </ProtectedRoute>
      }
    />
    {/* Before `/:conversationId` in intent; the router ranks a static path above it anyway. */}
    <Route
      path="/call-check"
      element={
        <ProtectedRoute authService={authService}>
          <CallCheckPage />
        </ProtectedRoute>
      }
    />
    {/* What a notification click opens, so it has to work from a cold start. */}
    <Route
      path="/:conversationId"
      element={
        <ProtectedRoute authService={authService}>
          <ThreadPage />
        </ProtectedRoute>
      }
    />
  </Routes>
);

export default AppRoutes;
