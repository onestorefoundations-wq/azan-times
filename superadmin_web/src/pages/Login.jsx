import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Since we are bypassing Supabase Auth for absolute simplicity:
    // We are checking the custom admin_users table.
    // Note: This relies on exact password match (plain text or pre-hashed on client).
    const pwd = password || "";
    
    const { data, error } = await supabase
      .from('admin_users')
      .select('tenant_id, username')
      .eq('username', username)
      .eq('password_hash', pwd)
      .single();

    if (error || !data) {
      setError('Invalid username or password');
    } else {
      localStorage.setItem('tenant_id', data.tenant_id);
      localStorage.setItem('username', data.username);
      navigate('/');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Superadmin Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Username:</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Password (Optional):</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ width: '100%', padding: '8px' }}
            placeholder="Leave blank if you registered without one"
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px', background: '#007BFF', color: 'white', border: 'none', borderRadius: '4px' }}>
          Login
        </button>
      </form>
      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <Link to="/register">Don't have an account? Register here</Link>
      </div>
    </div>
  );
}
