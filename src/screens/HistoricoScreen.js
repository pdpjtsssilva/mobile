import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';

export default function HistoricoScreen({ usuario, isMotorista: isMotoristaProp = false }) {
  const isMotorista = isMotoristaProp || usuario?.tipo === 'motorista';
  const [corridas, setCorridas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    carregarHistorico();
  }, []);

  const carregarHistorico = async () => {
    try {
      const url = isMotorista
        ? `${API_URL}/corridas/motorista/${usuario.id}`
        : `${API_URL}/corridas/usuario/${usuario.id}`;
      const response = await axios.get(url);
      setCorridas(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar historico:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarHistorico();
  };

  const formatarData = (dataString) => {
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'finalizada':
      case 'paga':
        return '#10b981';
      case 'aguardando':
      case 'aceita':
      case 'em_andamento':
        return '#f59e0b';
      case 'cancelada':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'finalizada':
        return 'Concluida';
      case 'paga':
        return 'Paga';
      case 'aguardando':
        return 'Aguardando motorista';
      case 'aceita':
        return 'Motorista a caminho';
      case 'em_andamento':
        return 'Em andamento';
      case 'cancelada':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const renderCorrida = ({ item }) => (
    <View style={styles.corridaCard}>
      <View style={styles.corridaHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusText(item.status)}</Text>
        </View>
        <Text style={styles.corridaData}>{formatarData(item.createdAt)}</Text>
      </View>

      <View style={styles.corridaInfo}>
        <View style={styles.rotaInfo}>
          <View style={styles.pontoLinha}>
            <View style={[styles.bolinha, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.enderecoTexto} numberOfLines={1}>{item.origemEndereco}</Text>
          </View>
          <View style={styles.pontoLinha}>
            <View style={[styles.bolinha, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.enderecoTexto} numberOfLines={1}>{item.destinoEndereco}</Text>
          </View>
        </View>

        <View style={styles.detalhesContainer}>
          <View style={styles.detalheItem}>
            <Text style={styles.detalheLabel}>Distancia</Text>
            <Text style={styles.detalheValor}>{(item.distancia || 0).toFixed(2)} km</Text>
          </View>
          <View style={styles.divisor} />
          <View style={styles.detalheItem}>
            <Text style={styles.detalheLabel}>Valor</Text>
            <Text style={styles.precoValor}>R$ {(item.preco || 0).toFixed(2)}</Text>
          </View>
        </View>
        {item.avaliacao ? (
          <View style={styles.avaliacaoRow}>
            <Text style={styles.avaliacaoLabel}>Avaliacao:</Text>
            <Text style={styles.avaliacaoValor}>{item.avaliacao}★</Text>
          </View>
        ) : null}
        {item.comentarioAvaliacao ? (
          <View style={styles.avaliacaoRow}>
            <Text style={styles.avaliacaoLabel}>Comentario:</Text>
            <Text style={styles.avaliacaoComentario}>
              {item.comentarioAvaliacao}
            </Text>
          </View>
        ) : null}

        {item.motorista && (
          <View style={styles.motoristaInfo}>
            <Text style={styles.motoristaLabel}>Motorista:</Text>
            <Text style={styles.motoristaNome}>{item.motorista.nome}</Text>
          </View>
        )}

        <Text style={styles.corridaId}>ID: #{(item.id || '').slice(0, 8)}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Carregando historico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historico de Corridas</Text>
        <Text style={styles.headerSubtitle}>{corridas.length} corrida(s)</Text>
      </View>

      <FlatList
        data={corridas}
        renderItem={renderCorrida}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ef4444']} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>-</Text>
            <Text style={styles.emptyText}>Nenhuma corrida ainda</Text>
            <Text style={styles.emptySubtext}>Puxe para atualizar.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  loadingText: { marginTop: 10, color: '#94a3b8', fontSize: 16 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: '#1e293b' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  headerSubtitle: { fontSize: 14, color: '#94a3b8' },
  lista: { padding: 20 },
  corridaCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  corridaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  corridaData: { fontSize: 12, color: '#94a3b8' },
  corridaInfo: { gap: 12 },
  rotaInfo: { marginBottom: 10, gap: 8 },
  pontoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  enderecoTexto: { flex: 1, fontSize: 14, color: '#e2e8f0' },
  detalhesContainer: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 15, borderRadius: 8, justifyContent: 'space-around' },
  detalheItem: { alignItems: 'center' },
  detalheLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 5 },
  detalheValor: { fontSize: 16, fontWeight: 'bold', color: '#e2e8f0' },
  precoValor: { fontSize: 20, fontWeight: 'bold', color: '#10b981' },
  divisor: { width: 1, backgroundColor: '#334155' },
  motoristaInfo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  motoristaLabel: { fontSize: 12, color: '#94a3b8' },
  motoristaNome: { fontSize: 12, color: '#e2e8f0', fontWeight: '600' },
  avaliacaoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avaliacaoLabel: { fontSize: 12, color: '#94a3b8' },
  avaliacaoValor: { fontSize: 12, color: '#fbbf24', fontWeight: '700' },
  avaliacaoComentario: { flex: 1, fontSize: 12, color: '#e2e8f0' },
  corridaId: { fontSize: 10, color: '#64748b', fontFamily: 'monospace' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 32, marginBottom: 12, color: '#94a3b8' },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#e2e8f0', marginBottom: 5 },
  emptySubtext: { fontSize: 14, color: '#94a3b8' },
});
