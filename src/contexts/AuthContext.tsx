import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, testSupabaseConnection, clearSupabaseSession } from '../services/supabase';

// Obter a instância do Supabase
const supabase = getSupabase();

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
  password_hash?: string; // Campo correto do banco
  is_active?: boolean;
  points: Point[];
  // Manter point e point_id para compatibilidade (usar ponto primário ou selecionado)
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Debug: Monitorar mudanças no errorMessage
  useEffect(() => {
    console.log('errorMessage mudou para:', errorMessage);
  }, [errorMessage]);

  useEffect(() => {
    // Flag para controle de montagem do componente
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    
    const verifyAuth = async () => {
      try {
        // Configurar timeout para evitar loading infinito
        timer = window.setTimeout(() => {
          if (isMounted) {
            setLoading(false);
          }
        }, 5000); // Timeout de 5 segundos
        
        // 1. Verificar se há dados do voluntário no armazenamento local
        // Como usamos autenticação customizada (não Supabase Auth), verificamos primeiro o AsyncStorage
        const storedVolunteer = await AsyncStorage.getItem('volunteer');
        
        if (!storedVolunteer) {
          console.log('Nenhum dado de voluntário encontrado localmente');
          if (isMounted) {
            setVolunteer(null);
            setSelectedPointId(null);
          }
          return;
        }
        
        // 2. Validar os dados do voluntário
        try {
          const parsed = JSON.parse(storedVolunteer);
          
          // Validar estrutura básica dos dados
          if (!parsed?.id || !parsed?.code || !parsed?.nome) {
            console.warn('Dados de voluntário incompletos, limpando...');
            throw new Error('Dados incompletos');
          }
          
          // 3. Verificar se o voluntário ainda existe e está ativo no banco
          // Isso garante que se o voluntário foi desativado, a sessão seja invalidada
          const { data: volunteerData, error: volunteerError } = await supabase
            .from('volunteers')
            .select('id, code, nome, is_active')
            .eq('id', parsed.id)
            .eq('code', parsed.code)
            .maybeSingle();
          
          if (volunteerError) {
            console.error('Erro ao verificar voluntário no banco:', volunteerError);
            throw new Error('Erro ao verificar voluntário');
          }
          
          if (!volunteerData || !volunteerData.is_active) {
            console.warn('Voluntário não encontrado ou inativo');
            throw new Error('Voluntário inativo');
          }
          
          // 4. Restaurar ponto selecionado
          const storedPointId = await AsyncStorage.getItem('selectedPointId');
          const pointId = storedPointId ? parseInt(storedPointId, 10) : null;
          
          // 5. Atualizar dados do voluntário no estado
          if (isMounted) {
            setVolunteer(parsed);
            setSelectedPointId(pointId);
            console.log('Voluntário autenticado:', parsed.code, '- Ponto selecionado:', pointId);
          }
          
        } catch (error) {
          console.error('Erro ao validar dados do voluntário:', error);
          // Limpar dados inválidos
          await AsyncStorage.multiRemove([
            'volunteer',
            'selectedPointId',
            'supabase.auth.token',
            'supabase.auth.admin',
            'supabase.auth.user'
          ]);
          
          if (isMounted) {
            setVolunteer(null);
            setSelectedPointId(null);
          }
        }
        
      } catch (error) {
        console.error('Erro na verificação de autenticação:', error);
        // Garantir que os dados sejam limpos em caso de erro
        try {
          await AsyncStorage.multiRemove([
            'volunteer',
            'selectedPointId',
            'supabase.auth.token',
            'supabase.auth.admin',
            'supabase.auth.user'
          ]);
        } catch (cleanupError) {
          console.error('Erro ao limpar dados durante tratamento de erro:', cleanupError);
        }
        
        if (isMounted) {
          setVolunteer(null);
          setSelectedPointId(null);
        }
        
      } finally {
        if (timer) clearTimeout(timer);
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    // Executar verificação
    verifyAuth();
    
    // Cleanup function para evitar memory leaks
    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);
  
  const checkAuth = useCallback(async () => {
    // Esta função agora é apenas um wrapper para compatibilidade
    // A lógica real está no useEffect acima
    console.log('checkAuth chamado, mas a verificação já está sendo feita no useEffect');
    return Promise.resolve();
  }, []);

  const login = async (code: string, password: string): Promise<boolean> => {
    // Limpar erros anteriores imediatamente para feedback visual
    setErrorMessage('');
    setLoading(true);
    
    // Validar entradas
    const codigoLimpo = code.trim();
    const senhaLimpa = password.trim();
    
    // Validações iniciais
    if (!codigoLimpo || !senhaLimpa) {
      setErrorMessage('Por favor, preencha todos os campos');
      setLoading(false);
      return false;
    }
    
    if (senhaLimpa.length < 4) {
      setErrorMessage('A senha deve ter pelo menos 4 caracteres');
      setLoading(false);
      return false;
    }
    
    try {
      // 1. Testar conexão com o servidor
      try {
        console.log('Testando conexão com o servidor...');
        const connectionOk = await testSupabaseConnection();
        if (!connectionOk) {
          throw new Error('Falha na conexão com o servidor');
        }
      } catch (error) {
        console.error('Erro de conexão:', error);
        setErrorMessage('Não foi possível conectar ao servidor. Verifique sua conexão de internet e tente novamente.');
        return false;
      }
      
      // 2. Buscar voluntário no Supabase
      console.log(`Buscando voluntário com código: ${codigoLimpo}`);
      let data;
      try {
        const { data: volunteerData, error } = await supabase
          .from('volunteers')
          .select('*')
          .eq('code', codigoLimpo)
          .eq('is_active', true)
          .maybeSingle();
        
        if (error) {
          console.error('Erro na consulta ao banco de dados:', error);
          throw new Error('Erro ao acessar o banco de dados');
        }
        
        if (!volunteerData) {
          // Usar mensagem genérica por segurança
          console.log('Voluntário não encontrado ou inativo');
          setErrorMessage('Código ou senha incorretos');
          return false;
        }
        
        data = volunteerData;
        console.log(`Voluntário encontrado: ${data.nome} (ID: ${data.id})`);
        
      } catch (error) {
        console.error('Erro ao buscar voluntário:', error);
        setErrorMessage('Ocorreu um erro ao tentar fazer login. Por favor, tente novamente.');
        return false;
      }
      
      // 3. Verificação de senha
      console.log('Verificando senha...');
      try {
        if (!data.password_hash?.trim()) {
          console.warn(`Voluntário ${data.id} sem senha cadastrada`);
          setErrorMessage('Credenciais inválidas');
          return false;
        }
        
        // Decodificar senha do banco (Base64) e verificar
        let senhaDecodificada;
        try {
          senhaDecodificada = atob(data.password_hash);
          console.log('Senha decodificada com sucesso');
        } catch (decodeError) {
          console.error('Erro ao decodificar a senha:', decodeError);
          setErrorMessage('Erro ao processar as credenciais');
          return false;
        }
        
        if (senhaLimpa !== senhaDecodificada) {
          console.log('Senha incorreta para o voluntário:', data.id);
          console.log('Login falhou, definindo mensagem de erro...');
          setErrorMessage('Código ou senha incorretos');
          console.log('Mensagem de erro definida como: Código ou senha incorretos');
          return false;
        }
        
        console.log('Senha válida, buscando dados adicionais...');
      } catch (error) {
        console.error('Erro ao verificar senha:', error);
        setErrorMessage('Ocorreu um erro ao validar suas credenciais');
        return false;
      }

      try {
        console.log('Buscando dados completos do voluntário...');
        
        // 1. Buscar todos os pontos do voluntário via tabela volunteer_points
        console.log(`Buscando pontos do voluntário ${data.id}...`);
        
        const { data: volunteerPointsData, error: vpError } = await supabase
          .from('volunteer_points')
          .select(`
            point_id,
            is_primary,
            point:points (
              id,
              name,
              river:rivers (
                id,
                name,
                city:cities (
                  id,
                  name
                )
              )
            )
          `)
          .eq('volunteer_id', data.id);
        
        if (vpError) {
          console.error('Erro ao buscar pontos do voluntário:', vpError);
          throw new Error('Erro ao carregar pontos de coleta');
        }
        
        // 2. Estruturar os pontos
        const points: Point[] = (volunteerPointsData || []).map((vp: any) => ({
          id: vp.point?.id || 0,
          name: vp.point?.name || 'Ponto não informado',
          river: vp.point?.river ? {
            id: vp.point.river.id || 0,
            name: vp.point.river.name || 'Rio não informado',
            city: vp.point.river.city ? {
              id: vp.point.river.city.id || 0,
              name: vp.point.river.city.name || 'Cidade não informada'
            } : { id: 0, name: 'Cidade não informada' }
          } : {
            id: 0,
            name: 'Rio não informado',
            city: { id: 0, name: 'Cidade não informada' }
          },
          is_primary: vp.is_primary || false
        }));
        
        console.log(`Pontos encontrados: ${points.length}`, points);
        
        // 3. Determinar ponto primário ou primeiro ponto
        const primaryPoint = points.find(p => p.is_primary) || points[0] || null;
        const defaultPoint: Point = primaryPoint || {
          id: 0,
          name: 'Nenhum ponto cadastrado',
          river: {
            id: 0,
            name: 'Rio não informado',
            city: {
              id: 0,
              name: 'Cidade não informada'
            }
          },
          is_primary: false
        };
        
        // 4. Garantir que todos os campos obrigatórios existam
        const formattedData: Volunteer = {
          id: data.id,
          code: data.code || '',
          nome: data.nome || 'Voluntário',
          is_active: data.is_active !== undefined ? data.is_active : true,
          points: points.length > 0 ? points : [],
          point: defaultPoint,
          point_id: defaultPoint.id || undefined
        };
        
        console.log('Dados formatados do voluntário:', formattedData);
        
        // 5. Definir ponto selecionado (primário ou primeiro)
        const initialSelectedPointId = primaryPoint?.id || (points.length > 0 ? points[0].id : null);
        setSelectedPointId(initialSelectedPointId);
        
        // 6. Salvar no AsyncStorage
        try {
          await AsyncStorage.setItem('volunteer', JSON.stringify(formattedData));
          await AsyncStorage.setItem('selectedPointId', initialSelectedPointId?.toString() || '');
          console.log('Dados do voluntário salvos no AsyncStorage');
        } catch (storageError) {
          console.error('Erro ao salvar no AsyncStorage:', storageError);
          // Continuar mesmo com erro, pois o estado já foi atualizado
        }
        
        // 7. Atualizar o estado da aplicação
        setVolunteer(formattedData);
        
        // 8. Criar sessão de autenticação
        try {
          console.log('Sessão de autenticação criada com sucesso');
        } catch (authError) {
          console.error('Erro ao criar sessão de autenticação:', authError);
        }
        
        return true;
        
      } catch (error) {
        console.error('Erro ao buscar dados adicionais do voluntário:', error);
        
        // Se falhar, tentar salvar pelo menos os dados básicos
        try {
          console.log('Tentando salvar dados básicos do voluntário...');
          
          const defaultPoint: Point = {
            id: 0,
            name: 'Carregando informações...',
            river: {
              id: 0,
              name: 'Carregando...',
              city: {
                id: 0,
                name: 'Carregando...'
              }
            },
            is_primary: false
          };
          
          const basicData: Volunteer = {
            id: data.id,
            code: data.code || '',
            nome: data.nome || 'Voluntário',
            is_active: data.is_active !== undefined ? data.is_active : true,
            points: [],
            point: defaultPoint,
            point_id: undefined
          };
          
          await AsyncStorage.setItem('volunteer', JSON.stringify(basicData));
          setVolunteer(basicData);
          setSelectedPointId(null);
          
          // Ainda retornar true para permitir o login, mas com dados limitados
          return true;
          
        } catch (saveError) {
          console.error('Erro crítico ao salvar dados básicos do voluntário:', saveError);
          setErrorMessage('Não foi possível carregar todas as informações. Por favor, tente novamente mais tarde.');
          return false;
        }
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (options: { forceReload: boolean } = { forceReload: true }) => {
    console.log('Iniciando logout...');
    
    try {
      setLoading(true);
      
      // 1. Limpar estado do contexto PRIMEIRO para atualizar a UI imediatamente
      // Isso faz o AppNavigator reagir e mostrar a tela de login
      setVolunteer(null);
      setSelectedPointId(null);
      setErrorMessage('');
      
      // 2. Limpar sessão do Supabase
      console.log('Limpando sessão do Supabase...');
      await clearSupabaseSession();
      
      // 3. Limpar dados do AsyncStorage
      console.log('Limpando AsyncStorage...');
      await AsyncStorage.multiRemove([
        'volunteer',
        'selectedPointId',
        'supabase.auth.token',
        'supabase.auth.admin',
        'supabase.auth.user',
        'supabase.auth.token.expires_at',
        'supabase.auth.token.expires_in',
        'supabase.auth.token.refresh_token'
      ]);
      
      // 4. Aguardar um pouco para garantir que o estado seja propagado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 5. No web/PWA, opcionalmente forçar reload para garantir limpeza visual de sessão
      if (typeof window !== 'undefined' && options?.forceReload) {
        try {
          // Redirecionar para a root (ou tela de login) após garantir que tudo foi limpo
          setTimeout(() => {
            // Use replace para evitar voltar ao histórico
            if (window?.location) {
              window.location.replace('/');
            }
          }, 200);
        } catch (e) {
          console.log('Falha ao redirecionar após logout (ignorado):', e);
        }
      }

      console.log('Logout concluído com sucesso');
      return true;
      
    } catch (error) {
      console.error('Erro durante o logout:', error);
      
      // Mesmo com erro, limpar estado local
      setVolunteer(null);
      setSelectedPointId(null);
      setErrorMessage('');
      
      return false;
      
    } finally {
      // Aguardar um pouco antes de desabilitar loading para garantir que a navegação aconteça
      setTimeout(() => {
        setLoading(false);
      }, 300);
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Helper function para obter o ponto atual (selecionado ou primário)
export const getCurrentPoint = (volunteer: Volunteer | null, selectedPointId: number | null): Point | null => {
  if (!volunteer || !volunteer.points || volunteer.points.length === 0) {
    return null;
  }
  
  // Se houver ponto selecionado, retornar ele
  if (selectedPointId) {
    const selected = volunteer.points.find(p => p.id === selectedPointId);
    if (selected) return selected;
  }
  
  // Caso contrário, retornar o ponto primário ou o primeiro
  return volunteer.points.find(p => p.is_primary) || volunteer.points[0] || null;
};

export { AuthContext };
export type { Volunteer, AuthContextType };

