import { Routes, Route } from 'react-router-dom';
import TodoCard from '../components/TodoCard';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<TodoCard />} />
    </Routes>
  );
}
