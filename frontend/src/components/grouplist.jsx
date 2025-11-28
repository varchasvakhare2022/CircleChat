import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { groupsAPI } from '../services/api';
import './grouplist.css';

const GroupList = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  // Set token getter for API
  useEffect(() => {
    import('../services/api').then(({ setGetToken }) => {
      setGetToken(getToken);
    });
  }, [getToken]);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      const data = await groupsAPI.getGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      // Only show error if it's not a 404 or empty response
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to load groups';
      if (err.response?.status !== 404) {
        setError(errorMsg);
      } else {
        // 404 means no groups yet, which is fine
        setGroups([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = () => {
    navigate('/create-group');
  };

  const handleJoinGroup = () => {
    navigate('/join-group');
  };

  const handleGroupClick = (groupId) => {
    navigate(`/group/${groupId}`);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/sign-in');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  if (loading) {
    return (
      <div className="group-list-container">
        <div className="loading">Loading groups...</div>
      </div>
    );
  }

  return (
    <div className="group-list-container">
      <div className="group-list-header">
        <div className="header-content">
          <h1>CircleChat</h1>
          <div className="user-info">
            <span className="username">{user?.username || user?.firstName || 'User'}</span>
            <button onClick={handleSignOut} className="logout-button">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="group-list-actions">
        <button onClick={handleCreateGroup} className="action-button primary">
          + Create Group
        </button>
        <button onClick={handleJoinGroup} className="action-button secondary">
          Join Group
        </button>
      </div>

      {error && error !== 'Not Found' && <div className="error-message">{error}</div>}

      <div className="groups-grid">
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>No groups yet. Create your first group to get started!</p>
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className="group-card"
              onClick={() => handleGroupClick(group.id)}
            >
              <div className="group-icon">
                {group.name?.charAt(0).toUpperCase() || 'G'}
              </div>
              <div className="group-info">
                <h3 className="group-name">{group.name}</h3>
                <p className="group-description">
                  {group.description || 'No description'}
                </p>
                <div className="group-meta">
                  <span className="member-count">
                    {group.member_count || 0} members
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GroupList;
