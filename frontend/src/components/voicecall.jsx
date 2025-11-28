import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import './voicecall.css';

const VoiceCall = () => {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const callType = searchParams.get('type') || 'voice';
  const isVideo = callType === 'video';

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [permissionStatus, setPermissionStatus] = useState('requesting'); // 'requesting', 'granted', 'denied', 'error'
  const [permissionError, setPermissionError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef([]);

  useEffect(() => {
    checkPermissionsAndInitialize();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideo]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

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
      setLocalStream(stream);
      setIsConnected(true);
      setPermissionStatus('granted');
      setError('');

      // TODO: Connect to WebRTC signaling server
      // This would typically involve creating an offer, exchanging ICE candidates, etc.
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

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
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

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    remoteStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    setRemoteStreams([]);
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
              remoteStreams.map((stream, index) => (
                <video
                  key={index}
                  ref={el => remoteVideoRefs.current[index] = el}
                  autoPlay
                  playsInline
                  className="remote-video"
                />
              ))
            ) : (
              <div className="waiting-message">
                <p>Waiting for others to join...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="voice-call-ui">
            <div className="call-icon">📞</div>
            <p className="call-status">
              {isConnected ? 'Connected' : 'Connecting...'}
            </p>
            {remoteStreams.length > 0 && (
              <p className="participants-count">
                {remoteStreams.length} participant{remoteStreams.length !== 1 ? 's' : ''}
              </p>
            )}
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

