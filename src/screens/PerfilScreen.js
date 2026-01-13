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
  Image,
  Switch,
  Linking
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PagamentoScreen from './PagamentoScreen';
import { API_URL } from '../config';
import * as ImagePicker from 'expo-image-picker';

export default function PerfilScreen({ usuario, onLogout, onAtualizar }) {
  const isMotorista = usuario?.tipo === 'motorista';
  const [editando, setEditando] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [estatisticas, setEstatisticas] = useState(null);
  const [mostrarPagamentos, setMostrarPagamentos] = useState(false);
  const [avatarUri, setAvatarUri] = useState(usuario?.avatarUri || null);
  const [mostrarAlterarSenha, setMostrarAlterarSenha] = useState(false);
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);
  const [mostrarPrivacidade, setMostrarPrivacidade] = useState(false);
  
  const [nome, setNome] = useState(usuario?.nome || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [telefone, setTelefone] = useState(usuario?.telefone || '');
  const [documento, setDocumento] = useState(usuario?.documento || '');
  const [dataNascimento, setDataNascimento] = useState(usuario?.dataNascimento || '');
  const [senha, setSenha] = useState('');
  const [docFrente, setDocFrente] = useState(usuario?.cnhFrenteUri || usuario?.docFrenteUri || null);
  const [docVerso, setDocVerso] = useState(usuario?.cnhVersoUri || usuario?.docVersoUri || null);
  const [cnhStatus, setCnhStatus] = useState(usuario?.cnhStatus || 'pendente');

  // Garantir que o estado inicial reflita dados persistidos do usuário
  useEffect(() => {
    if (usuario) {
      setDocFrente(usuario.cnhFrenteUri || usuario.docFrenteUri || docFrente);
      setDocVerso(usuario.cnhVersoUri || usuario.docVersoUri || docVerso);
      if (usuario.cnhStatus) setCnhStatus(usuario.cnhStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.cnhFrenteUri, usuario?.cnhVersoUri]);
  // Carrega CNH do storage local (fallback quando backend não envia)
  useEffect(() => {
    (async () => {
      try {
        const salvo = await AsyncStorage.getItem(`cnh_${usuario?.id}`);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (parsed?.frente) setDocFrente(parsed.frente);
          if (parsed?.verso) setDocVerso(parsed.verso);
        }
      } catch (e) {
        console.error('Erro ao carregar CNH local:', e);
      }
    })();
  }, [usuario?.id]);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [notifPrefs, setNotifPrefs] = useState({ push: true, email: true, sms: false });
  const [privacyPrefs, setPrivacyPrefs] = useState({ compartilharLocalizacao: true, perfilVisivel: true });

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    try {
      const response = await axios.get(`${API_URL}/corridas/usuario/${usuario.id}`);
      const corridas = response.data;
      
      const stats = {
        totalCorridas: corridas.length,
        totalGasto: corridas.reduce((sum, c) => sum + c.preco, 0),
        corridasCanceladas: corridas.filter(c => c.status === 'cancelada').length
      };
      
      setEstatisticas(stats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const salvarPerfil = async () => {
    if (!nome.trim() || !email.trim()) {
      Alert.alert('Erro', 'Nome e email são obrigatórios');
      return;
    }

    setCarregando(true);
    try {
      const response = await axios.put(`${API_URL}/auth/atualizar/${usuario.id}`, {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        documento: documento.trim()
      });

      // Envia CNH se selecionada (motorista)
      let cnhUpload = {};
      if (isMotorista && (docFrente || docVerso)) {
        const formData = new FormData();
        if (docFrente && !docFrente.startsWith('http')) {
          formData.append('cnhFrente', { uri: docFrente, name: 'cnh_frente.jpg', type: 'image/jpeg' });
        }
        if (docVerso && !docVerso.startsWith('http')) {
          formData.append('cnhVerso', { uri: docVerso, name: 'cnh_verso.jpg', type: 'image/jpeg' });
        }
        try {
          const uploadRes = await axios.post(
            `${API_URL.replace('/api', '')}/api/motoristas/${usuario.id}/cnh`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
          cnhUpload = uploadRes.data || {};
        } catch (err) {
          console.error('Erro ao enviar CNH:', err);
          Alert.alert('AtenÇõÇœo', 'Perfil salvo, mas falhou ao enviar CNH.');
        }
      }

      const atualizado = {
        ...response.data,
        avatarUri,
        cnhFrenteUri: cnhUpload.cnhFrenteUri || docFrente,
        cnhVersoUri: cnhUpload.cnhVersoUri || docVerso,
        cnhStatus: cnhUpload.cnhFrenteUri || cnhUpload.cnhVersoUri ? 'enviado' : (usuario.cnhStatus || cnhStatus)
      };
      await AsyncStorage.setItem('usuario', JSON.stringify(atualizado));
      await AsyncStorage.setItem(`cnh_${usuario.id}`, JSON.stringify({ frente: atualizado.cnhFrenteUri, verso: atualizado.cnhVersoUri, status: atualizado.cnhStatus }));
      if (onAtualizar) onAtualizar(atualizado);

      if (cnhUpload.cnhFrenteUri) setDocFrente(cnhUpload.cnhFrenteUri);
      if (cnhUpload.cnhVersoUri) setDocVerso(cnhUpload.cnhVersoUri);

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      setEditando(false);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      Alert.alert('Erro', error.response?.data?.erro || 'Erro ao atualizar perfil');
    } finally {
      setCarregando(false);
    }
  };

  const escolherFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita acesso às fotos para alterar o avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7
    });
    if (!result.canceled && result.assets?.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const escolherDocumento = async (lado) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita acesso às fotos para enviar o documento.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.8
    });
    if (!result.canceled && result.assets?.length > 0) {
      if (lado === 'frente') setDocFrente(result.assets[0].uri);
      if (lado === 'verso') setDocVerso(result.assets[0].uri);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja realmente sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          onPress: async () => {
            await AsyncStorage.removeItem('usuario');
            onLogout();
          },
          style: 'destructive'
        }
      ]
    );
  };

  if (!usuario) {
    return (
      <View style={styles.container}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isMotorista ? (
          <>
            <View style={styles.header}>
              <TouchableOpacity onPress={escolherFoto} style={styles.avatarWrapper}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{usuario.nome?.charAt(0).toUpperCase() || 'U'}</Text>
                  </View>
                )}
                <Text style={styles.editarFoto}>Editar foto</Text>
              </TouchableOpacity>
              <Text style={styles.nomeHeader}>{usuario.nome || 'Motorista'}</Text>
              <Text style={styles.emailHeader}>{usuario.email || ''}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitulo}>Editar Perfil</Text>

              <View style={styles.campo}>
                <Text style={styles.label}>Nome completo</Text>
                <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Seu nome" />
              </View>

              <View style={styles.campo}>
                <Text style={styles.label}>Data Nascimento</Text>
                <TextInput style={styles.input} value={dataNascimento} onChangeText={setDataNascimento} placeholder="Digite data nascimento" />
              </View>

              <View style={styles.campo}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput style={styles.input} value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
              </View>

              <View style={styles.campo}>
                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              </View>

              <View style={styles.campo}>
                <Text style={styles.label}>Senha</Text>
                <TextInput style={styles.input} value={senha} onChangeText={setSenha} secureTextEntry placeholder="Digite sua senha" />
              </View>

              <View style={styles.docCard}>
              <Text style={styles.docTitulo}>Documentos</Text>
              <View style={styles.docLinha}>
                <View>
                  <Text style={styles.docLabel}>CNH - CARTEIRA DE HABILITAÇÃO</Text>
                  <Text
                    style={[
                      styles.docStatus,
                      cnhStatus === 'aprovado'
                        ? styles.docStatusAprovado
                        : cnhStatus === 'reprovado'
                          ? styles.docStatusReprovado
                          : cnhStatus === 'enviado'
                            ? styles.docStatusEnviado
                            : styles.docStatusPendente
                    ]}
                  >
                    {cnhStatus === 'aprovado'
                      ? 'CNH aprovada'
                      : cnhStatus === 'reprovado'
                        ? 'CNH reprovada'
                        : cnhStatus === 'enviado'
                          ? 'CNH enviada'
                          : cnhStatus === 'pendente'
                            ? 'CNH pendente'
                            : docFrente || docVerso
                              ? 'CNH enviada'
                              : 'Aguardando envio'}
                  </Text>
                </View>
                <Text style={styles.docCheck}>✔</Text>
              </View>
              <View style={styles.docUploads}>
                <TouchableOpacity style={styles.docUploadBtn} onPress={() => escolherDocumento('frente')}>
                  <Text style={styles.docUploadText}>{docFrente ? 'Trocar Frente' : 'Adicionar Frente'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.docUploadBtn} onPress={() => escolherDocumento('verso')}>
                  <Text style={styles.docUploadText}>{docVerso ? 'Trocar Verso' : 'Adicionar Verso'}</Text>
                </TouchableOpacity>
              </View>
              {(docFrente || docVerso) && (
                <View style={styles.docPreviewRow}>
                  {docFrente && (
                    <TouchableOpacity
                      onPress={() => {
                        const fullUri = docFrente.startsWith('http') ? docFrente : `${API_URL.replace('/api', '')}${docFrente}`;
                        Linking.openURL(fullUri);
                      }}
                    >
                      <Image
                        source={{ uri: docFrente.startsWith('http') ? docFrente : `${API_URL.replace('/api', '')}${docFrente}` }}
                        style={styles.docPreview}
                      />
                    </TouchableOpacity>
                  )}
                  {docVerso && (
                    <TouchableOpacity
                      onPress={() => {
                        const fullUri = docVerso.startsWith('http') ? docVerso : `${API_URL.replace('/api', '')}${docVerso}`;
                        Linking.openURL(fullUri);
                      }}
                    >
                      <Image
                        source={{ uri: docVerso.startsWith('http') ? docVerso : `${API_URL.replace('/api', '')}${docVerso}` }}
                        style={styles.docPreview}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

              <TouchableOpacity style={styles.botaoSalvarGrande} onPress={salvarPerfil}>
                {carregando ? <ActivityIndicator color="white" /> : <Text style={styles.botaoSalvarGrandeText}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <TouchableOpacity onPress={escolherFoto} style={styles.avatarWrapper}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{usuario.nome?.charAt(0).toUpperCase() || 'U'}</Text>
                  </View>
                )}
                <Text style={styles.editarFoto}>Editar foto</Text>
              </TouchableOpacity>
              <Text style={styles.nomeHeader}>{usuario.nome || 'Não informado'}</Text>
              <Text style={styles.emailHeader}>{usuario.email || 'Não informado'}</Text>
            </View>

            {estatisticas && (
              <View style={styles.estatisticasCard}>
                <Text style={styles.estatisticasTitulo}>Estatísticas</Text>
                <View style={styles.estatisticasGrid}>
                  <View style={styles.estatItem}>
                    <Text style={styles.estatValor}>{estatisticas.totalCorridas || 0}</Text>
                    <Text style={styles.estatLabel}>Corridas</Text>
                  </View>
                  <View style={styles.estatItem}>
                    <Text style={styles.estatValor}>R$ {(estatisticas.totalGasto || 0).toFixed(2)}</Text>
                    <Text style={styles.estatLabel}>Total Gasto</Text>
                  </View>
                  <View style={styles.estatItem}>
                    <Text style={styles.estatValor}>{estatisticas.corridasCanceladas || 0}</Text>
                    <Text style={styles.estatLabel}>Canceladas</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitulo}>Informações Pessoais</Text>
              </View>

              <View style={styles.campo}>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  style={[styles.input, !editando && styles.inputDisabled]}
                  value={nome}
                  onChangeText={setNome}
                  editable={editando}
                  placeholder="Seu nome"
                />
              </View>

              <View style={styles.campo}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, !editando && styles.inputDisabled]}
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
                  style={[styles.input, !editando && styles.inputDisabled]}
                  value={telefone}
                  onChangeText={setTelefone}
                  editable={editando}
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.campo}>
                <Text style={styles.label}>Documento</Text>
                <TextInput
                  style={[styles.input, !editando && styles.inputDisabled]}
                  value={documento}
                  onChangeText={setDocumento}
                  editable={editando}
                  placeholder="CPF/NIF/ID"
                  autoCapitalize="characters"
                />
              </View>

              {editando && (
                <View style={styles.botoesEdicao}>
                  <TouchableOpacity 
                    style={[styles.botao, styles.botaoCancelar]} 
                    onPress={() => {
                      setNome(usuario.nome || '');
                      setEmail(usuario.email || '');
                      setTelefone(usuario.telefone || '');
                      setEditando(false);
                    }}
                  >
                    <Text style={styles.botaoText}>Cancelar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.botao, styles.botaoSalvar]} 
                    onPress={salvarPerfil}
                    disabled={carregando}
                  >
                    {carregando ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.botaoText}>Salvar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitulo}>Opções</Text>

              <TouchableOpacity style={styles.opcao} onPress={() => setMostrarAlterarSenha(true)}>
                <Text style={styles.opcaoTexto}>Alterar Senha</Text>
                <Text style={styles.opcaoSeta}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.opcao} onPress={() => setMostrarNotificacoes(true)}>
                <Text style={styles.opcaoTexto}>Notificações</Text>
                <Text style={styles.opcaoSeta}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.opcao} onPress={() => setMostrarPrivacidade(true)}>
                <Text style={styles.opcaoTexto}>Privacidade</Text>
                <Text style={styles.opcaoSeta}>›</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.botaoSair}
              onPress={handleLogout}
            >
              <Text style={styles.botaoSairText}>Sair da Conta</Text>
            </TouchableOpacity>

            <View style={styles.versao}>
              <Text style={styles.versaoText}>Versão 1.0.0</Text>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={mostrarPagamentos}
        animationType="slide"
        onRequestClose={() => setMostrarPagamentos(false)}
      >
        <PagamentoScreen 
          usuario={usuario} 
          onVoltar={() => setMostrarPagamentos(false)}
        />
      </Modal>

      <Modal visible={mostrarAlterarSenha} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Alterar Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Senha atual"
              value={senhaAtual}
              onChangeText={setSenhaAtual}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Nova senha"
              value={novaSenha}
              onChangeText={setNovaSenha}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirmar nova senha"
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              secureTextEntry
            />
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoCancelar]} onPress={() => setMostrarAlterarSenha(false)}>
                <Text style={styles.modalBotaoText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBotao, styles.modalBotaoSalvar]}
                onPress={() => {
                  if (!novaSenha || novaSenha !== confirmarSenha) {
                    Alert.alert('Erro', 'Senhas não conferem');
                    return;
                  }
                  Alert.alert('Sucesso', 'Senha atualizada (mock)');
                  setSenhaAtual('');
                  setNovaSenha('');
                  setConfirmarSenha('');
                  setMostrarAlterarSenha(false);
                }}
              >
                <Text style={[styles.modalBotaoText, styles.modalBotaoTextSalvar]}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={mostrarNotificacoes} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Notificações</Text>
            {[
              { key: 'push', label: 'Push' },
              { key: 'email', label: 'Email' },
              { key: 'sms', label: 'SMS' }
            ].map((item) => (
              <View key={item.key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{item.label}</Text>
                <Switch
                  value={notifPrefs[item.key]}
                  onValueChange={(v) => setNotifPrefs((prev) => ({ ...prev, [item.key]: v }))}
                />
              </View>
            ))}
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoCancelar]} onPress={() => setMostrarNotificacoes(false)}>
                <Text style={styles.modalBotaoText}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBotao, styles.modalBotaoSalvar]}
                onPress={() => {
                  Alert.alert('Sucesso', 'Preferências salvas (mock)');
                  setMostrarNotificacoes(false);
                }}
              >
                <Text style={[styles.modalBotaoText, styles.modalBotaoTextSalvar]}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={mostrarPrivacidade} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Privacidade</Text>
            {[
              { key: 'compartilharLocalizacao', label: 'Compartilhar localização' },
              { key: 'perfilVisivel', label: 'Perfil visível' }
            ].map((item) => (
              <View key={item.key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{item.label}</Text>
                <Switch
                  value={privacyPrefs[item.key]}
                  onValueChange={(v) => setPrivacyPrefs((prev) => ({ ...prev, [item.key]: v }))}
                />
              </View>
            ))}
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoCancelar]} onPress={() => setMostrarPrivacidade(false)}>
                <Text style={styles.modalBotaoText}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBotao, styles.modalBotaoSalvar]}
                onPress={() => {
                  Alert.alert('Sucesso', 'Privacidade salva (mock)');
                  setMostrarPrivacidade(false);
                }}
              >
                <Text style={[styles.modalBotaoText, styles.modalBotaoTextSalvar]}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { backgroundColor: '#3b82f6', paddingTop: 60, paddingBottom: 30, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6' },
  avatarWrapper: { alignItems: 'center', marginBottom: 10 },
  avatarImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 6 },
  editarFoto: { fontSize: 12, color: '#e0e7ff' },
  nomeHeader: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 5 },
  emailHeader: { fontSize: 14, color: '#e0e7ff' },
  estatisticasCard: { margin: 20, backgroundColor: 'white', borderRadius: 12, padding: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  estatisticasTitulo: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 15 },
  estatisticasGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  estatItem: { alignItems: 'center' },
  estatValor: { fontSize: 20, fontWeight: 'bold', color: '#3b82f6', marginBottom: 5 },
  estatLabel: { fontSize: 12, color: '#64748b' },
  section: { marginHorizontal: 20, marginBottom: 20, backgroundColor: 'white', borderRadius: 12, padding: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitulo: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  editarButton: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  campo: { marginBottom: 15 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 5, fontWeight: '500' },
  input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, fontSize: 14, color: '#1e293b', borderWidth: 1, borderColor: 'transparent' },
  inputDisabled: { backgroundColor: '#f8fafc', color: '#94a3b8' },
  botoesEdicao: { flexDirection: 'row', gap: 10, marginTop: 10 },
  botao: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  botaoCancelar: { backgroundColor: '#e2e8f0' },
  botaoSalvar: { backgroundColor: '#3b82f6' },
  botaoText: { fontSize: 14, fontWeight: '600', color: 'white' },
  opcao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  opcaoTexto: { fontSize: 14, color: '#1e293b' },
  opcaoSeta: { fontSize: 20, color: '#94a3b8' },
  botaoSair: { marginHorizontal: 20, backgroundColor: '#ef4444', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 10 },
  botaoSairText: { color: 'white', fontSize: 14, fontWeight: '600' },
  versao: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
  versaoText: { fontSize: 12, color: '#94a3b8' },
  docCard: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12, marginTop: 10 },
  docTitulo: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  docLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docLabel: { fontSize: 13, color: '#0f172a' },
  docStatus: { fontSize: 12, marginTop: 4 },
  docStatusAprovado: { color: '#16a34a' },
  docStatusReprovado: { color: '#dc2626' },
  docStatusEnviado: { color: '#d97706' },
  docStatusPendente: { color: '#0f172a' },
  docCheck: { fontSize: 20, color: '#22c55e', fontWeight: '700' },
  docUploads: { flexDirection: 'row', gap: 10, marginTop: 10 },
  docUploadBtn: { flex: 1, backgroundColor: '#e2e8f0', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  docUploadText: { color: '#0f172a', fontWeight: '700' },
  docPreviewRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  docPreview: { width: 120, height: 80, borderRadius: 8, backgroundColor: '#e2e8f0' },
  botaoSalvarGrande: { marginTop: 20, backgroundColor: '#0f172a', padding: 14, borderRadius: 10, alignItems: 'center' },
  botaoSalvarGrandeText: { color: 'white', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: 'white', borderRadius: 12, padding: 20 },
  modalTitulo: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBotao: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBotaoCancelar: { backgroundColor: '#e2e8f0' },
  modalBotaoSalvar: { backgroundColor: '#3b82f6' },
  modalBotaoText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  modalBotaoTextSalvar: { color: 'white' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  toggleLabel: { fontSize: 14, color: '#1e293b' }
});
