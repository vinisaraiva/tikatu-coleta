import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, testSupabaseConnection } from '../services/supabase';

interface Volunteer {
  id: number;
  code: string;
  nome: string;
  password_hash?: string; // Campo correto do banco
  point_id: number;
  is_active?: boolean;
  point: {
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
  };
}

interface AuthContextType {
  volunteer: Volunteer | null;
  isAuthenticated: boolean;
  login: (code: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('Verificando autenticação salva...');
      
      // No ambiente web, não restaurar sessão automaticamente
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        console.log('Ambiente web detectado, não restaurando sessão automaticamente');
        setVolunteer(null);
        setLoading(false);
        return;
      }
      
      const storedVolunteer = await AsyncStorage.getItem('volunteer');
      if (storedVolunteer) {
        const parsed = JSON.parse(storedVolunteer);
        console.log('Dados salvos encontrados:', parsed);
        
        // Validar se os dados são válidos
        if (parsed && parsed.id && parsed.code && parsed.nome) {
          console.log('Dados válidos, restaurando sessão...');
          setVolunteer(parsed);
        } else {
          console.log('Dados inválidos, limpando...');
          await AsyncStorage.removeItem('volunteer');
          setVolunteer(null);
        }
      } else {
        console.log('Nenhum dado salvo encontrado');
        setVolunteer(null);
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      // Limpar dados corrompidos
      await AsyncStorage.removeItem('volunteer');
      setVolunteer(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (code: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log('Tentando login com código:', code);

      // Testar conexão primeiro
      const connectionOk = await testSupabaseConnection();
      if (!connectionOk) {
        console.error('Falha na conexão com Supabase');
        return false;
      }

      // Buscar voluntário no Supabase (query simplificada)
      const { data, error } = await supabase
        .from('volunteers')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      console.log('Query completa - dados:', JSON.stringify(data, null, 2));
      console.log('Query completa - erro:', error);
      console.log('Campos disponíveis no data:', data ? Object.keys(data) : 'data é null');

      if (error) {
        console.error('Erro Supabase:', error);
        return false;
      }

      if (!data) {
        console.log('Voluntário não encontrado ou inativo');
        return false;
      }

      // Verificação de senha
      console.log('Verificando senha para voluntário:', data.code);
      
      if (!data.password_hash || data.password_hash.trim() === '') {
        console.log('❌ Voluntário não possui senha cadastrada');
        return false;
      }

      try {
        // Decodificar senha do banco (Base64)
        const senhaDecodificada = atob(data.password_hash);
        const senhaFornecida = password.trim();
        
        if (senhaFornecida !== senhaDecodificada) {
          console.log('❌ Senha incorreta');
          return false;
        }
        
        console.log('✅ Senha válida');
      } catch (error) {
        console.error('❌ Erro ao decodificar senha:', error);
        return false;
      }

      // Buscar dados do ponto separadamente
      let volunteerData = { ...data };
      
      if (data.point_id) {
        console.log('Buscando dados do ponto...');
        const { data: pointData, error: pointError } = await supabase
          .from('points')
          .select(`
            *,
            river:rivers(
              *,
              city:cities(*)
            )
          `)
          .eq('id', data.point_id)
          .maybeSingle();
        
        if (pointError) {
          console.error('Erro ao buscar dados do ponto:', pointError);
        } else if (pointData) {
          volunteerData.point = pointData;
          console.log('Dados do ponto encontrados:', pointData);
        }
      }

      console.log('Voluntário encontrado:', volunteerData);
      console.log('Point ID do voluntário:', volunteerData.point_id);
      
      await AsyncStorage.setItem('volunteer', JSON.stringify(volunteerData));
      setVolunteer(volunteerData);
      return true;
    } catch (error) {
      console.error('Erro no login:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('=== INICIANDO LOGOUT ===');
      console.log('Estado atual - volunteer:', volunteer);
      console.log('Estado atual - loading:', loading);
      
      // Limpar AsyncStorage
      console.log('Removendo dados do AsyncStorage...');
      await AsyncStorage.removeItem('volunteer');
      console.log('AsyncStorage limpo');
      
      // Limpar estado
      console.log('Limpando estado...');
      setVolunteer(null);
      setLoading(false);
      console.log('Estado limpo');
      
             // Verificar se estamos no ambiente web
       if (typeof window !== 'undefined') {
         console.log('Ambiente web detectado');
         console.log('Hostname:', window.location.hostname);
         
         // No web, sempre recarregar para garantir limpeza completa
         console.log('Recarregando página para limpeza completa...');
         setTimeout(() => {
           window.location.reload();
         }, 100);
         return;
       }
      
      console.log('Logout concluído com sucesso');
    } catch (error) {
      console.error('Erro no logout:', error);
      // Forçar limpeza mesmo com erro
      console.log('Forçando limpeza devido a erro...');
      setVolunteer(null);
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    volunteer,
    isAuthenticated: !!volunteer,
    login,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 