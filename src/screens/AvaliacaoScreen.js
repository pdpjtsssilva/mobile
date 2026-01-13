import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';

export default function AvaliacaoScreen({ corrida, visible, onClose, onAvaliacaoEnviada }) {
  const [avaliacao, setAvaliacao] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviarAvaliacao = async () => {
    if (avaliacao === 0) {
      Alert.alert('Atenção', 'Selecione quantas estrelas você dá para esta corrida');
      return;
    }

    setEnviando(true);
    try {
      await axios.put(`${API_URL}/corridas/${corrida.id}/avaliar`, {
        avaliacao,
        comentario
      });

      Alert.alert(
        'Obrigado! ⭐',
        'Sua avaliação foi enviada com sucesso!'
      );

      if (onAvaliacaoEnviada) {
        onAvaliacaoEnviada();
      }

      onClose();
    } catch (error) {
      Alert.alert(
        'Erro',
        error.response?.data?.error || 'Não foi possível enviar a avaliação'
      );
    } finally {
      setEnviando(false);
    }
  };

  const renderEstrelas = () => {
    return [1, 2, 3, 4, 5].map((estrela) => (
      <TouchableOpacity
        key={estrela}
        style={styles.estrelaButton}
        onPress={() => setAvaliacao(estrela)}
      >
        <Text style={[
          styles.estrelaTexto,
          estrela <= avaliacao && styles.estrelaSelecionada
        ]}>
          {estrela <= avaliacao ? '⭐' : '☆'}
        </Text>
      </TouchableOpacity>
    ));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.titulo}>Como foi sua corrida?</Text>
          
          <View style={styles.corridaInfo}>
            <Text style={styles.corridaId}>
              Corrida #{corrida?.id?.slice(0, 8)}
            </Text>
            <Text style={styles.corridaPreco}>
              € {corrida?.preco?.toFixed(2)}
            </Text>
          </View>

          <Text style={styles.subtitulo}>Avalie o motorista:</Text>
          
          <View style={styles.estrelasContainer}>
            {renderEstrelas()}
          </View>

          {avaliacao > 0 && (
            <Text style={styles.avaliacaoTexto}>
              {avaliacao === 1 && '😞 Muito ruim'}
              {avaliacao === 2 && '😕 Ruim'}
              {avaliacao === 3 && '😐 Regular'}
              {avaliacao === 4 && '😊 Bom'}
              {avaliacao === 5 && '🤩 Excelente!'}
            </Text>
          )}

          <Text style={styles.label}>Comentário (opcional):</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Conte-nos sobre sua experiência..."
            placeholderTextColor="#64748b"
            value={comentario}
            onChangeText={setComentario}
            multiline
            numberOfLines={4}
            maxLength={300}
          />

          <View style={styles.botoesContainer}>
            <TouchableOpacity
              style={styles.botaoPular}
              onPress={onClose}
            >
              <Text style={styles.botaoPularText}>Pular</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.botaoEnviar,
                (avaliacao === 0 || enviando) && styles.botaoDisabled
              ]}
              onPress={enviarAvaliacao}
              disabled={avaliacao === 0 || enviando}
            >
              <Text style={styles.botaoEnviarText}>
                {enviando ? 'Enviando...' : 'Enviar Avaliação'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  corridaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  corridaId: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  corridaPreco: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitulo: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 15,
  },
  estrelasContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  estrelaButton: {
    padding: 5,
  },
  estrelaTexto: {
    fontSize: 40,
    color: '#334155',
  },
  estrelaSelecionada: {
    color: '#fbbf24',
  },
  avaliacaoTexto: {
    fontSize: 18,
    textAlign: 'center',
    color: '#fbbf24',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#0f172a',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  botoesContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  botaoPular: {
    flex: 1,
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  botaoPularText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  botaoEnviar: {
    flex: 2,
    backgroundColor: '#fbbf24',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  botaoDisabled: {
    backgroundColor: '#64748b',
  },
  botaoEnviarText: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
