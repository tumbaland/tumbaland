import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import AppRoutes from "./routes";
import ProtectedRoute from "./components/ProtectedRoute";
import { AppConfig } from "./config/ConfigProvider";

export const ConfigContext = React.createContext<AppConfig>({});

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
