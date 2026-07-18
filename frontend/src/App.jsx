import { Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import RolesPage from './pages/RolesPage';
import MeetingPage from './pages/MeetingPage';

function ProtectedRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/register" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/rooms" element={<ProtectedRoute><RolesPage /></ProtectedRoute>} />
      <Route path="/meeting/:code" element={<ProtectedRoute><MeetingPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/register" replace />} />
    </Routes>
  );
}
