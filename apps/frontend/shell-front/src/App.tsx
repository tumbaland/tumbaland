import React from "react";
import { BrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import TodoCard from "./components/TodoCard";
import { AppConfig } from "./config/ConfigProvider";

export const ConfigContext = React.createContext<AppConfig>({});

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <TodoCard />
      </Layout>
    </BrowserRouter>
  );
}

export default App;
