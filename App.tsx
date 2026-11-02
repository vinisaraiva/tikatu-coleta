import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import XLSXImportScreen from './src/screens/XLSXImportScreen';
import EnvironmentalFactorsScreen from './src/screens/EnvironmentalFactorsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ReadingDetailScreen from './src/screens/ReadingDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Context
import { AuthProvider, useAuth } from './src/contexts/AuthContext';

// Components
import DialogHost from './src/components/DialogHost';
import InstallGate from './src/components/InstallGate';

// Auto-atualizacao do PWA (forca a versao nova sem derrubar o login)
import { checarAtualizacao } from './src/services/appUpdate';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Web (PWA): largura limitada + altura VISIVEL real (desconta a barra do navegador no iPhone,
// para a barra de abas de baixo nao ficar escondida atras da barra do Safari).
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Habilita env(safe-area-inset-*) para respeitar o indicador do iPhone.
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/viewport-fit/.test(vp.getAttribute('content') || '')) {
    vp.setAttribute(
      'content',
      (vp.getAttribute('content') || 'width=device-width, initial-scale=1') + ', viewport-fit=cover'
    );
  }

  if (!document.getElementById('tikatu-web-style')) {
    const style = document.createElement('style');
    style.id = 'tikatu-web-style';
    style.textContent = `
      html, body { background-color: #e2e8f0; height: 100%; }
      #root {
        max-width: 600px;
        margin: 0 auto;
        min-height: 100vh;
        min-height: 100dvh; /* altura visivel: desconta a barra do navegador no iPhone */
        background-color: #f8fafc;
        box-shadow: 0 0 24px rgba(15, 23, 42, 0.08);
        /* respiro para o indicador inferior do iPhone (0 no navegador comum) */
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
    `;
    document.head.appendChild(style);
  }
}

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home-outline',
  History: 'time-outline',
  Profile: 'person-outline',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0', backgroundColor: '#ffffff' },
        tabBarLabelStyle: { fontSize: 12 },
        headerTitleStyle: { color: '#1e293b' },
        headerStyle: { backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0' },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name] || 'ellipse-outline'} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Histórico' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer key={isAuthenticated ? 'authenticated' : 'unauthenticated'}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="XLSXImport"
              component={XLSXImportScreen}
              options={{ headerShown: true, title: 'Importar XLSX' }}
            />
            <Stack.Screen
              name="EnvironmentalFactors"
              component={EnvironmentalFactorsScreen}
              options={{ headerShown: true, title: 'Fatores Ambientais' }}
            />
            <Stack.Screen
              name="ReadingDetail"
              component={ReadingDetailScreen}
              options={{ headerShown: true, title: 'Detalhes da Coleta' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    // No arranque, verifica se ha versao nova e forca a atualizacao se preciso.
    checarAtualizacao();
  }, []);

  return (
    <AuthProvider>
      <AppNavigator />
      <InstallGate />
      <DialogHost />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
