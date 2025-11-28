import { useState, useEffect, useRef } from 'react';
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
  const messagesEndRef = useRef(null);
  
  const isOwner = group && user && group.owner_id === user.id;

  // Set token getter for API
  useEffect(() => {
    import('../services/api').then(({ setGetToken }) => {
      setGetToken(getToken);
    });
  }, [getToken]);

  useEffect(() => {
    loadGroup();
    loadMessages();

    // Connect WebSocket
    if (groupId && getToken) {
      wsService.setGetToken(getToken);
      wsService.connect(groupId);

      // Set up message handlers
      const handleMessage = (data) => {
        if (data.type === 'message' || data.type === 'new_message') {
          setMessages(prev => [...prev, data]);
        }
      };

      wsService.on('message', handleMessage);

      return () => {
        wsService.off('message', handleMessage);
        wsService.disconnect();
      };
    }
  }, [groupId, getToken]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadGroup = async () => {
    try {
      const data = await groupsAPI.getGroup(groupId);
      setGroup(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load group');
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await messagesAPI.getMessages(groupId);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
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
    // If it's our own message, use our Clerk user info
    if (isOwnMessage(message) && user) {
      return user.firstName || user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'You';
    }
    // Otherwise use the username from the message
    return message.username || 'User';
  };

  return (
    <div className="chatroom-container">
      <div className="chatroom-header">
        <button onClick={handleBack} className="back-button">
          ← Back
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

      {showMembers && group && (
        <div className="members-panel">
          <div className="members-panel-header">
            <h3>Members ({group.member_count || 0})</h3>
            <button onClick={() => setShowMembers(false)} className="close-button">×</button>
          </div>
          <div className="members-list">
            {group.member_ids && group.member_ids.length > 0 ? (
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
