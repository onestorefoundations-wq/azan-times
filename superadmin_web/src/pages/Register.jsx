import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { AuthSession } from '../authSession';
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
      // Tenant + admin user are created together inside app_register(), which
      // bcrypts the password. Doing it client-side previously left an orphaned
      // tenant behind whenever the user insert failed.
      const session = await AuthSession.register({
        mosqueName,
        username,
        password,
        mobile: username.match(/^\d+$/) ? username : null,
        email: email || null,
      });

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

      const { error: configError } = await supabase.rpc('increment_and_push_config', {
        p_tenant_id: session.tenantId,
        p_config_json: defaultConfig,
        p_device_id: 'superadmin_web',
      });

      if (configError) throw configError;

      // AuthSession.register already stored the token, tenant_id and username.
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during registration. Please try again.');
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
          <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ width: '100%', padding: '8px' }}
            placeholder="At least 6 characters"
            minLength={6}
            required
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
