import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callFunction, getSessionToken, setSessionToken, clearSessionToken } from '../services/api';

export interface Point {
  id: number;
  name: string;
  river: {
    id: number;
    name: string;
    city: {
      id: number;
      name: string;
    };
  };
  is_primary?: boolean;
}

interface Volunteer {
  id: number;
  code: string;
  nome: string;
  is_active?: boolean;
  points: Point[];
  point?: Point;
  point_id?: number;
}

interface AuthContextType {
  volunteer: Volunteer | null;
  selectedPointId: number | null;
  setSelectedPointId: (pointId: number | null) => void;
  isAuthenticated: boolean;
  errorMessage: string;
  login: (code: string, password: string) => Promise<boolean>;
  logout: (options?: { forceReload: boolean }) => Promise<boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Normaliza a estrutura de pontos vinda do servidor
function normalizePoints(rawPoints: any[]): Point[] {
  return (rawPoints || []).map((p: any) => ({
    id: p?.id || 0,
    name: p?.name || 'Ponto não informado',
    river: p?.river
      ? {
          id: p.river.id || 0,
          name: p.river.name || 'Rio não informado',
          city: p.river.city
            ? { id: p.river.city.id || 0, name: p.river.city.name || 'Cidade não informada' }
            : { id: 0, name: 'Cidade não informada' },
        }
      : { id: 0, name: 'Rio não informado', city: { id: 0, name: 'Cidade não informada' } },
    is_primary: p?.is_primary || false,
  }));
}

function buildVolunteer(raw: any): { volunteer: Volunteer; initialPointId: number | null } {
  const points = normalizePoints(raw?.points || []);
  const primaryPoint = points.find((p) => p.is_primary) || points[0] || null;
  const volunteer: Volunteer = {
    id: raw.id,
    code: raw.code || '',
    nome: raw.nome || 'Voluntário',
    is_active: raw.is_active !== undefined ? raw.is_active : true,
    points,
    point: primaryPoint || undefined,
    point_id: primaryPoint?.id || undefined,
  };
  return { volunteer, initialPointId: primaryPoint?.id ?? null };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Restaurar sessão ao iniciar
  useEffect(() => {
    let isMounted = true;

    const verifyAuth = async () => {
      try {
        const token = await getSessionToken();
        if (!token) {
          if (isMounted) setVolunteer(null);
          return;
        }

        // Validar sessão no servidor
        const result = await callFunction<{ volunteer: any }>('volunteer-auth', {
          action: 'validate',
          token,
        });

        const { volunteer: v, initialPointId } = buildVolunteer(result.volunteer);
        const storedPointId = await AsyncStorage.getItem('selectedPointId');
        const restoredPointId = storedPointId ? parseInt(storedPointId, 10) : initialPointId;

        if (isMounted) {
          setVolunteer(v);
          setSelectedPointId(restoredPointId);
        }
      } catch (error) {
        // Sessão inválida/expirada -> limpar
        console.warn('Sessão inválida, limpando dados locais');
        await clearSessionToken();
        await AsyncStorage.multiRemove(['volunteer', 'selectedPointId']);
        if (isMounted) {
          setVolunteer(null);
          setSelectedPointId(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifyAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (code: string, password: string): Promise<boolean> => {
    setErrorMessage('');
    setLoading(true);

    const codigoLimpo = code.trim();
    const senhaLimpa = password.trim();

    if (!codigoLimpo || !senhaLimpa) {
      setErrorMessage('Por favor, preencha todos os campos');
      setLoading(false);
      return false;
    }

    try {
      const result = await callFunction<{ token: string; volunteer: any }>('volunteer-auth', {
        action: 'login',
        code: codigoLimpo,
        password: senhaLimpa,
      });

      await setSessionToken(result.token);

      const { volunteer: v, initialPointId } = buildVolunteer(result.volunteer);

      await AsyncStorage.setItem('volunteer', JSON.stringify(v));
      await AsyncStorage.setItem('selectedPointId', initialPointId?.toString() || '');

      setVolunteer(v);
      setSelectedPointId(initialPointId);
      return true;
    } catch (error: any) {
      // Mensagem já vem tratada da Edge Function (ex.: "Código ou senha incorretos")
      setErrorMessage(error?.message || 'Não foi possível fazer login. Tente novamente.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (options: { forceReload: boolean } = { forceReload: true }) => {
    try {
      setLoading(true);

      const token = await getSessionToken();

      // Atualiza UI imediatamente
      setVolunteer(null);
      setSelectedPointId(null);
      setErrorMessage('');

      // Invalida sessão no servidor (best-effort)
      if (token) {
        try {
          await callFunction('volunteer-auth', { action: 'logout', token });
        } catch {
          // ignorar erro de rede no logout
        }
      }

      await clearSessionToken();
      await AsyncStorage.multiRemove(['volunteer', 'selectedPointId']);

      if (typeof window !== 'undefined' && options?.forceReload && (window as any)?.location) {
        setTimeout(() => {
          (window as any).location.replace('/');
        }, 200);
      }

      return true;
    } catch (error) {
      setVolunteer(null);
      setSelectedPointId(null);
      setErrorMessage('');
      return false;
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  const value: AuthContextType = {
    volunteer,
    selectedPointId,
    setSelectedPointId,
    isAuthenticated: !!volunteer,
    errorMessage,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Helper para obter o ponto atual (selecionado ou primário)
export const getCurrentPoint = (
  volunteer: Volunteer | null,
  selectedPointId: number | null
): Point | null => {
  if (!volunteer || !volunteer.points || volunteer.points.length === 0) {
    return null;
  }
  if (selectedPointId) {
    const selected = volunteer.points.find((p) => p.id === selectedPointId);
    if (selected) return selected;
  }
  return volunteer.points.find((p) => p.is_primary) || volunteer.points[0] || null;
};

export { AuthContext };
export type { Volunteer, AuthContextType };
