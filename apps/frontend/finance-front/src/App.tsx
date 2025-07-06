import { BrowserRouter as Router } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import AppRoutes from "./routes";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <ProtectedRoute>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </ProtectedRoute>
    </Router>
  );
}

export default App;
