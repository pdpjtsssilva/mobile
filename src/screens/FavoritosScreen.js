import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';

const ICONES_DISPONIVEIS = ['🏠', '💼', '🏋️', '🏫', '🏥', '🛒', '✈️', '🍽️', '⛪', '📍'];

export default function FavoritosScreen({ usuario, onSelecionarFavorito }) {
  const [favoritos, setFavoritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [editando, setEditando] = useState(null);
  
  // Campos do formulário
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [icone, setIcone] = useState('📍');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  useEffect(() => {
    carregarFavoritos();
  }, []);

  const carregarFavoritos = async () => {
    try {
      const response = await axios.get(`${API_URL}/favoritos/usuario/${usuario.id}`);
      setFavoritos(response.data);
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNovo = () => {
    setEditando(null);
    setNome('');
    setEndereco('');
    setIcone('📍');
    setLatitude('');
    setLongitude('');
    setModalVisivel(true);
  };

  const abrirModalEditar = (favorito) => {
    setEditando(favorito);
    setNome(favorito.nome);
    setEndereco(favorito.endereco);
    setIcone(favorito.icone);
    setLatitude(favorito.latitude.toString());
    setLongitude(favorito.longitude.toString());
    setModalVisivel(true);
  };

  const salvarFavorito = async () => {
    if (!nome || !endereco || !latitude || !longitude) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    try {
      if (editando) {
        // Atualizar
        const response = await axios.put(`${API_URL}/favoritos/${editando.id}`, {
          nome,
          endereco,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          icone
        });
        
        setFavoritos(favoritos.map(f => f.id === editando.id ? response.data : f));
        Alert.alert('Sucesso', 'Favorito atualizado!');
      } else {
        // Criar novo
        const response = await axios.post(`${API_URL}/favoritos`, {
          userId: usuario.id,
          nome,
          endereco,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          icone
        });
        
        setFavoritos([response.data, ...favoritos]);
        Alert.alert('Sucesso', 'Favorito adicionado!');
      }
      
      setModalVisivel(false);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o favorito');
    }
  };

  const deletarFavorito = (favorito) => {
    Alert.alert(
      'Excluir Favorito',
      `Deseja excluir "${favorito.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/favoritos/${favorito.id}`);
              setFavoritos(favoritos.filter(f => f.id !== favorito.id));
              Alert.alert('Sucesso', 'Favorito excluído!');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir o favorito');
            }
          }
        }
      ]
    );
  };

  const selecionarFavorito = (favorito) => {
    if (onSelecionarFavorito) {
      onSelecionarFavorito(favorito);
    }
  };

  const renderFavorito = ({ item }) => (
    <View style={styles.favoritoCard}>
      <TouchableOpacity 
        style={styles.favoritoContent}
        onPress={() => selecionarFavorito(item)}
      >
        <Text style={styles.favoritoIcone}>{item.icone}</Text>
        <View style={styles.favoritoInfo}>
          <Text style={styles.favoritoNome}>{item.nome}</Text>
          <Text style={styles.favoritoEndereco} numberOfLines={1}>
            {item.endereco}
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.favoritoAcoes}>
        <TouchableOpacity 
          style={styles.botaoEditar}
          onPress={() => abrirModalEditar(item)}
        >
          <Text style={styles.botaoEditarText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.botaoExcluir}
          onPress={() => deletarFavorito(item)}
        >
          <Text style={styles.botaoExcluirText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Carregando favoritos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meus Lugares</Text>
        <TouchableOpacity style={styles.botaoAdicionar} onPress={abrirModalNovo}>
          <Text style={styles.botaoAdicionarText}>+ Adicionar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={favoritos}
        renderItem={renderFavorito}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyText}>Nenhum favorito ainda</Text>
            <Text style={styles.emptySubtext}>Adicione seus lugares favoritos!</Text>
          </View>
        }
      />

      {/* Modal de Adicionar/Editar */}
      <Modal
        visible={modalVisivel}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>
              {editando ? 'Editar Favorito' : 'Novo Favorito'}
            </Text>

            <Text style={styles.label}>Ícone</Text>
            <View style={styles.iconesContainer}>
              {ICONES_DISPONIVEIS.map((i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.iconeOption,
                    icone === i && styles.iconeOptionSelected
                  ]}
                  onPress={() => setIcone(i)}
                >
                  <Text style={styles.iconeText}>{i}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Casa, Trabalho, Academia"
              placeholderTextColor="#64748b"
              value={nome}
              onChangeText={setNome}
            />

            <Text style={styles.label}>Endereço</Text>
            <TextInput
              style={styles.input}
              placeholder="Rua, número, cidade"
              placeholderTextColor="#64748b"
              value={endereco}
              onChangeText={setEndereco}
            />

            <View style={styles.coordenadasContainer}>
              <View style={styles.coordenadaItem}>
                <Text style={styles.label}>Latitude</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 41.1579"
                  placeholderTextColor="#64748b"
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.coordenadaItem}>
                <Text style={styles.label}>Longitude</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: -8.6291"
                  placeholderTextColor="#64748b"
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.hint}>
              💡 Dica: Toque no mapa para obter as coordenadas automaticamente
            </Text>

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={() => setModalVisivel(false)}
              >
                <Text style={styles.botaoCancelarText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoSalvar}
                onPress={salvarFavorito}
              >
                <Text style={styles.botaoSalvarText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    marginTop: 10,
    color: '#94a3b8',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  botaoAdicionar: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  botaoAdicionarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  lista: {
    padding: 20,
  },
  favoritoCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  favoritoContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoritoIcone: {
    fontSize: 32,
    marginRight: 15,
  },
  favoritoInfo: {
    flex: 1,
  },
  favoritoNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  favoritoEndereco: {
    fontSize: 14,
    color: '#94a3b8',
  },
  favoritoAcoes: {
    flexDirection: 'row',
    gap: 10,
  },
  botaoEditar: {
    width: 40,
    height: 40,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botaoEditarText: {
    fontSize: 18,
  },
  botaoExcluir: {
    width: 40,
    height: 40,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botaoExcluirText: {
    fontSize: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 12,
  },
  iconesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  iconeOption: {
    width: 50,
    height: 50,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  iconeOptionSelected: {
    borderColor: '#ef4444',
    backgroundColor: '#ef444420',
  },
  iconeText: {
    fontSize: 24,
  },
  input: {
    backgroundColor: '#0f172a',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  coordenadasContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  coordenadaItem: {
    flex: 1,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
    fontStyle: 'italic',
  },
  modalBotoes: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  botaoCancelar: {
    flex: 1,
    backgroundColor: '#334155',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoCancelarText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  botaoSalvar: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoSalvarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
