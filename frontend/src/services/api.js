import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

// Use the same host as the current page for API calls
const getApiBaseUrl = () => {
  // First check environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Get the hostname from the current page
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // If accessing from localhost, use localhost for API
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  
  // For network IPs (192.168.x.x, 10.x.x.x, etc.), use the same hostname
  // Extract the IP from the current URL and use it for the API
  // The backend should be running on the same machine, so use the same IP
  if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    // It's an IP address - use it for the API
    return `http://${hostname}:8000`;
  }
  
  // Fallback: try to get the network IP from the current hostname
  // If frontend is on port 5173 and backend on 8000, use same hostname
  return `http://${hostname}:8000`;
};

const API_BASE_URL = getApiBaseUrl();
console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - backend may not be accessible');
      error.message = 'Connection timeout. Please check if the backend server is running and accessible.';
    } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      console.error('Network error - cannot reach backend:', API_BASE_URL);
      error.message = `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the backend is running and accessible on your network.`;
    } else if (error.response) {
      // Server responded with error status
      console.error('API error:', error.response.status, error.response.data);
    } else {
      console.error('Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Function to get auth token from Clerk
let getToken = null;

export const setGetToken = (fn) => {
  getToken = fn;
};

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
  }
  return config;
});

// Groups API
export const groupsAPI = {
  createGroup: async (name, description) => {
    const response = await api.post('/groups', { name, description });
    return response.data;
  },
  
  getGroups: async () => {
    const response = await api.get('/groups');
    return response.data;
  },
  
  getGroup: async (groupId) => {
    const response = await api.get(`/groups/${groupId}`);
    return response.data;
  },
  
  joinGroup: async (groupId) => {
    const response = await api.post(`/groups/${groupId}/join`);
    return response.data;
  },
  
  leaveGroup: async (groupId) => {
    const response = await api.delete(`/groups/${groupId}/leave`);
    return response.data;
  },
  
  removeMember: async (groupId, memberId) => {
    const response = await api.delete(`/groups/${groupId}/members/${memberId}`);
    return response.data;
  }
};

// Invites API
export const invitesAPI = {
  createInvite: async (groupId) => {
    const response = await api.post(`/invites`, { group_id: groupId });
    return response.data;
  },
  
  getInvite: async (inviteCode) => {
    const response = await api.get(`/invites/${inviteCode}`);
    return response.data;
  },
  
  acceptInvite: async (inviteCode) => {
    const response = await api.post(`/invites/${inviteCode}/accept`);
    return response.data;
  }
};

// Messages API
export const messagesAPI = {
  getMessages: async (groupId, limit = 50, offset = 0) => {
    const response = await api.get(`/groups/${groupId}/messages`, {
      params: { limit, offset }
    });
    return response.data;
  },
  
  sendMessage: async (groupId, content) => {
    const response = await api.post(`/groups/${groupId}/messages`, { content });
    return response.data;
  }
};

// Signaling API for WebRTC
export const signalingAPI = {
  createOffer: async (groupId, offer) => {
    const response = await api.post(`/signaling/offer`, { group_id: groupId, offer });
    return response.data;
  },
  
  createAnswer: async (groupId, answer) => {
    const response = await api.post(`/signaling/answer`, { group_id: groupId, answer });
    return response.data;
  },
  
  addIceCandidate: async (groupId, candidate) => {
    const response = await api.post(`/signaling/ice-candidate`, { group_id: groupId, candidate });
    return response.data;
  }
};

// Users API
export const usersAPI = {
  getProfile: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },
  
  updateProfile: async (displayName) => {
    const response = await api.put('/users/me', { display_name: displayName });
    return response.data;
  },
  
  getUserProfile: async (userId) => {
    const response = await api.get(`/users/profile/by-id/${userId}`);
    return response.data;
  }
};

export default api;
