import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';

export interface Session {
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
}

interface SessionContextType {
    sessions: Session[];
    currentSession: Session | null;
    currentSessionId: string;
    loading: boolean;
    switchSession: (sessionId: string) => void;
    createSession: (name: string, description?: string) => Promise<Session>;
    updateSession: (sessionId: string, updates: { name?: string; description?: string }) => Promise<Session>;
    deleteSession: (sessionId: string) => Promise<void>;
    refreshSessions: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

const SESSION_KEY = 'asn-current-session';

export function SessionProvider({ children }: { children: ReactNode }) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
        return localStorage.getItem(SESSION_KEY) || 'default';
    });
    const [loading, setLoading] = useState(true);

    // Load sessions on mount
    useEffect(() => {
        axios.get<Session[]>('/api/sessions')
            .then(res => {
                setSessions(res.data);
                // Ensure current session exists
                if (res.data.length > 0 && !res.data.find(s => s.id === currentSessionId)) {
                    const defaultSession = res.data[0];
                    setCurrentSessionId(defaultSession.id);
                    localStorage.setItem(SESSION_KEY, defaultSession.id);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const currentSession = sessions.find(s => s.id === currentSessionId) || null;

    const switchSession = useCallback((sessionId: string) => {
        setCurrentSessionId(sessionId);
        localStorage.setItem(SESSION_KEY, sessionId);
        // Reload page to refresh all data for new session
        window.location.reload();
    }, []);

    const createSession = useCallback(async (name: string, description?: string): Promise<Session> => {
        const res = await axios.post<Session>('/api/sessions', { name, description });
        const newSession = res.data;
        setSessions(prev => [...prev, newSession]);
        return newSession;
    }, []);

    const updateSession = useCallback(async (sessionId: string, updates: { name?: string; description?: string }) => {
        const res = await axios.put<Session>(`/api/sessions/${sessionId}`, updates);
        setSessions(prev => prev.map(s => s.id === sessionId ? res.data : s));
        return res.data;
    }, []);

    const deleteSession = useCallback(async (sessionId: string) => {
        await axios.delete(`/api/sessions/${sessionId}`);
        setSessions(prev => {
            const remaining = prev.filter(s => s.id !== sessionId);
            // If deleting current session, switch to first available
            if (sessionId === currentSessionId && remaining.length > 0) {
                setCurrentSessionId(remaining[0].id);
                localStorage.setItem(SESSION_KEY, remaining[0].id);
            }
            return remaining;
        });
    }, [currentSessionId]);

    const refreshSessions = useCallback(async () => {
        const res = await axios.get<Session[]>('/api/sessions');
        setSessions(res.data);
    }, []);

    const value: SessionContextType = {
        sessions,
        currentSession,
        currentSessionId,
        loading,
        switchSession,
        createSession,
        updateSession,
        deleteSession,
        refreshSessions
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within SessionProvider');
    }
    return context;
}
