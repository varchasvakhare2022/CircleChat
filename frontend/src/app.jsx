import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { ClerkProvider, useAuth, useUser, SignIn, SignUp } from '@clerk/clerk-react';
import GroupList from './components/grouplist';
import CreateGroup from './components/creategroup';
import Chatroom from './components/chatroom';
import InviteLink from './components/invitelink';
import VoiceCall from './components/voicecall';
import './styles.css';

// Get Clerk publishable key from environment or use a default
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

const App = () => {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="error-screen">
        <p>Missing Clerk Publishable Key. Please set VITE_CLERK_PUBLISHABLE_KEY in your .env file</p>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <Router>
        <AppRoutes />
      </Router>
    </ClerkProvider>
  );
};

const AppRoutes = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  const PrivateRoute = ({ children }) => {
    return isSignedIn ? children : <Navigate to="/sign-in" />;
  };

  return (
    <Routes>
      <Route
        path="/sign-in/*"
        element={
          isSignedIn ? (
            <Navigate to="/groups" replace />
          ) : (
            <div className="auth-container">
              <SignIn 
                routing="path" 
                path="/sign-in" 
                signUpUrl="/sign-up"
                afterSignInUrl="/groups"
                redirectUrl="/groups"
              />
            </div>
          )
        }
      />
      <Route
        path="/sign-up/*"
        element={
          isSignedIn ? (
            <Navigate to="/groups" replace />
          ) : (
            <div className="auth-container">
              <SignUp 
                routing="path" 
                path="/sign-up" 
                signInUrl="/sign-in"
                afterSignUpUrl="/groups"
                redirectUrl="/groups"
              />
            </div>
          )
        }
      />
      <Route
        path="/groups"
        element={
          <PrivateRoute>
            <GroupList />
          </PrivateRoute>
        }
      />
      <Route
        path="/create-group"
        element={
          <PrivateRoute>
            <CreateGroup />
          </PrivateRoute>
        }
      />
      <Route
        path="/group/:groupId"
        element={
          <PrivateRoute>
            <Chatroom />
          </PrivateRoute>
        }
      />
      <Route
        path="/group/:groupId/invite"
        element={
          <PrivateRoute>
            <InviteLink />
          </PrivateRoute>
        }
      />
      <Route
        path="/group/:groupId/call"
        element={
          <PrivateRoute>
            <VoiceCall />
          </PrivateRoute>
        }
      />
      <Route
        path="/join/:inviteCode"
        element={
          <PrivateRoute>
            <JoinGroup />
          </PrivateRoute>
        }
      />
      <Route
        path="/join-group"
        element={
          <PrivateRoute>
            <JoinGroupPrompt />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to={isSignedIn ? "/groups" : "/sign-in"} replace />} />
      <Route path="/login" element={<Navigate to="/sign-in" replace />} />
      {/* Catch-all for Clerk internal routes */}
      <Route path="*" element={
        isSignedIn ? (
          <Navigate to="/groups" replace />
        ) : (
          <Navigate to="/sign-in" replace />
        )
      } />
    </Routes>
  );
};

// Join Group Component
const JoinGroup = () => {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (inviteCode) {
      handleJoin();
    }
  }, [inviteCode]);

  const handleJoin = async () => {
    try {
      setLoading(true);
      setError('');
      const { invitesAPI } = await import('./services/api');
      // Clean the invite code - remove any URL parts if present
      let code = inviteCode.trim();
      // Extract code from URL if full URL was provided
      if (code.includes('/join/')) {
        code = code.split('/join/')[1];
      }
      code = code.split('?')[0]; // Remove query params
      code = code.trim().toUpperCase();
      
      console.log('Joining with invite code:', code);
      const result = await invitesAPI.acceptInvite(code);
      console.log('Join result:', result);
      navigate('/groups');
    } catch (err) {
      console.error('Join error:', err);
      let errorMsg = 'Failed to join group';
      
      if (err.response) {
        errorMsg = err.response.data?.detail || err.response.data?.message || `Server error: ${err.response.status}`;
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      if (errorMsg.includes('Network Error') || errorMsg.includes('timeout') || errorMsg.includes('Cannot connect')) {
        errorMsg += '\n\nTroubleshooting:\n- Ensure the backend server is running\n- Check if you can access the backend from this device\n- Verify the network connection';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-screen">Joining group...</div>;
  }

  if (error) {
    return (
      <div className="error-screen">
        <p>{error}</p>
        <button onClick={() => navigate('/groups')}>Go to Groups</button>
      </div>
    );
  }

  return null;
};

// Join Group Prompt Component
const JoinGroupPrompt = () => {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    try {
      setLoading(true);
      setError('');
      const { invitesAPI } = await import('./services/api');
      // Clean the invite code
      let code = inviteCode.trim();
      // Extract code from URL if full URL was provided
      if (code.includes('/join/')) {
        code = code.split('/join/')[1];
      }
      code = code.split('?')[0]; // Remove query params
      code = code.trim().toUpperCase();
      
      console.log('Joining with invite code:', code);
      const result = await invitesAPI.acceptInvite(code);
      console.log('Join result:', result);
      navigate('/groups');
    } catch (err) {
      console.error('Join error:', err);
      let errorMsg = 'Failed to join group';
      
      if (err.response) {
        // Server responded with error
        errorMsg = err.response.data?.detail || err.response.data?.message || `Server error: ${err.response.status}`;
      } else if (err.message) {
        // Network or other error
        errorMsg = err.message;
      }
      
      // Add helpful network troubleshooting
      if (errorMsg.includes('Network Error') || errorMsg.includes('timeout') || errorMsg.includes('Cannot connect')) {
        errorMsg += '\n\nTroubleshooting:\n- Ensure the backend server is running\n- Check if you can access the backend from this device\n- Verify the network connection';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-group-container">
      <div className="join-group-card">
        <h2>Join Group</h2>
        <p>Enter the invite code to join a group</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Enter invite code"
            className="invite-code-input"
          />
          {error && <div className="error-message">{error}</div>}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/groups')}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !inviteCode.trim()}
              className="submit-button"
            >
              {loading ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;
