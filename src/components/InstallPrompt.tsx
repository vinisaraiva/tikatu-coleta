import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALL_BANNER_DISMISSED_KEY = 'install_banner_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isWeb, setIsWeb] = useState(false);

  useEffect(() => {
    // Verificar se está no ambiente web
    if (typeof window === 'undefined') {
      return;
    }

    setIsWeb(true);

    // Verificar se já está instalado (standalone mode)
    const standalone = (window.navigator as any).standalone || 
                      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    setIsStandalone(standalone);

    // Se já está instalado, não mostrar banner
    if (standalone) {
      return;
    }

    // Detectar plataforma de forma mais robusta
    const userAgent = window.navigator.userAgent || '';
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /Android/.test(userAgent);
    
    // Detectar se é dispositivo móvel (incluindo tablets)
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
                          (window.innerWidth <= 768 && 'ontouchstart' in window);

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Verificar se o banner já foi fechado
    AsyncStorage.getItem(INSTALL_BANNER_DISMISSED_KEY).then((dismissed) => {
      if (dismissed === 'true') {
        return;
      }

      // Só mostrar em dispositivos móveis
      if (!isMobileDevice) {
        return;
      }

      // Para Android: capturar evento beforeinstallprompt
      if (isAndroidDevice) {
        let promptEvent: BeforeInstallPromptEvent | null = null;
        
        const handleBeforeInstallPrompt = (e: Event) => {
          e.preventDefault();
          promptEvent = e as BeforeInstallPromptEvent;
          setDeferredPrompt(promptEvent);
          // Mostrar imediatamente quando o evento for capturado
          setShowBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Mostrar banner após 1 segundo mesmo sem o evento (para casos onde já visitou antes)
        const timer = setTimeout(() => {
          if (!promptEvent && !standalone) {
            setShowBanner(true);
          }
        }, 1000);

        return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
          clearTimeout(timer);
        };
      }

      // Para iOS: sempre mostrar banner após 1 segundo
      if (isIOSDevice) {
        const timer = setTimeout(() => {
          setShowBanner(true);
        }, 1000);
        return () => clearTimeout(timer);
      }

      // Para outros dispositivos móveis: mostrar após 1.5 segundos
      if (isMobileDevice && !isIOSDevice && !isAndroidDevice) {
        const timer = setTimeout(() => {
          setShowBanner(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    });
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Android: usar o prompt nativo
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setShowBanner(false);
          await AsyncStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, 'true');
        }
        setDeferredPrompt(null);
      } catch (error) {
        console.error('Erro ao instalar:', error);
        // Se falhar, tentar Web Share API ou mostrar modal
        tryIOSShare();
      }
    } else if (isIOS) {
      // iOS: tentar abrir menu de compartilhamento diretamente
      tryIOSShare();
    } else {
      // Outros: mostrar modal com instruções
      setShowModal(true);
    }
  };

  const tryIOSShare = async () => {
    // Tentar usar Web Share API para abrir menu de compartilhamento no iOS
    if (typeof window !== 'undefined' && (window.navigator as any).share) {
      try {
        const shareData = {
          title: 'Tikatu Coleta',
          text: 'Instale o Tikatu Coleta na sua tela inicial',
          url: window.location.href,
        };
        
        await (window.navigator as any).share(shareData);
        // Se o compartilhamento for bem-sucedido, o usuário pode selecionar "Adicionar à Tela Inicial"
      } catch (error: any) {
        // Se o usuário cancelar ou se der erro, mostrar modal com instruções
        if (error.name !== 'AbortError') {
          console.log('Web Share não disponível, mostrando modal');
        }
        setShowModal(true);
      }
    } else {
      // Web Share API não disponível, mostrar modal com instruções
      setShowModal(true);
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleDismiss = async () => {
    setShowBanner(false);
    await AsyncStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, 'true');
  };

  // Não mostrar se não for web ou se já estiver instalado
  if (!isWeb || isStandalone) {
    return null;
  }

  const instructions = isIOS
    ? 'Para instalar:\n\n1. No menu de compartilhamento que abriu, role para baixo\n2. Selecione "Adicionar à Tela Inicial"\n3. Toque em "Adicionar"\n\nSe o menu não abriu, toque no botão de compartilhar (⬆️) na barra inferior do Safari.'
    : 'Para instalar:\n\n1. Toque no menu (⋮) no canto superior direito\n2. Selecione "Instalar app" ou "Adicionar à tela inicial"\n3. Confirme a instalação';

  return (
    <>
      {showBanner && (
        <View style={styles.container}>
          <View style={styles.banner}>
            <View style={styles.content}>
              <Text style={styles.title}>📱 Instalar Tikatu Coleta</Text>
              <Text style={styles.description}>
                {isIOS 
                  ? 'Adicione à tela inicial para acesso rápido'
                  : 'Instale o app para uma melhor experiência'
                }
              </Text>
            </View>
            <View style={styles.buttons}>
              <TouchableOpacity 
                style={styles.installButton} 
                onPress={handleInstall}
              >
                <Text style={styles.installButtonText}>
                  Instalar
                </Text>
              </TouchableOpacity>
              <View style={{ width: 8 }} />
              <TouchableOpacity 
                style={styles.dismissButton} 
                onPress={handleDismiss}
              >
                <Text style={styles.dismissButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📱 Instalar Tikatu Coleta</Text>
            <Text style={styles.modalText}>{instructions}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={closeModal}
              >
                <Text style={styles.modalButtonText}>Entendi</Text>
              </TouchableOpacity>
              <View style={{ width: 12 }} />
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSecondary]} 
                onPress={() => {
                  closeModal();
                  handleDismiss();
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: 12,
    backgroundColor: 'transparent',
  },
  banner: {
    backgroundColor: '#0066CC',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    color: '#E0E0E0',
    fontSize: 13,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  installButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  installButtonText: {
    color: '#0066CC',
    fontWeight: 'bold',
    fontSize: 14,
  },
  dismissButton: {
    padding: 8,
  },
  dismissButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0066CC',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'left',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#E0E0E0',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonTextSecondary: {
    color: '#333333',
  },
});

