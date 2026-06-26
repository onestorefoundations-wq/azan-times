import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const [mosqueName, setMosqueName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Check if username already exists
      const { data: existingUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existingUser) {
        setError('Username or Mobile Number already taken.');
        setLoading(false);
        return;
      }

      // 2. Create the Tenant (Mosque)
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert([{ name: mosqueName }])
        .select()
        .single();

      if (tenantError || !tenantData) throw tenantError;

      // 3. Create the Admin User (empty string if no password provided)
      const { data: userData, error: userError } = await supabase
        .from('admin_users')
        .insert([{
          tenant_id: tenantData.id,
          username: username,
          mobile: username.match(/^\d+$/) ? username : null,
          email: email || null,
          password_hash: password || ""
        }])
        .select()
        .single();

      if (userError || !userData) throw userError;

      // 3.5 Create the default Mosque Config
      const defaultConfig = {
        masjid_profile: {
          name: mosqueName,
          name_arabic: '',
          latitude: 21.422487, // Mecca
          longitude: 39.826206,
          timezone_id: 'Asia/Riyadh',
          calculation_method: 'UmmAlQura',
          asr_juristic_method: 'Standard'
        },
        time_adjustments: {
          fajr_adhan_offset: 0,
          dhuhr_adhan_offset: -2,
          asr_adhan_offset: 0,
          maghrib_adhan_offset: 0,
          isha_adhan_offset: 0,
          fajr_iqamah_wait: 25,
          dhuhr_iqamah_wait: 15,
          asr_iqamah_wait: 15,
          maghrib_iqamah_wait: 5,
          isha_iqamah_wait: 15
        },
        features_format: {
          show_taraweeh: false,
          taraweeh_time: null,
          use_24_hour_format: false,
          audio_alerts_enabled: true,
          display_language: 'en',
          adhan_alert_mode: 'full_screen'
        },
        slideshow_settings: {
          enabled: true,
          interval_minutes: 5,
          duration_per_image_seconds: 5,
          pause_before_adhan_mins: 2,
          pause_after_iqamah_mins: 15,
          display_mode: 'full_screen',
          overlay_corner: 'top_right',
          overlay_size_percent: 25
        },
        jumuah_settings: {
          enabled: true,
          khutbah_time: '13:00',
          iqamah_time: '13:30',
          display_label: "Jumu'ah"
        },
        announcements: [],
        slide_assets: []
      };

      const { error: configError } = await supabase
        .from('mosque_configs')
        .insert([{
          tenant_id: tenantData.id,
          config_version: 1,
          config_json: defaultConfig
        }]);

      if (configError) throw configError;

      // 4. Auto-login
      localStorage.setItem('tenant_id', tenantData.id);
      localStorage.setItem('username', userData.username);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('An error occurred during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Register Mosque</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Mosque Name:</label>
          <input 
            type="text" 
            value={mosqueName} 
            onChange={(e) => setMosqueName(e.target.value)} 
            style={{ width: '100%', padding: '8px' }}
            required
            placeholder="e.g. Central Mosque"
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Username / Mobile No:</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            style={{ width: '100%', padding: '8px' }}
            required
            placeholder="e.g. 07700900000"
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Email (Optional):</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={{ width: '100%', padding: '8px' }}
            placeholder="e.g. admin@masjid.com"
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Password (Optional):</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ width: '100%', padding: '8px' }}
            placeholder="Leave blank for passwordless"
          />
        </div>
        <button disabled={loading} type="submit" style={{ width: '100%', padding: '10px', background: '#28A745', color: 'white', border: 'none', borderRadius: '4px' }}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <Link to="/login">Already have an account? Login here</Link>
      </div>
    </div>
  );
}
