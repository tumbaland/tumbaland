import { BrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import TodoCard from "./components/TodoCard";

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
