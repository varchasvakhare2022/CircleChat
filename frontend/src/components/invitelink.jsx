import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invitesAPI, groupsAPI } from '../services/api';
import './invitelink.css';

const InviteLink = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadInvite();
  }, [groupId]);

  const loadInvite = async () => {
    try {
      setLoading(true);
      const invite = await invitesAPI.createInvite(groupId);
      setInviteCode(invite.code || invite.invite_code);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create invite link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteCode) return;
    
    const inviteUrl = `${window.location.origin}/join/${inviteCode}`;
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = inviteUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
          setError('Failed to copy link. Please copy manually: ' + inviteUrl);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy link. Please copy manually: ' + inviteUrl);
    }
  };

  const handleJoinGroup = async () => {
    const code = prompt('Enter invite code:');
    if (code) {
      try {
        setLoading(true);
        await invitesAPI.acceptInvite(code);
        navigate('/groups');
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to join group');
      } finally {
        setLoading(false);
      }
    }
  };

  const inviteUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : '';

  return (
    <div className="invite-link-container">
      <div className="invite-link-header">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="back-button"
        >
          ←
        </button>
        <h2>Invite Friends</h2>
      </div>

      <div className="invite-link-content">
        <div className="invite-link-card">
          <p className="subtitle">Share this link with your friends to join the group</p>

          {loading && !inviteCode ? (
            <div className="loading">Generating invite link...</div>
          ) : (
            <>
              <div className="invite-link-section">
                <div className="invite-link-box">
                  <input
                    type="text"
                    value={inviteUrl}
                    readOnly
                    className="invite-link-input"
                  />
                  <button
                    onClick={copyToClipboard}
                    className={`copy-button ${copied ? 'copied' : ''}`}
                    disabled={!inviteCode}
                  >
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                </div>
                
                <div className="invite-code-display">
                  <p className="invite-code">Invite Code</p>
                  <strong>{inviteCode}</strong>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="invite-actions">
                <button
                  onClick={() => navigate(`/group/${groupId}`)}
                  className="back-button"
                >
                  Back
                </button>
                <button
                  onClick={loadInvite}
                  className="refresh-button"
                  disabled={loading}
                >
                  Generate New Link
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteLink;

