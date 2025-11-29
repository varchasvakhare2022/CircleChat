class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnecting = false;
    this.getToken = null;
  }

  setGetToken(fn) {
    this.getToken = fn;
  }

  async connect(groupId) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    try {
      let token = '';
      if (this.getToken) {
        token = await this.getToken();
      }
      
      // Use the same host as the current page for WebSocket
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostname = window.location.hostname;
      
      // Determine WebSocket host
      let wsHost;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        wsHost = 'localhost:8000';
      } else if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        // It's an IP address - use it for WebSocket
        wsHost = `${hostname}:8000`;
      } else {
        // Use the same hostname
        wsHost = `${hostname}:8000`;
      }
      
      const wsUrl = `${wsProtocol}//${wsHost}/ws/${groupId}${token ? `?token=${token}` : ''}`;
      console.log('WebSocket URL:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
          
          // Emit specific event types
          if (data.type) {
            this.emit(data.type, data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.emit('disconnected');
        this.attemptReconnect(groupId);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
    }
  }

  attemptReconnect(groupId) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(groupId);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('reconnect_failed');
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    } else {
      console.warn('WebSocket is not connected');
      return false;
    }
  }

  sendMessage(content) {
    return this.send({
      type: 'message',
      content
    });
  }

  startCall(callType, callerName) {
    return this.send({
      type: 'call_start',
      call_type: callType, // 'voice' or 'video'
      caller_name: callerName
    });
  }

  endCall() {
    return this.send({
      type: 'call_end'
    });
  }

  acceptCall(acceptorName) {
    return this.send({
      type: 'call_accept',
      acceptor_name: acceptorName
    });
  }

  declineCall() {
    return this.send({
      type: 'call_decline'
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.reconnectAttempts = 0;
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();
