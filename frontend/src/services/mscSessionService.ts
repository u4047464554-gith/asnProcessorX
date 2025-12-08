import axios from 'axios';

// API base URL
// API base URL
const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8000/api/msc'
  : '/api/msc';

export interface MscSession {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

class MscSessionService {
  private api: ReturnType<typeof axios.create>;

  constructor(baseURL: string = API_BASE_URL) {
    this.api = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 404) {
          throw new Error(`Session not found: ${error.response.data?.detail || error.message}`);
        }
        if (error.response?.status >= 500) {
          throw new Error(`Session service error: ${error.response.data?.detail || 'Server error'}`);
        }
        throw error;
      }
    );
  }

  async createSession(name: string, description?: string): Promise<MscSession> {
    const response = await this.api.post<MscSession>('/sessions', { name, description });
    return response.data;
  }

  async getSession(sessionId: string): Promise<MscSession | null> {
    try {
      const response = await this.api.get<MscSession>(`/sessions/${sessionId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listSessions(): Promise<MscSession[]> {
    const response = await this.api.get<MscSession[]>('/sessions');
    return response.data;
  }

  async updateSession(sessionId: string, name: string, description?: string): Promise<MscSession> {
    const response = await this.api.put<MscSession>(`/sessions/${sessionId}`, { name, description });
    return response.data;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await this.api.delete(`/sessions/${sessionId}`);
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }
}

export default new MscSessionService();

