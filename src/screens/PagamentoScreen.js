import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Clipboard
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';

export default function PagamentoScreen({ usuario, onVoltar }) {
  const [metodoSelecionado, setMetodoSelecionado] = useState(usuario?.metodoPagamentoPadrao || 'cartao');
  const [cartoes, setCartoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [modalCartao, setModalCartao] = useState(false);
  const [novoCartao, setNovoCartao] = useState({
    numero: '',
    nome: '',
    validade: '',
    cvv: '',
    bandeira: 'Visa'
  });

  const CHAVE_PIX = '83bcab98-d142-4022-8483-9f59fe9f3cdd';
  const MB_WAY_NUMBER = '925539552';

  const copiarChavePix = () => {
    Clipboard.setString(CHAVE_PIX);
    Alert.alert('Sucesso', 'Chave PIX copiada!');
  };

  const copiarMbWay = () => {
    Clipboard.setString(MB_WAY_NUMBER);
    Alert.alert('Sucesso', 'Número MB Way copiado!');
  };

  const selecionarMetodo = async (metodo) => {
    setMetodoSelecionado(metodo);
    try {
      await axios.put(`${API_URL}/auth/atualizar/${usuario.id}`, {
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        documento: usuario.documento,
        metodoPagamentoPadrao: metodo
      });
      Alert.alert('Sucesso', `Método ${metodo.toUpperCase()} definido como padrão!`);
    } catch (error) {
      console.error('Erro ao salvar método:', error);
      Alert.alert('Erro', 'Não foi possível salvar o método de pagamento');
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const cartoesRes = await axios.get(`${API_URL}/pagamentos/cartoes/${usuario.id}`);
      setCartoes(cartoesRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Não foi possível carregar seus métodos de pagamento');
    } finally {
      setCarregando(false);
    }
  };

  const adicionarCartao = async () => {
    if (!novoCartao.numero || !novoCartao.nome || !novoCartao.validade || !novoCartao.cvv) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }
    if (novoCartao.numero.length < 16) {
      Alert.alert('Erro', 'Número do cartão inválido');
      return;
    }
    try {
      await axios.post(`${API_URL}/pagamentos/cartoes`, {
        userId: usuario.id,
        ...novoCartao
      });
      Alert.alert('Sucesso', 'Cartão adicionado com sucesso!');
      setModalCartao(false);
      setNovoCartao({ numero: '', nome: '', validade: '', cvv: '', bandeira: 'Visa' });
      carregarDados();
    } catch (error) {
      console.error('Erro ao adicionar cartão:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o cartão');
    }
  };

  const definirCartaoPrincipal = async (cartaoId) => {
    try {
      await axios.patch(`${API_URL}/pagamentos/cartoes/${cartaoId}/principal`, { userId: usuario.id });
      carregarDados();
    } catch (error) {
      console.error('Erro ao definir cartão principal:', error);
      Alert.alert('Erro', 'Não foi possível definir cartão principal');
    }
  };

  const removerCartao = async (cartaoId) => {
    Alert.alert('Remover Cartão', 'Deseja realmente remover este cartão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/pagamentos/cartoes/${cartaoId}`);
            carregarDados();
          } catch (error) {
            console.error('Erro ao remover cartão:', error);
            Alert.alert('Erro', 'Não foi possível remover o cartão');
          }
        }
      }
    ]);
  };

  const formatarNumeroCartao = (numero) => numero.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
  const formatarValidade = (validade) => validade.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').substring(0, 5);

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltar} style={styles.botaoVoltar}>
          <Text style={styles.voltarText}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Pagamentos</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitulo}>Método de Pagamento</Text>

          <View style={styles.metodos}>
            <TouchableOpacity
              style={[styles.metodoBtn, metodoSelecionado === 'cartao' && styles.metodoBtnAtivo]}
              onPress={() => selecionarMetodo('cartao')}
            >
              <Text style={[styles.metodoBtnText, metodoSelecionado === 'cartao' && styles.metodoBtnTextAtivo]}>Cartão</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.metodoBtn, metodoSelecionado === 'pix' && styles.metodoBtnAtivo]}
              onPress={() => selecionarMetodo('pix')}
            >
              <Text style={[styles.metodoBtnText, metodoSelecionado === 'pix' && styles.metodoBtnTextAtivo]}>PIX</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.metodoBtn, metodoSelecionado === 'mbway' && styles.metodoBtnAtivo]}
              onPress={() => selecionarMetodo('mbway')}
            >
              <Text style={[styles.metodoBtnText, metodoSelecionado === 'mbway' && styles.metodoBtnTextAtivo]}>MB Way</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.metodoBtn, metodoSelecionado === 'dinheiro' && styles.metodoBtnAtivo]}
              onPress={() => selecionarMetodo('dinheiro')}
            >
              <Text style={[styles.metodoBtnText, metodoSelecionado === 'dinheiro' && styles.metodoBtnTextAtivo]}>Dinheiro</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.textoInfo}>
            Cartão/MB Way: pagamento via plataforma. Dinheiro: pago direto ao motorista (a plataforma aplicará comissão).
          </Text>
        </View>

        {metodoSelecionado === 'cartao' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitulo}>Meus Cartões</Text>
              <TouchableOpacity onPress={() => setModalCartao(true)}>
                <Text style={styles.adicionarBtn}>+ Adicionar</Text>
              </TouchableOpacity>
            </View>

            {cartoes.length === 0 ? (
              <Text style={styles.textoVazio}>Nenhum cartão cadastrado</Text>
            ) : (
              cartoes.map((cartao) => (
                <View key={cartao.id} style={styles.cartaoCard}>
                  <View style={styles.cartaoInfo}>
                    <Text style={styles.cartaoBandeira}>{cartao.bandeira}</Text>
                    <Text style={styles.cartaoNumero}>{cartao.numero}</Text>
                    <Text style={styles.cartaoNome}>{cartao.nome}</Text>
                    <Text style={styles.cartaoValidade}>Validade: {cartao.validade}</Text>
                  </View>
                  <View style={styles.cartaoAcoes}>
                    {!cartao.principal ? (
                      <TouchableOpacity onPress={() => definirCartaoPrincipal(cartao.id)}>
                        <Text style={styles.cartaoAcaoBtn}>Definir como principal</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.cartaoPrincipal}>Principal</Text>
                    )}
                    <TouchableOpacity onPress={() => removerCartao(cartao.id)}>
                      <Text style={styles.cartaoRemover}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {metodoSelecionado === 'mbway' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitulo}>Pagamento via MB Way</Text>
            <Text style={styles.textoInfo}>
              Use o número MB Way abaixo para realizar o pagamento instantâneo.
            </Text>
            
            <View style={styles.pixContainer}>
              <View style={styles.pixChaveBox}>
                <Text style={styles.pixChaveLabel}>Número MB Way</Text>
                <Text style={styles.pixChaveTexto}>{MB_WAY_NUMBER}</Text>
              </View>
              
              <TouchableOpacity style={styles.btnCopiarPix} onPress={copiarMbWay}>
                <Text style={styles.btnCopiarPixText}>📋 Copiar Número</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.textoInfo} style={{ marginTop: 15, fontSize: 12, color: '#94a3b8' }}>
              Após o pagamento, o sistema confirmará automaticamente a transação.
            </Text>
          </View>
        )}

        {metodoSelecionado === 'pix' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitulo}>Pagamento via PIX</Text>
            <Text style={styles.textoInfo}>
              Use a chave PIX abaixo para realizar o pagamento instantâneo.
            </Text>
            
            <View style={styles.pixContainer}>
              <View style={styles.pixChaveBox}>
                <Text style={styles.pixChaveLabel}>Chave PIX (Aleatória)</Text>
                <Text style={styles.pixChaveTexto}>{CHAVE_PIX}</Text>
              </View>
              
              <TouchableOpacity style={styles.btnCopiarPix} onPress={copiarChavePix}>
                <Text style={styles.btnCopiarPixText}>📋 Copiar Chave</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.textoInfo} style={{ marginTop: 15, fontSize: 12, color: '#94a3b8' }}>
              Após o pagamento, o sistema confirmará automaticamente a transação.
            </Text>
          </View>
        )}

        {metodoSelecionado === 'dinheiro' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitulo}>Pagamento em Dinheiro</Text>
            <Text style={styles.textoInfo}>
              Pague diretamente ao motorista. A plataforma cobrará comissão do motorista após a corrida.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modal Adicionar Cartão */}
      <Modal visible={modalCartao} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Adicionar Cartão</Text>

            <TextInput
              style={styles.input}
              placeholder="Número do cartão"
              value={formatarNumeroCartao(novoCartao.numero)}
              onChangeText={(text) => setNovoCartao({ ...novoCartao, numero: text.replace(/\s/g, '') })}
              keyboardType="numeric"
              maxLength={19}
            />

            <TextInput
              style={styles.input}
              placeholder="Nome no cartão"
              value={novoCartao.nome}
              onChangeText={(text) => setNovoCartao({ ...novoCartao, nome: text })}
              autoCapitalize="characters"
            />

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputMetade]}
                placeholder="MM/AA"
                value={formatarValidade(novoCartao.validade)}
                onChangeText={(text) => setNovoCartao({ ...novoCartao, validade: text })}
                keyboardType="numeric"
                maxLength={5}
              />

              <TextInput
                style={[styles.input, styles.inputMetade]}
                placeholder="CVV"
                value={novoCartao.cvv}
                onChangeText={(text) => setNovoCartao({ ...novoCartao, cvv: text })}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
            </View>

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={[styles.modalBotao, styles.modalBotaoCancelar]}
                onPress={() => {
                  setModalCartao(false);
                  setNovoCartao({ numero: '', nome: '', validade: '', cvv: '', bandeira: 'Visa' });
                }}
              >
                <Text style={styles.modalBotaoText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoSalvar]} onPress={adicionarCartao}>
                <Text style={[styles.modalBotaoText, styles.modalBotaoTextSalvar]}>Adicionar</Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#64748b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  botaoVoltar: { padding: 5 },
  voltarText: { fontSize: 16, color: '#3b82f6' },
  titulo: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
  scrollView: { flex: 1 },
  section: { margin: 20, backgroundColor: 'white', borderRadius: 12, padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitulo: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 15 },
  adicionarBtn: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  metodos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metodoBtn: { minWidth: '45%', paddingVertical: 12, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  metodoBtnAtivo: { backgroundColor: '#3b82f6' },
  metodoBtnText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  metodoBtnTextAtivo: { color: 'white' },
  textoInfo: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  textoVazio: { textAlign: 'center', color: '#94a3b8', fontSize: 14, paddingVertical: 20 },
  cartaoCard: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 15, marginBottom: 10 },
  cartaoInfo: { marginBottom: 10 },
  cartaoBandeira: { fontSize: 12, color: '#64748b', marginBottom: 5 },
  cartaoNumero: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 5 },
  cartaoNome: { fontSize: 14, color: '#64748b', marginBottom: 3 },
  cartaoValidade: { fontSize: 12, color: '#94a3b8' },
  cartaoAcoes: { flexDirection: 'row', justifyContent: 'space-between' },
  cartaoAcaoBtn: { fontSize: 12, color: '#3b82f6' },
  cartaoPrincipal: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  cartaoRemover: { fontSize: 12, color: '#ef4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: 'white', borderRadius: 12, padding: 20 },
  modalTitulo: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 20 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, fontSize: 14, color: '#1e293b', marginBottom: 15 },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputMetade: { flex: 1 },
  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBotao: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBotaoCancelar: { backgroundColor: '#e2e8f0' },
  modalBotaoSalvar: { backgroundColor: '#3b82f6' },
  modalBotaoText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  modalBotaoTextSalvar: { color: 'white' },
  pixContainer: { marginTop: 15 },
  pixChaveBox: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 15, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  pixChaveLabel: { fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: '600' },
  pixChaveTexto: { fontSize: 14, color: '#1e293b', fontFamily: 'monospace', lineHeight: 20 },
  btnCopiarPix: { backgroundColor: '#10b981', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnCopiarPixText: { color: 'white', fontSize: 15, fontWeight: '600' }
});