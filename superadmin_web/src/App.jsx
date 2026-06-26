import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';

// Simple protected route component checking localStorage
const ProtectedRoute = ({ children }) => {
  const tenantId = localStorage.getItem('tenant_id');
  if (!tenantId) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const handleLogout = () => {
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('username');
    window.location.href = '/login';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected layout */}
        <Route path="/*" element={
          <ProtectedRoute>
            <div style={{ display: 'flex' }}>
              <nav style={{ width: '200px', padding: '20px', background: '#f4f4f4', height: '100vh' }}>
                <h2>Admin</h2>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li><Link to="/">Dashboard</Link></li>
                </ul>
                <button onClick={handleLogout} style={{ marginTop: '20px', width: '100%' }}>Logout</button>
              </nav>
              <main style={{ flex: 1, padding: '20px' }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
