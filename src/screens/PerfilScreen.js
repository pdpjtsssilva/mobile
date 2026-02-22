import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  Switch,
  Linking
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PagamentoScreen from './PagamentoScreen';
import { API_URL } from '../config';

export default function PerfilScreen({ usuario, onLogout, onAtualizar }) {
  const isMotorista = usuario?.tipo === 'motorista';
  const [editando, setEditando] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [estatisticas, setEstatisticas] = useState(null);
  const [mostrarPagamentos, setMostrarPagamentos] = useState(false);
  const [mostrarAlterarSenha, setMostrarAlterarSenha] = useState(false);
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);
  const [mostrarPrivacidade, setMostrarPrivacidade] = useState(false);
  
  const [nome, setNome] = useState(usuario?.nome || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [telefone, setTelefone] = useState(usuario?.telefone || '');
  const [documento, setDocumento] = useState(usuario?.documento || '');
  const [dataNascimento, setDataNascimento] = useState(usuario?.dataNascimento || '');
  const [senha, setSenha] = useState('');
  const [cnhStatus, setCnhStatus] = useState(usuario?.cnhStatus || 'pendente');
  
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(usuario?.notificacoesAtivas ?? true);

  useEffect(() => {
    if (isMotorista) carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/motoristas/${usuario.id}/estatisticas`);
      setEstatisticas(data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  const salvarPerfil = async () => {
    if (!nome.trim() || !email.trim() || !telefone.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }
    setCarregando(true);
    try {
      const dados = { nome, email, telefone, documento, dataNascimento };
      const { data } = await axios.put(`${API_URL}/auth/atualizar/${usuario.id}`, dados);
      await AsyncStorage.setItem('usuario', JSON.stringify(data));
      if (onAtualizar) onAtualizar(data);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      setEditando(false);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      Alert.alert('Erro', error.response?.data?.erro || 'Erro ao atualizar perfil');
    } finally {
      setCarregando(false);
    }
  };

  const alterarSenha = async () => {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      Alert.alert('Erro', 'Preencha todos os campos de senha');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }
    if (novaSenha.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setCarregando(true);
    try {
      await axios.put(`${API_URL}/auth/alterar-senha/${usuario.id}`, {
        senhaAtual,
        novaSenha
      });
      Alert.alert('Sucesso', 'Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setMostrarAlterarSenha(false);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.erro || 'Erro ao alterar senha');
    } finally {
      setCarregando(false);
    }
  };

  const salvarNotificacoes = async () => {
    setCarregando(true);
    try {
      const { data } = await axios.put(`${API_URL}/auth/atualizar/${usuario.id}`, {
        notificacoesAtivas
      });
      await AsyncStorage.setItem('usuario', JSON.stringify(data));
      if (onAtualizar) onAtualizar(data);
      Alert.alert('Sucesso', 'Preferências de notificações atualizadas!');
      setMostrarNotificacoes(false);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao atualizar notificações');
    } finally {
      setCarregando(false);
    }
  };

  const excluirConta = () => {
    Alert.alert(
      'Excluir Conta',
      'Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setCarregando(true);
            try {
              await axios.delete(`${API_URL}/auth/excluir/${usuario.id}`);
              await AsyncStorage.removeItem('usuario');
              Alert.alert('Conta excluída', 'Sua conta foi excluída com sucesso');
              onLogout();
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir conta');
            } finally {
              setCarregando(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>

        {/* Informações pessoais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações Pessoais</Text>
          
          <View style={styles.campo}>
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              editable={editando}
              placeholder="Seu nome"
            />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              editable={editando}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={telefone}
              onChangeText={setTelefone}
              editable={editando}
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Documento (CPF/RG)</Text>
            <TextInput
              style={styles.input}
              value={documento}
              onChangeText={setDocumento}
              editable={editando}
              placeholder="000.000.000-00"
            />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Data de Nascimento</Text>
            <TextInput
              style={styles.input}
              value={dataNascimento}
              onChangeText={setDataNascimento}
              editable={editando}
              placeholder="DD/MM/AAAA"
            />
          </View>

          {editando && (
            <TouchableOpacity style={styles.botaoSalvar} onPress={salvarPerfil} disabled={carregando}>
              {carregando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botaoText}>Salvar Alterações</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Estatísticas Motorista */}
        {isMotorista && estatisticas && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estatísticas</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{estatisticas.totalCorridas || 0}</Text>
                <Text style={styles.statLabel}>Corridas</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>R$ {(estatisticas.ganhoTotal || 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>Ganhos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{(estatisticas.avaliacaoMedia || 0).toFixed(1)} ⭐</Text>
                <Text style={styles.statLabel}>Avaliação</Text>
              </View>
            </View>
          </View>
        )}

        {/* CNH Status (Motorista) */}
        {isMotorista && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status da CNH</Text>
            <View style={styles.cnhStatus}>
              <Text style={styles.cnhStatusText}>
                Status: <Text style={styles[`status_${cnhStatus}`]}>{cnhStatus.toUpperCase()}</Text>
              </Text>
              <Text style={styles.infoText}>
                {cnhStatus === 'pendente' && 'Documentos em análise'}
                {cnhStatus === 'aprovada' && 'CNH aprovada! Você pode aceitar corridas'}
                {cnhStatus === 'rejeitada' && 'CNH rejeitada. Atualize os documentos'}
              </Text>
            </View>
          </View>
        )}

        {/* Configurações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => setMostrarAlterarSenha(true)}>
            <Text style={styles.menuItemText}>🔒 Alterar Senha</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => setMostrarNotificacoes(true)}>
            <Text style={styles.menuItemText}>🔔 Notificações</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => setMostrarPrivacidade(true)}>
            <Text style={styles.menuItemText}>🛡️ Privacidade</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          {!isMotorista && (
            <TouchableOpacity style={styles.menuItem} onPress={() => setMostrarPagamentos(true)}>
              <Text style={styles.menuItemText}>💳 Formas de Pagamento</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Botão Sair */}
        <TouchableOpacity style={styles.botaoSair} onPress={onLogout}>
          <Text style={styles.botaoSairText}>Sair da Conta</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Alterar Senha */}
      <Modal visible={mostrarAlterarSenha} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Alterar Senha</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Senha Atual"
              secureTextEntry
              value={senhaAtual}
              onChangeText={setSenhaAtual}
            />
            <TextInput
              style={styles.input}
              placeholder="Nova Senha"
              secureTextEntry
              value={novaSenha}
              onChangeText={setNovaSenha}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirmar Nova Senha"
              secureTextEntry
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setMostrarAlterarSenha(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={alterarSenha}
                disabled={carregando}
              >
                {carregando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Notificações */}
      <Modal visible={mostrarNotificacoes} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Notificações</Text>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Receber notificações</Text>
              <Switch
                value={notificacoesAtivas}
                onValueChange={setNotificacoesAtivas}
                trackColor={{ false: '#767577', true: '#34d399' }}
                thumbColor={notificacoesAtivas ? '#10b981' : '#f4f3f4'}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setMostrarNotificacoes(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={salvarNotificacoes}
                disabled={carregando}
              >
                {carregando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Privacidade */}
      <Modal visible={mostrarPrivacidade} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Privacidade e Segurança</Text>
            
            <TouchableOpacity style={styles.privacyItem} onPress={() => Linking.openURL('https://example.com/termos')}>
              <Text style={styles.privacyItemText}>📄 Termos de Uso</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.privacyItem} onPress={() => Linking.openURL('https://example.com/privacidade')}>
              <Text style={styles.privacyItemText}>🔒 Política de Privacidade</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.privacyItem, styles.dangerItem]} onPress={excluirConta}>
              <Text style={styles.dangerText}>🗑️ Excluir Conta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 20 }]}
              onPress={() => setMostrarPrivacidade(false)}
            >
              <Text style={styles.modalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Pagamentos */}
      <Modal visible={mostrarPagamentos} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <PagamentoScreen
              usuario={usuario}
              onFechar={() => setMostrarPagamentos(false)}
              onAtualizarUsuario={onAtualizar}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { backgroundColor: '#ef4444', padding: 20, paddingTop: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  section: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 },
  campo: { marginBottom: 16 },
  label: { fontSize: 14, color: '#64748b', marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: 16, color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  botaoSalvar: { backgroundColor: '#ef4444', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  botaoText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#ef4444' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  cnhStatus: { padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  cnhStatusText: { fontSize: 16, color: '#1e293b', marginBottom: 8 },
  status_pendente: { color: '#f59e0b', fontWeight: 'bold' },
  status_aprovada: { color: '#10b981', fontWeight: 'bold' },
  status_rejeitada: { color: '#ef4444', fontWeight: 'bold' },
  infoText: { fontSize: 14, color: '#64748b' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuItemText: { fontSize: 16, color: '#1e293b' },
  menuItemArrow: { fontSize: 24, color: '#cbd5e1' },
  botaoSair: { margin: 16, padding: 16, backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center' },
  botaoSairText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  modalButtonCancel: { backgroundColor: '#94a3b8' },
  modalButtonConfirm: { backgroundColor: '#ef4444' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  switchLabel: { fontSize: 16, color: '#1e293b' },
  privacyItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  privacyItemText: { fontSize: 16, color: '#1e293b' },
  dangerItem: { borderBottomWidth: 0, marginTop: 20 },
  dangerText: { fontSize: 16, color: '#ef4444', fontWeight: '600' }
});