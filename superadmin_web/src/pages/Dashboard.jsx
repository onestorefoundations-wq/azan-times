import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [view, setView] = useState('devices'); // 'devices' | 'config'
  const tenantId = localStorage.getItem('tenant_id');
  const username = localStorage.getItem('username');

  // Config States
  const [config, setConfig] = useState(null);
  const [configId, setConfigId] = useState(null);
  const [configVersion, setConfigVersion] = useState(1);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [uploading, setUploading] = useState(false);

  // PHP Upload URL State (editable by admin)
  const [phpUploadUrl, setPhpUploadUrl] = useState(
    localStorage.getItem('php_upload_url') || 'http://localhost:8000/uploads.php'
  );

  useEffect(() => {
    localStorage.setItem('php_upload_url', phpUploadUrl);
  }, [phpUploadUrl]);

  // Fetch devices
  useEffect(() => {
    async function fetchDevices() {
      if (!tenantId) return;

      const { data, error } = await supabase
        .from('device_registry')
        .select(`
          id,
          device_id,
          last_seen,
          app_version,
          online_status,
          tenant_id,
          tenants ( name )
        `)
        .eq('tenant_id', tenantId);
      
      if (!error && data) {
        setDevices(data);
      }
      setLoadingDevices(false);
    }

    fetchDevices();
    const interval = setInterval(fetchDevices, 30000); // refresh devices status every 30s
    return () => clearInterval(interval);
  }, [tenantId]);

  // Fetch or Seed Mosque Config
  const loadConfig = async () => {
    if (!tenantId) return;
    setLoadingConfig(true);

    try {
      const { data, error } = await supabase
        .from('mosque_configs')
        .select('id, config_version, config_json')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfigId(data.id);
        setConfigVersion(data.config_version);
        setConfig(data.config_json);
      } else {
        // Fallback seed if config row doesn't exist
        const defaultConfig = {
          masjid_profile: {
            name: 'My Mosque',
            name_arabic: '',
            latitude: 21.422487,
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
            use_arabic_labels: false,
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

        const { data: newRow, error: insertError } = await supabase
          .from('mosque_configs')
          .insert([{
            tenant_id: tenantId,
            config_version: 1,
            config_json: defaultConfig
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        if (newRow) {
          setConfigId(newRow.id);
          setConfigVersion(1);
          setConfig(newRow.config_json);
        }
      }
    } catch (err) {
      console.error('[Dashboard] Config error:', err);
      alert('Failed to load configuration from database.');
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleToggleView = () => {
    if (view === 'devices') {
      setView('config');
      loadConfig();
    } else {
      setView('devices');
    }
  };

  // Safe nested config updater
  const updateConfigField = (section, field, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  // Handle slide uploads to PHP uploads.php
  const handleSlideUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(phpUploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer EverY0NeKnoW$1T'
          },
          body: formData
        });

        if (!res.ok) throw new Error(`Upload returned status ${res.status}`);

        const data = await res.json();
        if (data.success && data.url) {
          const newAsset = {
            id: Date.now() + Math.floor(Math.random() * 1000), // temp local numeric ID
            filename: file.name,
            remote_url: data.url,
            local_path: null,
            uploaded_at: Date.now()
          };

          setConfig(prev => ({
            ...prev,
            slide_assets: [...(prev.slide_assets || []), newAsset]
          }));
        } else {
          alert(`Upload failed: ${data.error || 'Server error'}`);
        }
      }
    } catch (err) {
      console.error(err);
      alert(`Upload failed: ${err.message}. Please check CORS policies, ensure your PHP uploads.php server is running at the configured URL, and accepts authorization headers.`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSlide = (slideId) => {
    setConfig(prev => ({
      ...prev,
      slide_assets: (prev.slide_assets || []).filter(s => s.id !== slideId)
    }));
  };

  // Push Config to Supabase
  const handleSaveConfig = async () => {
    if (!tenantId || !config) return;

    // Force data cleaning/formatting
    const cleanConfig = {
      ...config,
      masjid_profile: {
        ...config.masjid_profile,
        latitude: parseFloat(config.masjid_profile.latitude) || 0.0,
        longitude: parseFloat(config.masjid_profile.longitude) || 0.0,
      },
      time_adjustments: {
        fajr_adhan_offset: parseInt(config.time_adjustments.fajr_adhan_offset, 10) || 0,
        dhuhr_adhan_offset: parseInt(config.time_adjustments.dhuhr_adhan_offset, 10) || 0,
        asr_adhan_offset: parseInt(config.time_adjustments.asr_adhan_offset, 10) || 0,
        maghrib_adhan_offset: parseInt(config.time_adjustments.maghrib_adhan_offset, 10) || 0,
        isha_adhan_offset: parseInt(config.time_adjustments.isha_adhan_offset, 10) || 0,
        fajr_iqamah_wait: parseInt(config.time_adjustments.fajr_iqamah_wait, 10) || 0,
        dhuhr_iqamah_wait: parseInt(config.time_adjustments.dhuhr_iqamah_wait, 10) || 0,
        asr_iqamah_wait: parseInt(config.time_adjustments.asr_iqamah_wait, 10) || 0,
        maghrib_iqamah_wait: parseInt(config.time_adjustments.maghrib_iqamah_wait, 10) || 0,
        isha_iqamah_wait: parseInt(config.time_adjustments.isha_iqamah_wait, 10) || 0,
      },
      slideshow_settings: {
        ...config.slideshow_settings,
        interval_minutes: parseInt(config.slideshow_settings.interval_minutes, 10) || 5,
        duration_per_image_seconds: parseInt(config.slideshow_settings.duration_per_image_seconds, 10) || 5,
        pause_before_adhan_mins: parseInt(config.slideshow_settings.pause_before_adhan_mins, 10) || 2,
        pause_after_iqamah_mins: parseInt(config.slideshow_settings.pause_after_iqamah_mins, 10) || 15,
        overlay_size_percent: parseInt(config.slideshow_settings.overlay_size_percent, 10) || 25,
      }
    };

    const nextVersion = configVersion + 1;
    const { error } = await supabase
      .from('mosque_configs')
      .update({
        config_version: nextVersion,
        config_json: cleanConfig,
        updated_at: new Date().toISOString()
      })
      .eq('id', configId);

    if (error) {
      alert(`Error updating config: ${error.message}`);
    } else {
      setConfigVersion(nextVersion);
      alert(`Configuration updated successfully! Version is now ${nextVersion}. Connected TV screens will update automatically.`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('username');
    window.location.reload();
  };

  return (
    <div className="dashboard-root">
      {/* Dynamic CSS Styling Inject */}
      <style>{`
        .dashboard-root {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(135deg, #0d1b2a 0%, #1b263b 100%);
          color: #e8f0fe;
          min-height: 100vh;
          padding: 30px;
          box-sizing: border-box;
        }
        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header-bar h1 {
          font-size: 24px;
          margin: 0;
          color: #f0b429;
          font-weight: 700;
        }
        .user-badge {
          display: flex;
          align-items: center;
          gap: 15px;
          font-size: 14px;
        }
        .btn-action {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
          font-size: 14px;
        }
        .btn-primary {
          background: #f0b429;
          color: #0d1b2a;
          box-shadow: 0 0 15px rgba(240, 180, 41, 0.3);
        }
        .btn-primary:hover {
          filter: brightness(1.1);
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: #e8f0fe;
          border-color: rgba(255, 255, 255, 0.08);
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .btn-danger {
          background: #ff4757;
          color: white;
        }
        .btn-danger:hover {
          filter: brightness(1.1);
        }
        .grid-layout {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .device-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 20px;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s;
        }
        .device-card:hover {
          transform: translateY(-2px);
          border-color: #00d4aa;
        }
        .device-card h3 {
          margin-top: 0;
          color: #00d4aa;
        }
        .device-status {
          font-weight: bold;
          font-size: 13px;
          padding: 4px 10px;
          border-radius: 12px;
          display: inline-block;
        }
        .status-online {
          background: rgba(0, 212, 170, 0.15);
          color: #00d4aa;
        }
        .status-offline {
          background: rgba(255, 71, 87, 0.15);
          color: #ff4757;
        }
        /* Config Panel CSS */
        .config-container {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          backdrop-filter: blur(15px);
          display: flex;
          min-height: 550px;
          overflow: hidden;
        }
        .config-sidebar {
          width: 240px;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          padding: 20px 0;
        }
        .sidebar-btn {
          background: transparent;
          border: none;
          color: rgba(232, 240, 254, 0.65);
          text-align: left;
          padding: 14px 25px;
          font-size: 15px;
          cursor: pointer;
          font-weight: 500;
          border-left: 3px solid transparent;
          transition: all 0.2s;
        }
        .sidebar-btn:hover {
          color: #e8f0fe;
          background: rgba(255, 255, 255, 0.02);
        }
        .sidebar-btn.active {
          color: #f0b429;
          border-left-color: #f0b429;
          background: rgba(240, 180, 41, 0.05);
          font-weight: 600;
        }
        .config-content {
          flex: 1;
          padding: 30px;
          overflow-y: auto;
          max-height: 650px;
        }
        .config-form h3 {
          color: #f0b429;
          margin-top: 0;
          margin-bottom: 25px;
          font-size: 20px;
        }
        .form-group {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(232, 240, 254, 0.7);
        }
        .form-group input, .form-group select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 14px;
          color: white;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .form-group input:focus, .form-group select:focus {
          border-color: #f0b429;
          box-shadow: 0 0 8px rgba(240, 180, 41, 0.15);
        }
        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .offset-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .offset-row {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 15px;
          align-items: center;
        }
        .offset-row-header {
          font-size: 13px;
          font-weight: bold;
          color: #00d4aa;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding-bottom: 5px;
        }
        .slides-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 20px;
          max-height: 250px;
          overflow-y: auto;
        }
        .slide-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }
        .slide-item img {
          width: 80px;
          height: 45px;
          object-fit: cover;
          border-radius: 4px;
        }
        .slide-title {
          font-size: 13px;
          font-weight: 500;
          color: #e8f0fe;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          max-width: 250px;
        }
        .btn-small-danger {
          background: transparent;
          border: none;
          color: #ff4757;
          cursor: pointer;
          font-size: 16px;
          padding: 5px;
        }
        .btn-small-danger:hover {
          transform: scale(1.1);
        }
        .config-footer {
          margin-top: 25px;
          display: flex;
          justify-content: flex-end;
          gap: 15px;
        }
      `}</style>

      {/* Header bar */}
      <div className="header-bar">
        <div>
          <h1>🕌 Masjid Signage Portal</h1>
          <p style={{ margin: '5px 0 0', color: 'rgba(232, 240, 254, 0.6)', fontSize: '13px' }}>
            Logged in: <strong>{username}</strong> (Tenant UUID: {tenantId})
          </p>
        </div>
        
        <div className="user-badge">
          <button className="btn-action btn-secondary" onClick={handleToggleView}>
            {view === 'devices' ? '🛠️ Mosque Config' : '📱 Connected Devices'}
          </button>
          <button className="btn-action btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {loadingDevices ? (
        <p>Loading details...</p>
      ) : view === 'devices' ? (
        <div>
          <h2 style={{ marginBottom: '20px', fontSize: '20px', color: '#00d4aa' }}>Connected Screens / TVs</h2>
          {devices.length === 0 ? (
            <div style={{ padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <p style={{ margin: '0 0 15px', color: 'rgba(232, 240, 254, 0.6)' }}>No device screens are linked to your account yet.</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(232, 240, 254, 0.4)' }}>
                To link a TV, enter this account's Tenant UUID into the local TV settings panel.
              </p>
            </div>
          ) : (
            <div className="grid-layout">
              {devices.map(device => (
                <div key={device.id} className="device-card">
                  <h3>{device.tenants?.name || 'My Mosque'}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', margin: '15px 0' }}>
                    <div><strong>Device ID:</strong> <code style={{ color: '#00d4aa' }}>{device.device_id}</code></div>
                    <div><strong>App Type:</strong> {device.app_version || 'Web Client'}</div>
                    <div><strong>Last Heartbeat:</strong> {new Date(device.last_seen).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`device-status ${device.online_status ? 'status-online' : 'status-offline'}`}>
                      {device.online_status ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    <button className="btn-action btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleToggleView}>
                      Configure
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Configuration Manager View */
        <div>
          {loadingConfig || !config ? (
            <p>Loading Mosque Configuration...</p>
          ) : (
            <div>
              <div className="config-container">
                {/* Tabs Selector Sidebar */}
                <div className="config-sidebar">
                  <button className={`sidebar-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                    🕌 Mosque Profile
                  </button>
                  <button className={`sidebar-btn ${activeTab === 'offsets' ? 'active' : ''}`} onClick={() => setActiveTab('offsets')}>
                    ⏱️ Timings & Offsets
                  </button>
                  <button className={`sidebar-btn ${activeTab === 'slideshow' ? 'active' : ''}`} onClick={() => setActiveTab('slideshow')}>
                    🖼️ Idle Slideshow
                  </button>
                  <button className={`sidebar-btn ${activeTab === 'jumuah' ? 'active' : ''}`} onClick={() => setActiveTab('jumuah')}>
                    🕌 Friday Jumu'ah
                  </button>
                  <button className={`sidebar-btn ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>
                    ⚙️ Display Preferences
                  </button>
                </div>

                {/* Edit Form Panel */}
                <div className="config-content">
                  <div className="config-form">
                    
                    {/* Tab 1: Profile */}
                    {activeTab === 'profile' && (
                      <div>
                        <h3>Mosque Profile Settings</h3>
                        <div className="form-group">
                          <label>Mosque / Masjid Name (English)</label>
                          <input 
                            type="text" 
                            value={config.masjid_profile.name || ''} 
                            onChange={(e) => updateConfigField('masjid_profile', 'name', e.target.value)} 
                          />
                        </div>
                        <div className="form-group">
                          <label>Arabic Mosque Name (Optional)</label>
                          <input 
                            type="text" 
                            value={config.masjid_profile.name_arabic || ''} 
                            onChange={(e) => updateConfigField('masjid_profile', 'name_arabic', e.target.value)} 
                            placeholder="مسجد"
                          />
                        </div>
                        <div className="form-row-2">
                          <div className="form-group">
                            <label>Latitude Coordinates</label>
                            <input 
                              type="number" 
                              step="any" 
                              value={config.masjid_profile.latitude} 
                              onChange={(e) => updateConfigField('masjid_profile', 'latitude', e.target.value)} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Longitude Coordinates</label>
                            <input 
                              type="number" 
                              step="any" 
                              value={config.masjid_profile.longitude} 
                              onChange={(e) => updateConfigField('masjid_profile', 'longitude', e.target.value)} 
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Timezone Identifier</label>
                          <input 
                            type="text" 
                            value={config.masjid_profile.timezone_id || 'Asia/Riyadh'} 
                            onChange={(e) => updateConfigField('masjid_profile', 'timezone_id', e.target.value)} 
                          />
                        </div>
                        <div className="form-row-2">
                          <div className="form-group">
                            <label>Prayer Calculation Method</label>
                            <select 
                              value={config.masjid_profile.calculation_method || 'UmmAlQura'} 
                              onChange={(e) => updateConfigField('masjid_profile', 'calculation_method', e.target.value)}
                            >
                              <option value="UmmAlQura">Umm Al-Qura (Saudi Arabia)</option>
                              <option value="MoonsightingCommittee">Moonsighting Committee</option>
                              <option value="NorthAmerica">ISNA (North America)</option>
                              <option value="Muslim_World_League">Muslim World League (MWL)</option>
                              <option value="Egyptian">Egyptian General Authority</option>
                              <option value="Karachi">University of Islamic Sciences, Karachi</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Asr Calculation Method (Juristic)</label>
                            <select 
                              value={config.masjid_profile.asr_juristic_method || 'Standard'} 
                              onChange={(e) => updateConfigField('masjid_profile', 'asr_juristic_method', e.target.value)}
                            >
                              <option value="Standard">Standard (Shafi'i, Maliki, Hanbali)</option>
                              <option value="Hanafi">Hanafi (Later Asr time)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Timings & Offsets */}
                    {activeTab === 'offsets' && (
                      <div>
                        <h3>Prayer Time Adjustments</h3>
                        <p style={{ margin: '0 0 20px', color: 'rgba(232,240,254,0.6)', fontSize: '13px' }}>
                          Add offset minutes to adjust calculated Adhan times and specify the countdown duration (minutes) till Iqamah.
                        </p>
                        <div className="offset-grid">
                          <div className="offset-row offset-row-header">
                            <span>PRAYER NAME</span>
                            <span>ADHAN OFFSET (MINS)</span>
                            <span>IQAMAH WAIT (MINS)</span>
                          </div>

                          {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map(prayer => (
                            <div key={prayer} className="offset-row">
                              <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{prayer}</span>
                              <input 
                                type="number" 
                                value={config.time_adjustments[`${prayer}_adhan_offset`]} 
                                onChange={(e) => updateConfigField('time_adjustments', `${prayer}_adhan_offset`, e.target.value)} 
                              />
                              <input 
                                type="number" 
                                value={config.time_adjustments[`${prayer}_iqamah_wait`]} 
                                onChange={(e) => updateConfigField('time_adjustments', `${prayer}_iqamah_wait`, e.target.value)} 
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Idle Slideshow */}
                    {activeTab === 'slideshow' && (
                      <div>
                        <h3>Idle Screensaver / Slideshow</h3>
                        <div style={{ display: 'flex', gap: '25px', marginBottom: '15px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={!!config.slideshow_settings.enabled} 
                              onChange={(e) => updateConfigField('slideshow_settings', 'enabled', e.target.checked)} 
                            />
                            Enable Slideshow during idle times
                          </label>
                        </div>

                        <div className="form-row-2">
                          <div className="form-group">
                            <label>Slideshow Cycle Interval (Minutes)</label>
                            <input 
                              type="number" 
                              value={config.slideshow_settings.interval_minutes} 
                              onChange={(e) => updateConfigField('slideshow_settings', 'interval_minutes', e.target.value)} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Duration Per Slide Image (Seconds)</label>
                            <input 
                              type="number" 
                              value={config.slideshow_settings.duration_per_image_seconds} 
                              onChange={(e) => updateConfigField('slideshow_settings', 'duration_per_image_seconds', e.target.value)} 
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Slideshow Display Layout Template</label>
                          <select 
                            value={config.slideshow_settings.display_mode || 'full_screen'} 
                            onChange={(e) => updateConfigField('slideshow_settings', 'display_mode', e.target.value)}
                          >
                            <option value="full_screen">Mode 1: Full Screen Takeover (With mini clock)</option>
                            <option value="corner_overlay">Mode 2: Corner Overlay (Choose position/size below)</option>
                            <option value="split_screen">Mode 3: Split Screen (50/50 split with prayer schedule)</option>
                          </select>
                        </div>

                        {config.slideshow_settings.display_mode === 'corner_overlay' && (
                          <div className="form-row-2">
                            <div className="form-group">
                              <label>Corner Location</label>
                              <select 
                                value={config.slideshow_settings.overlay_corner || 'top_right'} 
                                onChange={(e) => updateConfigField('slideshow_settings', 'overlay_corner', e.target.value)}
                              >
                                <option value="top_right">Top Right Corner</option>
                                <option value="top_left">Top Left Corner</option>
                                <option value="bottom_right">Bottom Right Corner</option>
                                <option value="bottom_left">Bottom Left Corner</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Overlay Dimensions (% of Screen Width)</label>
                              <select 
                                value={config.slideshow_settings.overlay_size_percent || 25} 
                                onChange={(e) => updateConfigField('slideshow_settings', 'overlay_size_percent', parseInt(e.target.value, 10))}
                              >
                                <option value={15}>Small (15%)</option>
                                <option value={20}>Medium-Small (20%)</option>
                                <option value={25}>Medium (25%)</option>
                                <option value={30}>Medium-Large (30%)</option>
                                <option value={40}>Large (40%)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="form-row-2">
                          <div className="form-group">
                            <label>Pause slideshow before Adhan (Minutes)</label>
                            <input 
                              type="number" 
                              value={config.slideshow_settings.pause_before_adhan_mins} 
                              onChange={(e) => updateConfigField('slideshow_settings', 'pause_before_adhan_mins', e.target.value)} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Keep paused after Iqamah (Minutes)</label>
                            <input 
                              type="number" 
                              value={config.slideshow_settings.pause_after_iqamah_mins} 
                              onChange={(e) => updateConfigField('slideshow_settings', 'pause_after_iqamah_mins', e.target.value)} 
                            />
                          </div>
                        </div>

                        {/* Image file manager inside account linking to PHP Upload folder */}
                        <div style={{ marginTop: '25px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
                          <h4 style={{ color: '#00d4aa', margin: '0 0 15px', fontSize: '15px' }}>Upload Slide Announcements (PHP Image Uploads)</h4>
                          
                          <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label>PHP Server Upload Endpoint URL</label>
                            <input 
                              type="text" 
                              value={phpUploadUrl} 
                              onChange={(e) => setPhpUploadUrl(e.target.value)} 
                              placeholder="e.g. http://localhost/masjid-azan-times/php_server/uploads.php"
                            />
                            <small style={{ color: 'rgba(232, 240, 254, 0.4)', fontSize: '11px' }}>
                              This endpoint is triggered to process and upload files. Default points to your PHP environment.
                            </small>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input 
                              type="file" 
                              accept="image/*" 
                              multiple 
                              id="dashboard-file-upload" 
                              style={{ display: 'none' }} 
                              onChange={handleSlideUpload} 
                            />
                            <label 
                              htmlFor="dashboard-file-upload" 
                              className="btn-action btn-primary"
                              style={{ width: 'fit-content', textAlign: 'center', cursor: 'pointer', display: 'inline-block' }}
                            >
                              {uploading ? '📤 Uploading files...' : '📤 Select and Upload Images'}
                            </label>
                            <small style={{ color: 'rgba(232, 240, 254, 0.4)', fontSize: '12px' }}>
                              Recommended ratio is 16:9 landscape format (e.g. 1920x1080) for TV fits.
                            </small>
                          </div>

                          <div className="slides-list">
                            {(!config.slide_assets || config.slide_assets.length === 0) ? (
                              <p style={{ color: 'rgba(232,240,254,0.4)', fontStyle: 'italic', margin: '15px 0', fontSize: '13px' }}>
                                No slideshow slides configured in account. Upload slides above.
                              </p>
                            ) : (
                              config.slide_assets.map((slide, index) => (
                                <div key={slide.id || index} className="slide-item">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <img src={slide.remote_url} alt={slide.filename} />
                                    <div className="slide-title" title={slide.filename}>{slide.filename}</div>
                                  </div>
                                  <button type="button" className="btn-small-danger" onClick={() => handleDeleteSlide(slide.id)}>
                                    🗑️
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                      </div>
                    )}

                    {/* Tab 4: Friday Jumuah */}
                    {activeTab === 'jumuah' && (
                      <div>
                        <h3>Friday Jumu'ah Settings</h3>
                        <div style={{ display: 'flex', gap: '25px', marginBottom: '15px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={!!config.jumuah_settings.enabled} 
                              onChange={(e) => updateConfigField('jumuah_settings', 'enabled', e.target.checked)} 
                            />
                            Override Dhuhr prayer schedules with Jumu'ah timings on Friday
                          </label>
                        </div>
                        <div className="form-row-2">
                          <div className="form-group">
                            <label>Friday Khutbah Start Time (24h)</label>
                            <input 
                              type="text" 
                              placeholder="e.g. 13:00" 
                              value={config.jumuah_settings.khutbah_time || '13:00'} 
                              onChange={(e) => updateConfigField('jumuah_settings', 'khutbah_time', e.target.value)} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Friday Jumu'ah Prayer / Iqamah Time (24h)</label>
                            <input 
                              type="text" 
                              placeholder="e.g. 13:30" 
                              value={config.jumuah_settings.iqamah_time || '13:30'} 
                              onChange={(e) => updateConfigField('jumuah_settings', 'iqamah_time', e.target.value)} 
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Custom Screen Display Label</label>
                          <input 
                            type="text" 
                            value={config.jumuah_settings.display_label || "Jumu'ah"} 
                            onChange={(e) => updateConfigField('jumuah_settings', 'display_label', e.target.value)} 
                          />
                        </div>
                      </div>
                    )}

                    {/* Tab 5: Display Preferences */}
                    {activeTab === 'system' && (
                      <div>
                        <h3>Display Preferences</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={!!config.features_format.use_24_hour_format} 
                              onChange={(e) => updateConfigField('features_format', 'use_24_hour_format', e.target.checked)} 
                            />
                            Use 24-Hour clock format
                          </label>
                          <div className="form-group" style={{ marginTop: '10px' }}>
                            <label>Display Language</label>
                            <select 
                              value={config.features_format.display_language || 'en'} 
                              onChange={(e) => updateConfigField('features_format', 'display_language', e.target.value)}
                            >
                              <option value="en">English (Fajr, Dhuhr...)</option>
                              <option value="ar">Arabic (الفجر, الظهر...)</option>
                              <option value="ml">Malayalam (സുബഹി, ളുഹർ...)</option>
                            </select>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={!!config.features_format.audio_alerts_enabled} 
                              onChange={(e) => updateConfigField('features_format', 'audio_alerts_enabled', e.target.checked)} 
                            />
                            Enable sound beeps / alerts at Adhan & Iqamah transition states
                          </label>
                        </div>

                        <div className="form-group">
                          <label>Adhan & Iqamah Alert Overlay Display Mode</label>
                          <select 
                            value={config.features_format.adhan_alert_mode || 'full_screen'} 
                            onChange={(e) => updateConfigField('features_format', 'adhan_alert_mode', e.target.value)}
                          >
                            <option value="full_screen">Mode 1: Full Screen takeover (no manual dismiss option)</option>
                            <option value="dismissible">Mode 2: Dismissible alert modal (renders close button / Escape support)</option>
                            <option value="side_panel">Mode 3: Side Panel notice (displays inline in clock widget, keeping screens active)</option>
                          </select>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="config-footer">
                <button className="btn-action btn-secondary" onClick={handleToggleView}>
                  Cancel
                </button>
                <button className="btn-action btn-primary" onClick={handleSaveConfig}>
                  Save Mosque Config
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
