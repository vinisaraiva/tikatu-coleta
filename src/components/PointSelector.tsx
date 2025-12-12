import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useAuth, getCurrentPoint } from '../contexts/AuthContext';

interface PointSelectorProps {
  onPointSelected?: (pointId: number) => void;
}

export default function PointSelector({ onPointSelected }: PointSelectorProps) {
  const { volunteer, selectedPointId, setSelectedPointId } = useAuth();
  const [modalVisible, setModalVisible] = React.useState(false);

  if (!volunteer || !volunteer.points || volunteer.points.length === 0) {
    return null;
  }

  // Se houver apenas um ponto, não mostrar seletor
  if (volunteer.points.length === 1) {
    return null;
  }

  const currentPoint = getCurrentPoint(volunteer, selectedPointId);

  const handleSelectPoint = (pointId: number) => {
    setSelectedPointId(pointId);
    setModalVisible(false);
    if (onPointSelected) {
      onPointSelected(pointId);
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.selectorButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.selectorLabel}>Ponto de Coleta:</Text>
        <Text style={styles.selectorValue}>
          {currentPoint?.name || 'Selecione um ponto'}
        </Text>
        <Text style={styles.selectorArrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecione o Ponto de Coleta</Text>
            <ScrollView style={styles.pointsList}>
              {volunteer.points.map((point) => (
                <TouchableOpacity
                  key={point.id}
                  style={[
                    styles.pointItem,
                    selectedPointId === point.id && styles.pointItemSelected
                  ]}
                  onPress={() => handleSelectPoint(point.id)}
                >
                  <View style={styles.pointInfo}>
                    <Text style={styles.pointName}>{point.name}</Text>
                    <Text style={styles.pointLocation}>
                      {point.river.city.name} - {point.river.name}
                    </Text>
                  </View>
                  {point.is_primary && (
                    <Text style={styles.primaryBadge}>Principal</Text>
                  )}
                  {selectedPointId === point.id && (
                    <Text style={styles.selectedIndicator}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectorButton: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectorLabel: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 8,
  },
  selectorValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  selectorArrow: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  pointsList: {
    maxHeight: 400,
  },
  pointItem: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointItemSelected: {
    borderColor: '#0066CC',
    backgroundColor: '#eff6ff',
  },
  pointInfo: {
    flex: 1,
  },
  pointName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  pointLocation: {
    fontSize: 14,
    color: '#64748b',
  },
  primaryBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066CC',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  selectedIndicator: {
    fontSize: 20,
    color: '#0066CC',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#0066CC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

