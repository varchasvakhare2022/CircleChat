import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../services/api';
import './settings.css';

const Settings = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profile = await usersAPI.getProfile();
      
      // If no custom display name, use Clerk data as default
      if (profile.display_name) {
        setDisplayName(profile.display_name);
      } else {
        // Get default from Clerk user object
        const defaultName = 
          user?.firstName || 
          user?.username || 
          user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 
          '';
        setDisplayName(defaultName);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err.response?.data?.detail || 'Failed to load profile');
      // Set default from Clerk
      const defaultName = 
        user?.firstName || 
        user?.username || 
        user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 
        '';
      setDisplayName(defaultName);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      await usersAPI.updateProfile(displayName.trim());
      setSuccess('Display name updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update display name');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/groups');
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button onClick={handleBack} className="back-button">
          ←
        </button>
        <h2>Settings</h2>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>Display Name</h3>
          <p className="settings-description">
            This is the name that will be shown to other users in chat messages.
          </p>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <form onSubmit={handleSave} className="settings-form">
            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                maxLength={50}
                className="settings-input"
              />
              <small className="form-hint">
                Maximum 50 characters. This name will appear in all your messages.
              </small>
            </div>
            
            <div className="form-actions">
              <button
                type="submit"
                className="save-button"
                disabled={saving || !displayName.trim()}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="settings-section">
          <h3>Account Information</h3>
          <div className="info-item">
            <label>Email:</label>
            <span>{user?.primaryEmailAddress?.emailAddress || 'N/A'}</span>
          </div>
          {user?.firstName && (
            <div className="info-item">
              <label>First Name:</label>
              <span>{user.firstName}</span>
            </div>
          )}
          {user?.lastName && (
            <div className="info-item">
              <label>Last Name:</label>
              <span>{user.lastName}</span>
            </div>
          )}
          {user?.username && (
            <div className="info-item">
              <label>Username:</label>
              <span>{user.username}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;

