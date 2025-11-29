import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { groupsAPI, messagesAPI } from '../services/api';
import wsService from '../services/ws';
import { formatTime } from '../utils/format';
import './chatroom.css';

const Chatroom = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null); // {caller_id, caller_name, call_type}
  const [userDisplayName, setUserDisplayName] = useState(null);
  const messagesEndRef = useRef(null);
  
  const isOwner = group && user && group.owner_id === user.id;

  // Set token getter for API
  useEffect(() => {
    import('../services/api').then(({ setGetToken }) => {
      setGetToken(getToken);
    });
  }, [getToken]);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await groupsAPI.getGroup(groupId);
      setGroup(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load group');
    }
  }, [groupId]);

  const loadMessages = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      const data = await messagesAPI.getMessages(groupId);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    
    loadGroup();
    loadMessages();
  }, [groupId, loadGroup, loadMessages]);

  useEffect(() => {
    if (!groupId || !getToken) return;

    // Connect WebSocket
    wsService.setGetToken(getToken);
    wsService.connect(groupId);

      // Set up message handlers
      const handleMessage = (data) => {
        if (data.type === 'message' || data.type === 'new_message') {
          // Ensure the message has the correct structure
          const messageData = {
            id: data.id || data.timestamp,
            user_id: data.user_id,
            username: data.username || 'User', // Use username from backend
            content: data.content,
            timestamp: data.timestamp,
            created_at: data.created_at || data.timestamp
          };
          setMessages(prev => [...prev, messageData]);
        }
      };

    // Handle incoming call notifications
    const handleIncomingCall = (data) => {
      if (data.type === 'incoming_call' && data.caller_id !== user?.id) {
        setIncomingCall({
          caller_id: data.caller_id,
          caller_name: data.caller_name || 'User',
          call_type: data.call_type || 'voice'
        });
        
        // Play notification sound (if browser allows)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQQ');
          audio.volume = 0.5;
          audio.play().catch(() => {}); // Ignore autoplay errors
        } catch (e) {
          // Sound not available, continue
        }
      } else if (data.type === 'call_ended' || data.type === 'call_declined') {
        setIncomingCall(null);
      }
    };

    wsService.on('message', handleMessage);
    wsService.on('incoming_call', handleIncomingCall);
    wsService.on('call_ended', handleIncomingCall);
    wsService.on('call_declined', handleIncomingCall);

    return () => {
      wsService.off('message', handleMessage);
      wsService.off('incoming_call', handleIncomingCall);
      wsService.off('call_ended', handleIncomingCall);
      wsService.off('call_declined', handleIncomingCall);
      // Don't disconnect WebSocket here - it's used by other components
    };
  }, [groupId, getToken, user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load user's display name on mount
  useEffect(() => {
    const loadUserDisplayName = async () => {
      if (user) {
        try {
          const { usersAPI } = await import('../services/api');
          const profile = await usersAPI.getProfile();
          if (profile?.display_name) {
            setUserDisplayName(profile.display_name);
          }
        } catch (e) {
          // Fallback to Clerk info
        }
      }
    };
    loadUserDisplayName();
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      // Send via WebSocket if connected, otherwise fallback to API
      if (wsService.isConnected()) {
        wsService.sendMessage(messageContent);
      } else {
        const message = await messagesAPI.sendMessage(groupId, messageContent);
        setMessages(prev => [...prev, message]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message');
      setNewMessage(messageContent); // Restore message on error
    }
  };

  const handleInvite = () => {
    navigate(`/group/${groupId}/invite`);
  };

  const handleBack = () => {
    navigate('/groups');
  };

  const handleCall = (type) => {
    navigate(`/group/${groupId}/call?type=${type}`);
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      const acceptorName = user?.firstName || user?.username || 'User';
      wsService.acceptCall(acceptorName);
      navigate(`/group/${groupId}/call?type=${incomingCall.call_type}`);
      setIncomingCall(null);
    }
  };

  const handleDeclineCall = () => {
    if (incomingCall) {
      wsService.declineCall();
      setIncomingCall(null);
    }
  };

  if (loading && !group) {
    return (
      <div className="chatroom-container">
        <div className="loading">Loading chat...</div>
      </div>
    );
  }

  const isOwnMessage = (message) => {
    if (!user) return false;
    return message.user_id === user.id;
  };

  const getDisplayName = (message) => {
    // If it's our own message, use our custom display name or Clerk user info
    if (isOwnMessage(message) && user) {
      if (userDisplayName) {
        return userDisplayName;
      }
      return user.firstName || user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'You';
    }
    // Otherwise use the username from the message (backend should have fetched display name)
    return message.username || 'User';
  };

  return (
    <div className="chatroom-container">
      <div className="chatroom-header">
        <button onClick={handleBack} className="back-button">
          ←
        </button>
        <div className="header-info">
          <h2>{group?.name || 'Group Chat'}</h2>
          <span className="member-count">
            {group?.member_count || 0} members
          </span>
        </div>
        <div className="header-actions">
          {isOwner && (
            <button onClick={handleInvite} className="invite-button" title="Create Invite Link">
              Invite
            </button>
          )}
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="members-button"
            title="View Members"
          >
            👥
          </button>
          <button
            onClick={() => handleCall('voice')}
            className="call-button voice"
            title="Voice Call"
          >
            📞
          </button>
          <button
            onClick={() => handleCall('video')}
            className="call-button video"
            title="Video Call"
          >
            📹
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {incomingCall && (
        <div className="incoming-call-notification">
          <div className="call-notification-content">
            <div className="call-notification-icon">
              {incomingCall.call_type === 'video' ? '📹' : '📞'}
            </div>
            <div className="call-notification-info">
              <h3>Incoming {incomingCall.call_type === 'video' ? 'Video' : 'Voice'} Call</h3>
              <p>{incomingCall.caller_name} is calling...</p>
            </div>
            <div className="call-notification-actions">
              <button onClick={handleAcceptCall} className="accept-call-button">
                ✓ Accept
              </button>
              <button onClick={handleDeclineCall} className="decline-call-button">
                ✕ Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {showMembers && group && (
        <div className="members-panel">
          <div className="members-panel-header">
            <h3>Members ({group.member_count || 0})</h3>
            <button onClick={() => setShowMembers(false)} className="close-button">×</button>
          </div>
          <div className="members-list">
            {group.members && group.members.length > 0 ? (
              group.members.map((member, index) => {
                const memberId = member.user_id || member;
                const displayName = member.display_name || (memberId === user?.id ? 'You' : memberId);
                const email = member.email || '';
                const isOwnerMember = memberId === group.owner_id;
                const isCurrentUser = memberId === user?.id;
                
                return (
                  <div key={memberId || index} className="member-item">
                    <div className="member-info">
                      <span className="member-name">
                        {isOwnerMember ? '👑 ' : ''}
                        {isCurrentUser ? 'You' : displayName}
                        {isOwnerMember && ' (Owner)'}
                      </span>
                      {email && (
                        <span className="member-email">{email}</span>
                      )}
                    </div>
                    {isOwner && !isCurrentUser && !isOwnerMember && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Remove ${displayName} from the group?`)) {
                            try {
                              await groupsAPI.removeMember(groupId, memberId);
                              await loadGroup(); // Refresh group data
                            } catch (err) {
                              setError(err.response?.data?.detail || 'Failed to remove member');
                            }
                          }
                        }}
                        className="remove-member-button"
                        title="Remove Member"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })
            ) : group.member_ids && group.member_ids.length > 0 ? (
              // Fallback to member_ids if members array not available
              group.member_ids.map((memberId, index) => (
                <div key={memberId || index} className="member-item">
                  <span className="member-id">
                    {memberId === group.owner_id ? '👑 ' : ''}
                    {memberId === user?.id ? 'You' : memberId}
                    {memberId === group.owner_id && ' (Owner)'}
                  </span>
                  {isOwner && memberId !== user?.id && memberId !== group.owner_id && (
                    <button
                      onClick={async () => {
                        if (window.confirm('Remove this member from the group?')) {
                          try {
                            await groupsAPI.removeMember(groupId, memberId);
                            await loadGroup(); // Refresh group data
                          } catch (err) {
                            setError(err.response?.data?.detail || 'Failed to remove member');
                          }
                        }
                      }}
                      className="remove-member-button"
                      title="Remove Member"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p>No members</p>
            )}
          </div>
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = isOwnMessage(message);
            const displayName = getDisplayName(message);
            return (
              <div
                key={message.id || message.timestamp}
                className={`message ${isOwn ? 'own' : 'other'}`}
              >
                {!isOwn && (
                  <div className="message-avatar">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="message-content">
                  {!isOwn && (
                    <div className="message-username">{displayName}</div>
                  )}
                  <div className="message-text">{message.content}</div>
                  <div className="message-time">
                    {formatTime(message.timestamp || message.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="message-input-container">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="message-input"
        />
        <button type="submit" className="send-button" disabled={!newMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default Chatroom;
