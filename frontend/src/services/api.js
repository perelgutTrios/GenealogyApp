import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  // Register with GEDCOM file
  registerWithGedcom: async (data) => {
    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);
    formData.append('confirmPassword', data.confirmPassword);
    formData.append('givenNames', data.givenNames);
    formData.append('familyNames', data.familyNames);
    
    if (data.gedcomFile) {
      formData.append('gedcomFile', data.gedcomFile);
    }

    const response = await api.post('/auth/register-gedcom', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Register without GEDCOM (first GEDCOM entry)
  registerFirstGedcom: async (data) => {
    const response = await api.post('/auth/register-first-gedcom', data);
    return response.data;
  },

  // Verify email
  verifyEmail: async (data) => {
    const response = await api.post('/auth/verify-email', data);
    return response.data;
  },

  // Login
  login: async (data) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Logout
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

export const gedcomService = {
  // Get GEDCOM stats
  getStats: async () => {
    const response = await api.get('/gedcom/stats');
    return response.data;
  },

  // Get GEDCOM data
  getData: async () => {
    const response = await api.get('/gedcom/data');
    return response.data;
  },
};

// AI Research Service for genealogical AI features
export const aiResearchService = {
  /**
   * Generate AI-powered search queries for a person
   */
  generateQueries: async (personId) => {
    const response = await api.post('/ai-research/generate-queries', { personId });
    return response.data;
  },

  /**
   * Search external sources for records
   */
  searchExternal: async (personId, searchQueries) => {
    const response = await api.post('/ai-research/search-external', { 
      personId, 
      searchQueries 
    });
    return response.data;
  },

  /**
   * Analyze a specific record match using AI
   */
  analyzeMatch: async (personId, recordId, recordData) => {
    const response = await api.post('/ai-research/analyze-match', { 
      personId, 
      recordId, 
      recordData 
    });
    return response.data;
  },

  /**
   * Get research suggestions for a person
   */
  getResearchSuggestions: async (personId) => {
    const response = await api.get(`/ai-research/suggestions/${personId}`);
    return response.data;
  }
};

// Helper function to handle API errors
export const handleApiError = (error) => {
  if (error.response?.data) {
    return error.response.data;
  }
  return {
    message: error.message || 'An unexpected error occurred',
  };
};

export default api;