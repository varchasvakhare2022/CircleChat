import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import wsService from '../services/ws';
import { usersAPI } from '../services/api';
import './voicecall.css';

const VoiceCall = () => {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const callType = searchParams.get('type') || 'voice';
  const isVideo = callType === 'video';

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [participants, setParticipants] = useState(new Map()); // Map<userId, {name, isMuted}>
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [permissionStatus, setPermissionStatus] = useState('requesting'); // 'requesting', 'granted', 'denied', 'error'
  const [permissionError, setPermissionError] = useState(null);
  const { user } = useUser();
  const { getToken } = useAuth();

  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef([]);
  const remoteAudioRefs = useRef([]); // Audio elements for voice calls
  const peersRef = useRef(new Map()); // Store peer connections by user_id
  const localStreamRef = useRef(null);

  useEffect(() => {
    // Set token getter for WebSocket
    if (getToken) {
      wsService.setGetToken(getToken);
    }
    
    // Connect to WebSocket for this group and send call notification
    const initializeCall = async () => {
      if (groupId && getToken) {
        await wsService.connect(groupId);
        
        // Send call notification when call starts
        const callerName = user?.firstName || user?.username || 'User';
        wsService.startCall(callType, callerName);
        
        // Request list of current participants in the call
        // We'll create offers for all existing participants once we have local stream
        setTimeout(() => {
          if (localStreamRef.current) {
            // Broadcast that we're ready to receive connections
            wsService.send({
              type: 'call_participant_ready',
              user_id: user?.id,
              group_id: groupId
            });
          }
        }, 1000);
      }
    };
    
    initializeCall();
    checkPermissionsAndInitialize();
    
    return () => {
      // Send call end notification
      if (groupId) {
        wsService.endCall();
      }
      cleanup();
      // Don't disconnect WebSocket here - it might be used by chatroom
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideo, groupId, getToken]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    // Update remote video/audio elements when remote streams change
    console.log(`📹 Updating media elements. Total remote streams: ${remoteStreams.length}, isVideo: ${isVideo}`);
    remoteStreams.forEach((streamData, index) => {
      const stream = streamData.stream || streamData;
      
      if (isVideo) {
        // For video calls, use video elements
        const videoElement = remoteVideoRefs.current[index];
        if (videoElement) {
          if (videoElement.srcObject !== stream) {
            console.log(`🎥 Assigning stream ${index} to video element (userId: ${streamData.userId || 'unknown'})`);
            videoElement.srcObject = stream;
            videoElement.play().catch(err => {
              console.error(`❌ Error playing video ${index}:`, err);
            });
          }
        } else {
          console.warn(`⚠️ Video element ${index} not found in refs`);
        }
      } else {
        // For voice calls, use audio elements (created in JSX)
        const audioElement = remoteAudioRefs.current[index];
        if (audioElement) {
          if (audioElement.srcObject !== stream) {
            console.log(`🔊 Assigning audio stream ${index} to audio element (userId: ${streamData.userId || 'unknown'})`);
            audioElement.srcObject = stream;
            audioElement.play().catch(err => {
              console.error(`❌ Error playing audio ${index}:`, err);
            });
          }
        } else {
          console.warn(`⚠️ Audio element ${index} not found in refs yet (may be mounting)`);
        }
      }
    });
  }, [remoteStreams, isVideo]);

  // Separate effect to ensure audio elements are assigned streams after mount
  useEffect(() => {
    if (!isVideo && remoteStreams.length > 0) {
      // For voice calls, ensure all audio elements have their streams assigned
      remoteStreams.forEach((streamData, index) => {
        const stream = streamData.stream || streamData;
        const audioElement = remoteAudioRefs.current[index];
        if (audioElement && audioElement.srcObject !== stream) {
          console.log(`🔊 [Delayed] Assigning audio stream ${index} to audio element`);
          audioElement.srcObject = stream;
          audioElement.play().catch(err => {
            console.error(`❌ Error playing audio ${index} (delayed):`, err);
          });
        }
      });
    }
  }, [remoteStreams, isVideo]);

  useEffect(() => {
    if (!groupId) return;

    // Listen for WebRTC signaling messages via WebSocket
    const handleWebRTCMessage = (data) => {
      console.log('📨 WebRTC message received:', data.type, data);
      
      if (data.type === 'webrtc_offer') {
        console.log('📞 Received offer from:', data.caller_id);
        handleOffer(data);
      } else if (data.type === 'webrtc_answer') {
        console.log('✅ Received answer from:', data.answerer_id);
        handleAnswer(data);
      } else if (data.type === 'webrtc_ice_candidate') {
        console.log('🧊 Received ICE candidate from:', data.sender_id);
        handleIceCandidate(data);
      } else if (data.type === 'user_joined' && data.user_id !== user?.id) {
        console.log('👤 User joined:', data.user_id);
        // New user joined, create offer if we have local stream
        if (localStreamRef.current) {
          console.log('Creating offer for newly joined user:', data.user_id);
          setTimeout(() => createOfferForUser(data.user_id), 500);
        } else {
          console.log('Cannot create offer: local stream not ready yet');
        }
      } else if (data.type === 'call_participant_ready' && data.user_id !== user?.id) {
        console.log('🎥 Participant ready:', data.user_id);
        // Another participant is ready, create offer for them
        if (localStreamRef.current) {
          console.log('Creating offer for ready participant:', data.user_id);
          setTimeout(() => createOfferForUser(data.user_id), 500);
        } else {
          console.log('Cannot create offer: local stream not ready yet');
        }
      } else if (data.type === 'call_participants_list') {
        console.log('📋 Received participants list:', data.participants);
        // Received list of existing participants, create offers for all
        if (localStreamRef.current && data.participants && data.participants.length > 0) {
          data.participants.forEach((participantId, index) => {
            if (participantId !== user?.id && !peersRef.current.has(participantId)) {
              console.log(`Creating offer for participant ${index + 1}/${data.participants.length}:`, participantId);
              setTimeout(() => createOfferForUser(participantId), 500 + (index * 200));
              // Fetch participant name
              fetchParticipantName(participantId);
            }
          });
        } else {
          console.log('No participants to connect to or local stream not ready');
        }
      } else if (data.type === 'participant_mute_status' && data.user_id !== user?.id) {
        console.log(`🔇 Mute status update from ${data.user_id}:`, data.is_muted);
        setParticipants(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.user_id) || { name: 'User' };
          newMap.set(data.user_id, { ...existing, isMuted: data.is_muted });
          return newMap;
        });
      } else if (data.type === 'user_joined' && data.user_id !== user?.id) {
        // Fetch name for newly joined user
        fetchParticipantName(data.user_id);
      }
    };

    wsService.on('webrtc_offer', handleWebRTCMessage);
    wsService.on('webrtc_answer', handleWebRTCMessage);
    wsService.on('webrtc_ice_candidate', handleWebRTCMessage);
    wsService.on('user_joined', handleWebRTCMessage);
    wsService.on('call_participant_ready', handleWebRTCMessage);
    wsService.on('call_participants_list', handleWebRTCMessage);

    return () => {
      wsService.off('webrtc_offer', handleWebRTCMessage);
      wsService.off('webrtc_answer', handleWebRTCMessage);
      wsService.off('webrtc_ice_candidate', handleWebRTCMessage);
      wsService.off('user_joined', handleWebRTCMessage);
      wsService.off('call_participant_ready', handleWebRTCMessage);
      wsService.off('call_participants_list', handleWebRTCMessage);
    };
  }, [user?.id, groupId]);

  const checkPermissionsAndInitialize = async () => {
    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Your browser does not support camera/microphone access.');
      setPermissionStatus('error');
      return;
    }

    // Check permission status if available
    try {
      if (navigator.permissions) {
        const audioPermission = await navigator.permissions.query({ name: 'microphone' });
        const videoPermission = isVideo ? await navigator.permissions.query({ name: 'camera' }) : null;

        audioPermission.onchange = () => {
          if (audioPermission.state === 'granted') {
            requestMediaAccess();
          }
        };

        if (videoPermission) {
          videoPermission.onchange = () => {
            if (videoPermission.state === 'granted') {
              requestMediaAccess();
            }
          };
        }

        if (audioPermission.state === 'denied' || (videoPermission && videoPermission.state === 'denied')) {
          setPermissionStatus('denied');
          setError('Camera/microphone permissions were denied. Please enable them in your browser settings.');
          return;
        }
      }
    } catch (err) {
      // Permissions API might not be supported, continue with request
      console.log('Permissions API not fully supported, proceeding with request');
    }

    // Request media access
    await requestMediaAccess();
  };

  const requestMediaAccess = async () => {
    try {
      setPermissionStatus('requesting');
      setError('');
      setPermissionError(null);

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: isVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Got local media stream:', stream);
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsConnected(true);
      setPermissionStatus('granted');
      setError('');

      // Notify that we're ready and request existing participants
      if (groupId && user?.id) {
        console.log('📢 Notifying that we are ready for call');
        const sent = wsService.send({
          type: 'call_participant_ready',
          user_id: user.id,
          group_id: groupId
        });
        if (!sent) {
          console.error('❌ Failed to send call_participant_ready: WebSocket not connected');
        }
        
        // Add current user to participants list
        const currentUserName = user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'You';
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(user.id, { name: currentUserName, isMuted: false });
          return newMap;
        });
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setPermissionStatus('denied');
      
      let errorMessage = 'Failed to access camera/microphone. ';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow camera/microphone access when prompted, or enable permissions in your browser settings.';
        setPermissionError('permission-denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera or microphone found. Please connect a device and try again.';
        setPermissionError('device-not-found');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage += 'Camera or microphone is already in use by another application.';
        setPermissionError('device-in-use');
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMessage += 'Camera/microphone does not support the required settings.';
        setPermissionError('constraint-error');
      } else {
        errorMessage += `Error: ${err.message || 'Unknown error occurred'}`;
        setPermissionError('unknown');
      }
      
      setError(errorMessage);
    }
  };

  const handleRetryPermissions = () => {
    requestMediaAccess();
  };

  const fetchParticipantName = async (userId) => {
    if (!userId || userId === user?.id) return;
    
    try {
      const profile = await usersAPI.getUserProfile(userId);
      const displayName = profile?.display_name || 
                         (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : null) ||
                         profile?.username || 
                         profile?.email?.split('@')[0] || 
                         'User';
      
      setParticipants(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(userId) || { isMuted: false };
        newMap.set(userId, { ...existing, name: displayName });
        return newMap;
      });
    } catch (err) {
      console.error(`Error fetching name for ${userId}:`, err);
      // Set default name
      setParticipants(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(userId) || { isMuted: false };
        newMap.set(userId, { ...existing, name: 'User' });
        return newMap;
      });
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const newMutedState = !isMuted;
      localStream.getAudioTracks().forEach(track => {
        track.enabled = newMutedState;
      });
      setIsMuted(newMutedState);
      
      // Broadcast mute status change
      if (groupId) {
        wsService.send({
          type: 'participant_mute_status',
          user_id: user?.id,
          is_muted: newMutedState,
          group_id: groupId
        });
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleEndCall = () => {
    cleanup();
    navigate(`/group/${groupId}`);
  };

  const setupWebRTC = async (stream) => {
    // When local stream is ready, create offers for all existing participants
    // We'll get notified of existing users via user_joined events
    console.log('WebRTC setup ready, waiting for participants...');
    
    // Request list of current participants (this will be handled via WebSocket)
    // For now, we wait for user_joined events to know when to create offers
  };

  const createPeerConnection = (userId) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log(`🎬 Received track from ${userId}:`, event);
      const [remoteStream] = event.streams;
      console.log(`📹 Remote stream received from ${userId}, tracks:`, remoteStream.getTracks().map(t => ({kind: t.kind, enabled: t.enabled, id: t.id})));
      
      // Store user_id with the stream using a Map or add to stream metadata
      // MediaStream.id is read-only, so we'll track it separately
      const streamWithUserId = {
        stream: remoteStream,
        userId: userId,
        id: `stream-${userId}`
      };
      
      setRemoteStreams(prev => {
        const existing = prev.find(s => s.id === streamWithUserId.id);
        if (existing) {
          console.log(`🔄 Stream from ${userId} already exists, updating...`);
          // Update existing stream
          return prev.map(s => s.id === streamWithUserId.id ? streamWithUserId : s);
        }
        console.log(`✅ Adding new stream from ${userId}, total streams: ${prev.length + 1}`);
        return [...prev, streamWithUserId];
      });
      
      // Fetch participant name when they join
      fetchParticipantName(userId);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        wsService.send({
          type: 'webrtc_ice_candidate',
          candidate: event.candidate,
          target_user_id: userId,
          group_id: groupId
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Peer connection state: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        // Remove peer connection
        peersRef.current.delete(userId);
        setRemoteStreams(prev => prev.filter(s => s.id !== `stream-${userId}`));
      }
    };

    peersRef.current.set(userId, peerConnection);
    return peerConnection;
  };

  const createOfferForUser = async (userId) => {
    if (!localStreamRef.current) {
      console.log(`❌ Cannot create offer for ${userId}: no local stream`);
      return;
    }
    
    // Check if we already have a connection or are in the process of connecting
    if (peersRef.current.has(userId)) {
      const existingPeer = peersRef.current.get(userId);
      if (existingPeer.signalingState !== 'stable') {
        console.log(`⏳ Already connecting to ${userId} (state: ${existingPeer.signalingState}), skipping...`);
        return;
      }
      // If stable and already connected, don't create another offer
      if (existingPeer.connectionState === 'connected') {
        console.log(`✅ Already connected to ${userId}, skipping offer creation`);
        return;
      }
      console.log(`🔄 Reusing existing peer connection for ${userId}`);
    }

    console.log(`🎬 Creating peer connection and offer for ${userId}`);
    const peerConnection = peersRef.current.get(userId) || createPeerConnection(userId);
    
    try {
      console.log(`📤 Creating offer for ${userId}...`);
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo
      });
      await peerConnection.setLocalDescription(offer);
      console.log(`✅ Offer created and local description set for ${userId}`);

      const sent = wsService.send({
        type: 'webrtc_offer',
        offer: offer,
        target_user_id: userId,
        group_id: groupId
      });
      
      if (sent) {
        console.log(`📤 Offer sent to ${userId}`);
      } else {
        console.error(`❌ Failed to send offer to ${userId}: WebSocket not connected`);
      }
    } catch (error) {
      console.error(`❌ Error creating offer for ${userId}:`, error);
      peersRef.current.delete(userId);
    }
  };

  const handleOffer = async (data) => {
    if (!localStreamRef.current) return;

    const { offer, caller_id } = data;
    let peerConnection = peersRef.current.get(caller_id);

    if (!peerConnection) {
      peerConnection = createPeerConnection(caller_id);
    }

    // Check if we're already processing this offer
    if (peerConnection.signalingState !== 'stable') {
      console.log(`Already processing offer from ${caller_id}, ignoring...`);
      return;
    }

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo
      });
      await peerConnection.setLocalDescription(answer);

      wsService.send({
        type: 'webrtc_answer',
        answer: answer,
        target_user_id: caller_id,
        group_id: groupId
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      peersRef.current.delete(caller_id);
    }
  };

  const handleAnswer = async (data) => {
    const { answer, answerer_id } = data;
    const peerConnection = peersRef.current.get(answerer_id);

    if (!peerConnection) {
      console.error(`No peer connection found for ${answerer_id}`);
      return;
    }

    // Check if we're in the right state to set remote description
    if (peerConnection.signalingState !== 'have-local-offer') {
      console.log(`Wrong signaling state for answer from ${answerer_id}: ${peerConnection.signalingState}`);
      return;
    }

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
      peersRef.current.delete(answerer_id);
    }
  };

  const handleIceCandidate = async (data) => {
    const { candidate, sender_id } = data;
    const peerConnection = peersRef.current.get(sender_id);

    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  const cleanup = () => {
    // Close all peer connections
    peersRef.current.forEach((peerConnection, userId) => {
      peerConnection.close();
    });
    peersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    remoteStreams.forEach(streamData => {
      const stream = streamData.stream || streamData;
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => track.stop());
      }
    });
    setRemoteStreams([]);
    
    // Clean up audio elements for voice calls
    remoteAudioRefs.current.forEach(audioElement => {
      if (audioElement && audioElement.parentNode) {
        audioElement.pause();
        audioElement.srcObject = null;
        audioElement.parentNode.removeChild(audioElement);
      }
    });
    remoteAudioRefs.current = [];
  };

  return (
    <div className={`call-container ${isVideo ? 'video-call' : 'voice-call'}`}>
      <div className="call-header">
        <h2>{isVideo ? 'Video Call' : 'Voice Call'}</h2>
        <button onClick={handleEndCall} className="end-call-button">
          End Call
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          {permissionStatus === 'denied' && (
            <div className="permission-actions">
              <button onClick={handleRetryPermissions} className="retry-permission-button">
                Request Permissions Again
              </button>
              <div className="permission-help">
                <p><strong>How to enable permissions:</strong></p>
                <ul>
                  <li><strong>Chrome/Edge:</strong> Click the lock icon in the address bar → Site settings → Allow camera and microphone</li>
                  <li><strong>Firefox:</strong> Click the shield icon → Permissions → Allow camera and microphone</li>
                  <li><strong>Safari:</strong> Safari → Settings → Websites → Camera/Microphone → Allow</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {permissionStatus === 'requesting' && !error && (
        <div className="permission-request">
          <p>Requesting camera/microphone permissions...</p>
          <p className="permission-hint">Please allow access when prompted by your browser.</p>
        </div>
      )}

      <div className="call-content">
        {isVideo ? (
          <div className="video-grid">
            {remoteStreams.length > 0 ? (
              remoteStreams.map((streamData, index) => {
                const stream = streamData.stream || streamData;
                console.log(`Rendering video ${index} for stream:`, streamData.id);
                return (
                  <video
                    key={streamData.id || index}
                    ref={el => {
                      if (el) {
                        remoteVideoRefs.current[index] = el;
                        // Immediately assign stream when element is created
                        if (el.srcObject !== stream) {
                          console.log(`🎥 Assigning stream to video element ${index}`);
                          el.srcObject = stream;
                          el.play().catch(err => console.error(`Error playing video ${index}:`, err));
                        }
                      }
                    }}
                    autoPlay
                    playsInline
                    muted={false}
                    className="remote-video"
                  />
                );
              })
            ) : (
              <div className="waiting-message">
                <p>Waiting for others to join... ({remoteStreams.length} streams detected)</p>
              </div>
            )}
          </div>
        ) : (
          <div className="voice-call-ui">
            <div className="call-icon">📞</div>
            <p className="call-status">
              {isConnected ? 'Connected' : 'Connecting...'}
            </p>
            
            {/* Participants list - WhatsApp style */}
            <div className="participants-list">
              {/* Current user */}
              {user?.id && participants.has(user?.id) && (
                <div className="participant-item">
                  <div className="participant-avatar">
                    {participants.get(user.id)?.name?.charAt(0)?.toUpperCase() || 'Y'}
                  </div>
                  <div className="participant-info">
                    <div className="participant-name">
                      {participants.get(user.id)?.name || 'You'}
                      <span className="participant-you"> (You)</span>
                    </div>
                    <div className="participant-status">
                      {isMuted ? '🔇 Muted' : '🔊 Speaking'}
                    </div>
                  </div>
                  <div className={`participant-mute-indicator ${isMuted ? 'muted' : ''}`}>
                    {isMuted ? '🔇' : '🔊'}
                  </div>
                </div>
              )}
              
              {/* Other participants */}
              {Array.from(participants.entries())
                .filter(([userId]) => userId !== user?.id)
                .map(([userId, participant]) => (
                  <div key={userId} className="participant-item">
                    <div className="participant-avatar">
                      {participant.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="participant-info">
                      <div className="participant-name">{participant.name || 'User'}</div>
                      <div className="participant-status">
                        {participant.isMuted ? '🔇 Muted' : '🔊 Speaking'}
                      </div>
                    </div>
                    <div className={`participant-mute-indicator ${participant.isMuted ? 'muted' : ''}`}>
                      {participant.isMuted ? '🔇' : '🔊'}
                    </div>
                  </div>
                ))}
              
              {participants.size === 0 && (
                <div className="waiting-participants">
                  <p>Waiting for others to join...</p>
                </div>
              )}
            </div>
            
            {/* Hidden audio elements for voice calls - these play the remote audio streams */}
            {remoteStreams.map((streamData, index) => {
              const stream = streamData.stream || streamData;
              return (
                <audio
                  key={streamData.id || `audio-${index}`}
                  ref={el => {
                    if (el) {
                      remoteAudioRefs.current[index] = el;
                      // Immediately assign stream when element is created
                      if (el.srcObject !== stream) {
                        console.log(`🔊 Assigning audio stream to audio element ${index}`);
                        el.srcObject = stream;
                        el.play().catch(err => console.error(`Error playing audio ${index}:`, err));
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  style={{ display: 'none' }}
                />
              );
            })}
          </div>
        )}

        {isVideo && localStream && (
          <div className="local-video-container">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
            />
          </div>
        )}
      </div>

      <div className="call-controls">
        <button
          onClick={toggleMute}
          className={`control-button ${isMuted ? 'muted' : ''}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>
        {isVideo && (
          <button
            onClick={toggleVideo}
            className={`control-button ${isVideoOff ? 'video-off' : ''}`}
            title={isVideoOff ? 'Turn on video' : 'Turn off video'}
          >
            {isVideoOff ? '📹' : '📹'}
          </button>
        )}
        <button
          onClick={handleEndCall}
          className="control-button end-call"
          title="End Call"
        >
          ❌
        </button>
      </div>
    </div>
  );
};

export default VoiceCall;

