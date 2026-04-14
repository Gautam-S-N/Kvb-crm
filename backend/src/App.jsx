import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../../frontend/src/stores/authStore';
import Login from '../../frontend/src/pages/Login';
import Dashboard from '../../frontend/src/pages/Dashboard';

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} 
        />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;