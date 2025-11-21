export const API_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

// ============================================================================
// AUTHENTICATION INTERFACES & FUNCTIONS
// ============================================================================

interface SignUpData {
  fullName: string;
  email: string;
  password: string;
}

interface SignInData {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    role?: string;
  };
}

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

// Authentication API
export const authAPI = {
  /**
   * Sign up a new user
   */
  signUp: async (userData: SignUpData): Promise<AuthResponse> => {
    const url = `${API_BASE_URL}/api/auth/register`;
    
    console.log('🔐 Signing up:', { email: userData.email, url });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: userData.fullName,
          email: userData.email,
          password: userData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store token if provided
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      console.log('✅ Sign up successful');
      return data;
      
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      throw error;
    }
  },

  /**
   * Sign in existing user
   */
  signIn: async (credentials: SignInData): Promise<AuthResponse> => {
    const url = `${API_BASE_URL}/api/auth/login`;
    
    console.log('🔐 Signing in:', { email: credentials.email, url });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store token and user info
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      console.log('✅ Sign in successful');
      return data;
      
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      throw error;
    }
  },

  /**
   * Sign out current user
   */
  signOut: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('👋 Signed out');
  },

  /**
   * Get current user from localStorage
   */
  getCurrentUser: (): User | null => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },

  /**
   * Get authentication token
   */
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },
};

// ============================================================================
// SCREENING INTERFACES & FUNCTIONS (Your existing code)
// ============================================================================

interface ScreenRequest {
  name: string;
  type?: string;
  country?: string;
  date_of_birth?: string;
}

interface AISummary {
  summary: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  key_factors: string[];
}

export interface EnhancedMatch {
  entity_name: string;
  entity_type: string;
  list_source: string;
  program: string;
  nationalities: string[];
  date_of_birth: string;
  match_score: number;
  aliases?: string[];
  akas?: string[];
  positions?: string[];
  countries?: string[];
  dates?: string[];
  details?: Record<string, any>;
}

export interface EnhancedSearchResult {
  query: {
    name: string;
    country: string;
    date_of_birth: string;
  };
  total_matches: number;
  matches: EnhancedMatch[];
  ai_analysis: string | null;
  ai_explanation?: AISummary;
  risk_level: string;
  recommended_action: string;
  entity_name?: string;
  screening_timestamp?: string;
}

// Backend response structure (what we actually get)
interface BackendResponse {
  name: string;
  match_found: boolean;
  matches: Array<{
    name: string;
    list_type: string;
    confidence: number;
    details: string;
    program: string;
    nationalities: string;
    aliases: string;
    date_of_birth: string;
    place_of_birth: string;
    jurisdiction: string;
    remarks: string;
    is_pep: boolean;
  }>;
  risk_level: string;
  timestamp: string;
}

// Transform backend response to frontend format
function transformBackendResponse(backendData: BackendResponse, requestData: ScreenRequest): EnhancedSearchResult {
  // Convert backend matches to frontend format
  const transformedMatches: EnhancedMatch[] = backendData.matches.map(match => {
    // Parse aliases from comma-separated string
    const aliasesArray = match.aliases && match.aliases !== 'None' 
      ? match.aliases.split(',').map(a => a.trim()).filter(Boolean)
      : [];
    
    // Parse nationalities from comma-separated string
    const nationalitiesArray = match.nationalities && match.nationalities !== 'Not specified'
      ? match.nationalities.split(',').map(n => n.trim()).filter(Boolean)
      : [];

    return {
      entity_name: match.name,
      entity_type: match.is_pep ? 'individual' : 'entity',
      list_source: match.list_type,
      program: match.program,
      nationalities: nationalitiesArray,
      date_of_birth: match.date_of_birth,
      match_score: match.confidence,
      aliases: aliasesArray,
      akas: [], // Backend doesn't distinguish between aliases and AKAs
      positions: match.is_pep ? [match.program] : [],
      details: {
        place_of_birth: match.place_of_birth,
        jurisdiction: match.jurisdiction,
        remarks: match.remarks,
        full_details: match.details
      }
    };
  });

  // Determine recommended action based on risk level
  let recommendedAction = 'REVIEW';
  const riskLevelUpper = backendData.risk_level.toUpperCase();
  
  if (riskLevelUpper === 'CRITICAL' || riskLevelUpper === 'HIGH') {
    recommendedAction = 'ESCALATE';
  } else if (riskLevelUpper === 'MEDIUM') {
    recommendedAction = 'REVIEW';
  } else {
    recommendedAction = 'CLEAR';
  }

  return {
    query: {
      name: requestData.name,
      country: requestData.country || '',
      date_of_birth: requestData.date_of_birth || ''
    },
    total_matches: backendData.matches.length,
    matches: transformedMatches,
    ai_analysis: null, // Backend doesn't provide AI analysis yet
    risk_level: backendData.risk_level,
    recommended_action: recommendedAction,
    entity_name: requestData.name,
    screening_timestamp: backendData.timestamp
  };
}

export const screenEntity = async (data: ScreenRequest): Promise<EnhancedSearchResult> => {
  const url = `${API_BASE_URL}/api/screen`;
  
  console.log('🔍 Sending screening request:', {
    url,
    payload: {
      name: data.name,
      type: data.type || 'individual',
      nationality: data.country,
      use_ai: true
    }
  });
  
  try {
    // Get auth token if available
    const token = authAPI.getToken();
    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: data.name,  // ✅ Correct: "name" not "entity_name"
        type: data.type || 'individual',
        nationality: data.country,  // Backend uses "nationality" not "country"
        use_ai: true
      }),
    });
    
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`Screening failed (${response.status}): ${errorText}`);
    }
    
    const backendData: BackendResponse = await response.json();
    console.log('✅ Backend response:', backendData);
    
    // Transform backend response to match frontend expectations
    const transformedData = transformBackendResponse(backendData, data);
    console.log('🔄 Transformed data:', transformedData);
    
    return transformedData;
    
  } catch (error: any) {
    console.error('💥 Screening error:', error);
    throw error;
  }
};

export const getStats = async () => {
  const url = `${API_BASE_URL}/api/health`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Stats fetch failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform health response to stats format
    return {
      status: data.status,
      ai_enabled: data.ai_enabled,
      database: data.database
    };
  } catch (error: any) {
    console.error('Stats error:', error);
    throw error;
  }
};

export const getHealth = async () => {
  const url = `${API_BASE_URL}/api/health`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    return response.json();
  } catch (error: any) {
    console.error('Health check error:', error);
    throw error;
  }
};