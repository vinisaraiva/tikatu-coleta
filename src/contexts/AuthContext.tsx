import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, testSupabaseConnection, clearSupabaseSession } from '../services/supabase';

// Obter a instância do Supabase
const supabase = getSupabase();

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
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Flag para controle de montagem do componente
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    
    const verifyAuth = async () => {
      try {
        // No ambiente web, não restaurar sessão automaticamente
        if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
          if (isMounted) {
            setLoading(false);
          }
          return;
        }
        
        // Configurar timeout para evitar loading infinito
        timer = window.setTimeout(() => {
          if (isMounted) {
            setLoading(false);
          }
        }, 5000); // Timeout de 5 segundos
        
        // 1. Verificar se há uma sessão ativa no Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Erro ao verificar sessão:', sessionError);
          throw sessionError;
        }
        
        // Se não houver sessão ativa, limpar dados locais e sair
        if (!session) {
          console.log('Nenhuma sessão ativa encontrada');
          await AsyncStorage.multiRemove([
            'volunteer',
            'supabase.auth.token',
            'supabase.auth.admin',
            'supabase.auth.user'
          ]);
          
          if (isMounted) {
            setVolunteer(null);
          }
          return;
        }
        
        console.log('Sessão ativa encontrada, verificando dados locais...');
        
        // 2. Verificar se há dados do voluntário no armazenamento local
        const storedVolunteer = await AsyncStorage.getItem('volunteer');
        
        if (!storedVolunteer) {
          console.log('Nenhum dado de voluntário encontrado localmente');
          // Forçar logout se não houver dados locais
          await clearSupabaseSession();
          if (isMounted) {
            setVolunteer(null);
          }
          return;
        }
        
        // 3. Validar os dados do voluntário
        try {
          const parsed = JSON.parse(storedVolunteer);
          
          // Validar estrutura básica dos dados
          if (!parsed?.id || !parsed?.code || !parsed?.nome) {
            console.warn('Dados de voluntário incompletos, limpando...');
            throw new Error('Dados incompletos');
          }
          
          // Verificar se a sessão ainda é válida
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError || !user) {
            console.warn('Sessão inválida ou expirada:', userError);
            throw new Error('Sessão inválida');
          }
          
          // Atualizar dados do voluntário no estado
          if (isMounted) {
            setVolunteer(parsed);
            console.log('Voluntário autenticado:', parsed.code);
          }
          
        } catch (error) {
          console.error('Erro ao validar dados do voluntário:', error);
          // Limpar dados inválidos
          await AsyncStorage.multiRemove([
            'volunteer',
            'supabase.auth.token',
            'supabase.auth.admin',
            'supabase.auth.user'
          ]);
          
          if (isMounted) {
            setVolunteer(null);
          }
        }
        
      } catch (error) {
        console.error('Erro na verificação de autenticação:', error);
        // Garantir que os dados sejam limpos em caso de erro
        try {
          await clearSupabaseSession();
          await AsyncStorage.multiRemove([
            'volunteer',
            'supabase.auth.token',
            'supabase.auth.admin',
            'supabase.auth.user'
          ]);
        } catch (cleanupError) {
          console.error('Erro ao limpar dados durante tratamento de erro:', cleanupError);
        }
        
        if (isMounted) {
          setVolunteer(null);
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
          setErrorMessage('Código ou senha incorretos');
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
        
        // 1. Primeiro, buscar os dados básicos do voluntário se não estiverem completos
        let volunteerData = { ...data };
        
        // 2. Buscar dados do ponto, rio e cidade em consultas separadas para melhor controle
        if (data.point_id) {
          console.log(`Buscando dados do ponto ${data.point_id}...`);
          
          // Buscar dados do ponto com relacionamentos aninhados
          const { data: pointData, error: pointError } = await supabase
            .from('points')
            .select(`
              *,
              river:rivers (
                *,
                city:cities(*)
              )
            `)
            .eq('id', data.point_id)
            .single();
            
          if (pointError) {
            console.error('Erro ao buscar dados do ponto:', pointError);
            throw new Error('Erro ao carregar informações do local');
          }
          
          // Estruturar os dados do ponto com valores padrão caso faltem
          volunteerData.point = {
            id: pointData?.id || 0,
            name: pointData?.name || 'Ponto não informado',
            river: pointData?.river ? {
              id: pointData.river.id || 0,
              name: pointData.river.name || 'Rio não informado',
              city: pointData.river.city ? {
                id: pointData.river.city.id || 0,
                name: pointData.river.city.name || 'Cidade não informada'
              } : { id: 0, name: 'Cidade não informada' }
            } : { 
              id: 0, 
              name: 'Rio não informado', 
              city: { id: 0, name: 'Cidade não informada' } 
            }
          };
          
          console.log('Dados do ponto carregados:', volunteerData.point);
        } else {
          // Se não houver point_id, definir valores padrão
          volunteerData.point = {
            id: 0,
            name: 'Ponto não informado',
            river: {
              id: 0,
              name: 'Rio não informado',
              city: {
                id: 0,
                name: 'Cidade não informada'
              }
            }
          };
        }
        
        // 3. Garantir que todos os campos obrigatórios existam
        const formattedData: Volunteer = {
          id: volunteerData.id,
          code: volunteerData.code || '',
          nome: volunteerData.nome || 'Voluntário',
          point_id: volunteerData.point_id || 0,
          is_active: volunteerData.is_active !== undefined ? volunteerData.is_active : true,
          point: volunteerData.point || {
            id: 0,
            name: 'Ponto não informado',
            river: {
              id: 0,
              name: 'Rio não informado',
              city: {
                id: 0,
                name: 'Cidade não informada'
              }
            }
          }
        };
        
        console.log('Dados formatados do voluntário:', formattedData);
        
        // 4. Salvar no AsyncStorage
        try {
          await AsyncStorage.setItem('volunteer', JSON.stringify(formattedData));
          console.log('Dados do voluntário salvos no AsyncStorage');
        } catch (storageError) {
          console.error('Erro ao salvar no AsyncStorage:', storageError);
          // Continuar mesmo com erro, pois o estado já foi atualizado
        }
        
        // 5. Atualizar o estado da aplicação
        setVolunteer(formattedData);
        
        // 6. Criar sessão de autenticação
        try {
          // Aqui você pode adicionar lógica para criar uma sessão de autenticação
          // se estiver usando autenticação por token JWT, por exemplo
          console.log('Sessão de autenticação criada com sucesso');
        } catch (authError) {
          console.error('Erro ao criar sessão de autenticação:', authError);
          // Não falhar o login por causa disso, apenas registrar o erro
        }
        
        return true;
        
      } catch (error) {
        console.error('Erro ao buscar dados adicionais do voluntário:', error);
        
        // Se falhar, tentar salvar pelo menos os dados básicos
        try {
          console.log('Tentando salvar dados básicos do voluntário...');
          
          const basicData: Volunteer = {
            id: data.id,
            code: data.code || '',
            nome: data.nome || 'Voluntário',
            point_id: data.point_id || 0,
            is_active: data.is_active !== undefined ? data.is_active : true,
            point: data.point_id ? {
              id: data.point_id,
              name: 'Carregando informações...',
              river: {
                id: 0,
                name: 'Carregando...',
                city: {
                  id: 0,
                  name: 'Carregando...'
                }
              }
            } : { 
              id: 0, 
              name: 'Ponto não informado', 
              river: { 
                id: 0, 
                name: 'Rio não informado', 
                city: { 
                  id: 0, 
                  name: 'Cidade não informada' 
                } 
              } 
            }
          };
          
          await AsyncStorage.setItem('volunteer', JSON.stringify(basicData));
          setVolunteer(basicData);
          
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
    console.log('Iniciando processo de logout...', { forceReload: options.forceReload });
    
    // 0. Limpar estado imediatamente para feedback visual
    setVolunteer(null);
    setErrorMessage('');
    setLoading(true);
    
    try {
      // 1. Lista de tarefas de limpeza a serem executadas em paralelo
      const cleanupTasks = [
        // Limpar sessão do Supabase
        (async () => {
          try {
            console.log('Limpando sessão do Supabase...');
            await clearSupabaseSession();
            console.log('Sessão do Supabase limpa com sucesso');
          } catch (e) {
            console.error('Erro ao limpar sessão do Supabase:', e);
            throw e; // Relançar para ser capturado pelo bloco catch externo
          }
        })(),
        
        // Limpar todos os dados de armazenamento local
        (async () => {
          try {
            console.log('Limpando AsyncStorage...');
            await AsyncStorage.multiRemove([
              'volunteer',
              'supabase.auth.token',
              'supabase.auth.admin',
              'supabase.auth.user',
              'supabase.auth.token.expires_at',
              'supabase.auth.token.expires_in',
              'supabase.auth.token.refresh_token'
            ]);
            console.log('AsyncStorage limpo com sucesso');
          } catch (e) {
            console.warn('Erro ao limpar AsyncStorage:', e);
            // Não relançar, pois queremos continuar mesmo com falha
          }
        })()
      ];
      
      // 2. Executar todas as tarefas de limpeza em paralelo
      console.log('Executando tarefas de limpeza...');
      await Promise.allSettled(cleanupTasks);
      
      // 3. Limpar caches e service workers (apenas no navegador)
      if (typeof window !== 'undefined') {
        try {
          // 3.1 Limpar caches da API
          if ('caches' in window) {
            console.log('Limpando caches da API...');
            const cacheNames = await caches.keys();
            const cacheDeletions = cacheNames.map(cacheName => {
              console.log(`Removendo cache: ${cacheName}`);
              return caches.delete(cacheName);
            });
            await Promise.all(cacheDeletions);
          }
          
          // 3.2 Limpar armazenamento do navegador
          console.log('Limpando armazenamento do navegador...');
          try {
            sessionStorage.clear();
            localStorage.clear();
          } catch (e) {
            console.warn('Não foi possível limpar o armazenamento do navegador:', e);
          }
          
          // 3.3 Desregistrar service workers
          if ('serviceWorker' in navigator) {
            try {
              console.log('Desregistrando service workers...');
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map(reg => {
                console.log(`Desregistrando service worker: ${reg.scope}`);
                return reg.unregister();
              }));
            } catch (e) {
              console.warn('Não foi possível desregistrar service workers:', e);
            }
          }
          
          // 3.4 Redirecionar para a página inicial se necessário
          if (options.forceReload) {
            const redirectUrl = new URL(window.location.origin + window.location.pathname);
            redirectUrl.searchParams.set('logout', Date.now().toString());
            redirectUrl.searchParams.set('no-cache', '1');
            
            console.log(`Redirecionando para: ${redirectUrl.toString()}`);
            
            // Tenta substituir a URL atual sem adicionar ao histórico
            try {
              window.location.replace(redirectUrl.toString());
              
              // Se o replace não redirecionar, força um reload após um curto atraso
              setTimeout(() => {
                window.location.href = redirectUrl.toString();
              }, 500);
            } catch (e) {
              console.error('Erro ao redirecionar:', e);
              window.location.href = redirectUrl.toString();
            }
          }
          
        } catch (e) {
          console.error('Erro durante a limpeza do navegador:', e);
          // Mesmo com erro, tenta continuar
        }
      }
      
      console.log('Logout concluído com sucesso');
      return true;
      
    } catch (error) {
      console.error('Erro durante o logout:', error);
      
      // Em caso de erro, garantir que o estado seja limpo
      setVolunteer(null);
      
      // Forçar recarregamento no navegador se necessário
      if (typeof window !== 'undefined' && options.forceReload) {
        try {
          const url = new URL(window.location.origin + window.location.pathname);
          url.searchParams.set('error', 'logout_failed');
          url.searchParams.set('t', Date.now().toString());
          window.location.href = url.toString();
        } catch (e) {
          console.error('Erro ao redirecionar após falha no logout:', e);
          window.location.reload();
        }
      }
      
      return false;
      
    } finally {
      // Garantir que o loading seja desativado
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    volunteer,
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