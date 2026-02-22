import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import websocketService from '../services/websocket';
import axios from 'axios';
import { API_URL } from '../config';
import HistoricoScreen from './HistoricoScreen';
import PerfilScreen from './PerfilScreen';

export default function MotoristaScreen({ usuario, onLogout }) {
  const BASE_URL = API_URL.replace(/\/api$/, '');
  const [location, setLocation] = useState(null);
  const [online, setOnline] = useState(false);
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [mostrarCarteira, setMostrarCarteira] = useState(false);
  const [carteira, setCarteira] = useState(null);
  const [transacoes, setTransacoes] = useState([]);
  const [carregandoCarteira, setCarregandoCarteira] = useState(false);
  const [modalRecarga, setModalRecarga] = useState(false);
  const [valorRecarga, setValorRecarga] = useState('');
  const [metodoRecarga, setMetodoRecarga] = useState('cartao');
  const [paymentMethodId, setPaymentMethodId] = useState('pm_card_visa');
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [mostrarMeusDados, setMostrarMeusDados] = useState(false);
  const [mostrarTaximetro, setMostrarTaximetro] = useState(false);
  const [mostrarAgendamentos, setMostrarAgendamentos] = useState(false);
  const [mostrarMeusCarros, setMostrarMeusCarros] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [solicitacao, setSolicitacao] = useState(null);
  const [corridaConfirmada, setCorridaConfirmada] = useState(null);
  const [carros, setCarros] = useState([]);
  const [carregandoCarros, setCarregandoCarros] = useState(false);
  const [salvandoCarro, setSalvandoCarro] = useState(false);
  const [carroEditando, setCarroEditando] = useState(null);
  const [mostrarFormCarro, setMostrarFormCarro] = useState(false);
  const [rotaMotorista, setRotaMotorista] = useState([]);
  const [formCarro, setFormCarro] = useState({
    marca: '',
    modelo: '',
    placa: '',
    ano: '',
    cor: '',
    seguradora: '',
    apolice: '',
    seguroValidade: '',
    inspecaoValidade: '',
    licenciamentoData: '',
    licenciamentoValidade: '',
  });

  const mapRef = useRef(null);
  const motoristaIdRef = useRef(usuario?.id || `motorista_${Date.now()}`);
  const locationRef = useRef(null);
  const onlineRef = useRef(false);

  useEffect(() => {
    obterLocalizacao();
    websocketService.connect();
    websocketService.onNovaSolicitacao((data) => setSolicitacao(data));
    websocketService.onCorridaConfirmada((data) => {
      setCorridaConfirmada((prev) => ({
        ...prev,
        corridaId: data.corridaId,
        status: data.status || 'aceita',
        destinoLat: data.destinoLat || prev?.destino?.latitude,
        destinoLng: data.destinoLng || prev?.destino?.longitude,
        destino: prev?.destino,
        origem: prev?.origem,
        destinoEndereco: data.destinoEndereco || prev?.destinoEndereco,
        origemEndereco: data.origemEndereco || prev?.origemEndereco
      }));
    });
    websocketService.onConnect(() => {
      if (onlineRef.current && locationRef.current) {
        websocketService.motoristaOnline({
          motoristaId: motoristaIdRef.current,
          nome: usuario.nome,
          latitude: locationRef.current.latitude,
          longitude: locationRef.current.longitude,
        });
      }
    });
    return () => websocketService.disconnect();
  }, []);

  useEffect(() => {
    if (mostrarMeusCarros) {
      carregarCarros();
    }
  }, [mostrarMeusCarros]);

  // Centraliza o mapa na localização atual ao obtê-la
  useEffect(() => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion(location, 500);
    }
  }, [location]);

  const obterLocalizacao = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissao negada', 'Precisamos da localizacao');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const regiao = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setLocation(regiao);
    locationRef.current = regiao;
  };

  // Upload de fotos desabilitado
  const escolherFotoDocumento = async (tipo) => {
    Alert.alert('Upload desabilitado', 'Funcionalidade de upload de documentos temporariamente desabilitada');
  };

  const parseSeguro = (texto) => {
    const parts = (texto || '').split('|').map((p) => p.trim());
    let seguradora = '';
    let apolice = '';
    let validade = '';
    parts.forEach((p) => {
      const lower = p.toLowerCase();
      if (lower.includes('seguradora')) seguradora = p.split(':').slice(1).join(':').trim();
      else if (lower.includes('apolice') || lower.includes('apólice')) apolice = p.split(':').slice(1).join(':').trim();
      else if (lower.includes('valid')) validade = p.split(':').slice(1).join(':').trim();
    });
    if (!seguradora && parts[0]) seguradora = parts[0];
    if (!apolice && parts[1]) apolice = parts[1];
    if (!validade && parts[2]) validade = parts[2];
    return { seguradora, apolice, validade };
  };

  const parseInspecao = (texto) => {
    const lower = (texto || '').toLowerCase();
    if (!texto) return '';
    if (lower.includes('valid')) return texto.split(':').slice(1).join(':').trim();
    return texto;
  };

  const parseLicenciamento = (texto) => {
    const parts = (texto || '').split('|').map((p) => p.trim());
    let data = '';
    let validade = '';
    parts.forEach((p) => {
      const lower = p.toLowerCase();
      if (lower.includes('valid')) validade = p.split(':').slice(1).join(':').trim();
      else if (lower.includes('data')) data = p.split(':').slice(1).join(':').trim();
    });
    if (!data && parts[0]) data = parts[0];
    if (!validade && parts[1]) validade = parts[1];
    return { data, validade };
  };

  const formatSeguro = ({ seguradora, apolice, seguroValidade }) => {
    const p = [];
    if (seguradora) p.push(`Seguradora: ${seguradora}`);
    if (apolice) p.push(`Apolice: ${apolice}`);
    if (seguroValidade) p.push(`Validade: ${seguroValidade}`);
    return p.join(' | ');
  };

  const formatInspecao = ({ inspecaoValidade }) => (inspecaoValidade ? `Validade: ${inspecaoValidade}` : '');
  const formatLicenciamento = ({ licenciamentoData, licenciamentoValidade }) => {
    const p = [];
    if (licenciamentoData) p.push(`Data: ${licenciamentoData}`);
    if (licenciamentoValidade) p.push(`Validade: ${licenciamentoValidade}`);
    return p.join(' | ');
  };

  const decodePolyline = (encoded) => {
    if (!encoded) return [];
    const poly = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;
      poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return poly;
  };

  const calcularRotaMotorista = async (origem, destino) => {
    try {
      if (!origem || !destino) return;
      const response = await axios.post(`${API_URL}/corridas/rota`, {
        origemLat: origem.latitude,
        origemLng: origem.longitude,
        destinoLat: destino.latitude,
        destinoLng: destino.longitude
      });
      const coords = decodePolyline(response.data.polyline);
      setRotaMotorista(coords);
    } catch (error) {
      console.error('Erro ao calcular rota do motorista:', error);
      setRotaMotorista([]);
    }
  };

  const ficarOnline = () => {
    if (!location) return;
    if (!websocketService.isConnected()) {
      websocketService.connect();
    }
    websocketService.motoristaOnline({
      motoristaId: motoristaIdRef.current,
      nome: usuario.nome,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setOnline(true);
    onlineRef.current = true;
  };

  // Ajusta zoom quando a rota do motorista é atualizada
  useEffect(() => {
    if (mapRef.current && rotaMotorista.length > 1) {
      mapRef.current.fitToCoordinates(rotaMotorista, {
        edgePadding: { top: 80, right: 40, bottom: 280, left: 40 },
        animated: true,
      });
    }
  }, [rotaMotorista]);

  const ficarOffline = () => {
    websocketService.motoristaOffline(motoristaIdRef.current);
    setOnline(false);
    onlineRef.current = false;
    setSolicitacao(null);
    setCorridaConfirmada(null);
    setRotaMotorista([]);
    websocketService.disconnect();
  };

  const aceitarCorrida = () => {
    if (!solicitacao || !location) return;
    // Define corrida confirmada localmente para termos destino/origem
    setCorridaConfirmada({
      corridaId: solicitacao.corridaId,
      status: 'aceita',
      destino: solicitacao.destino,
      origem: solicitacao.origem,
      destinoEndereco: solicitacao.destinoEndereco,
      origemEndereco: solicitacao.origemEndereco
    });
    calcularRotaMotorista(location, solicitacao.origem || solicitacao.destino);
    websocketService.aceitarCorrida({
      corridaId: solicitacao.corridaId,
      motoristaId: motoristaIdRef.current,
      motoristaNome: usuario.nome,
      motoristaLocalizacao: { latitude: location.latitude, longitude: location.longitude },
      motoristaLat: location.latitude,
      motoristaLng: location.longitude,
    });
    axios.patch(`${API_URL}/corridas/${solicitacao.corridaId}/aceitar`, {
      motoristaId: motoristaIdRef.current,
    }).catch(() => {});
    setSolicitacao(null);
  };

  const avisarChegada = () => {
    if (!corridaConfirmada) return;
    websocketService.motoristaChegouOrigem({
      corridaId: corridaConfirmada.corridaId,
      motoristaId: motoristaIdRef.current,
    });
    setCorridaConfirmada((prev) => (prev ? { ...prev, status: 'chegou' } : prev));
  };

  const iniciarCorrida = () => {
    if (!corridaConfirmada) return;
    if (location) {
      const destino =
        corridaConfirmada.destino ||
        (corridaConfirmada.destinoLat && corridaConfirmada.destinoLng
          ? { latitude: corridaConfirmada.destinoLat, longitude: corridaConfirmada.destinoLng }
          : null);
      if (destino) calcularRotaMotorista(location, destino);
    }
    websocketService.iniciarCorrida({
      corridaId: corridaConfirmada.corridaId,
      motoristaId: motoristaIdRef.current,
    });
    setCorridaConfirmada((prev) => (prev ? { ...prev, status: 'em_andamento' } : prev));
  };

  const finalizarCorrida = () => {
    if (!corridaConfirmada) return;
    websocketService.finalizarCorrida({
      corridaId: corridaConfirmada.corridaId,
      motoristaId: motoristaIdRef.current,
    });
    axios.patch(`${API_URL}/corridas/${corridaConfirmada.corridaId}/finalizar`).catch(() => {});
    setCorridaConfirmada(null);
    setRotaMotorista([]);
  };

  const recusarCorrida = () => {
    if (solicitacao?.corridaId) {
      websocketService.recusarCorrida({
        corridaId: solicitacao.corridaId,
        motoristaId: motoristaIdRef.current
      });
    }
    setSolicitacao(null);
  };

  const notificarAlteracaoVeiculo = async (acao, payload) => {
    try {
      await axios.post(`${API_URL}/admin/alertas`, {
        tipo: 'veiculo',
        acao,
        motoristaId: usuario.id,
        carroId: payload?.id,
        dados: payload,
      });
    } catch (error) {
      console.error('Erro ao notificar admin sobre veiculo:', error);
    }
  };

  const carregarCarros = async () => {
    setCarregandoCarros(true);
    try {
      const res = await axios.get(`${API_URL}/motoristas/${usuario.id}/carros`);
      setCarros(res.data || []);
    } catch (error) {
      console.error('Erro ao carregar carros:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar seus carros');
    } finally {
      setCarregandoCarros(false);
    }
  };

  const abrirNovoCarro = () => {
    setCarroEditando(null);
    setFormCarro({
      marca: '',
      modelo: '',
      placa: '',
      ano: '',
      cor: '',
      seguradora: '',
      apolice: '',
      seguroValidade: '',
      inspecaoValidade: '',
      licenciamentoData: '',
      licenciamentoValidade: '',
    });
    setMostrarFormCarro(true);
  };

  const abrirEdicaoCarro = (carro) => {
    setCarroEditando(carro);
    setFormCarro({
      marca: carro.marca || '',
      modelo: carro.modelo || '',
      placa: carro.placa || '',
      ano: carro.ano ? String(carro.ano) : '',
      cor: carro.cor || '',
      seguradora: parseSeguro(carro.seguro).seguradora || '',
      apolice: parseSeguro(carro.seguro).apolice || '',
      seguroValidade: parseSeguro(carro.seguro).validade || '',
      inspecaoValidade: parseInspecao(carro.inspecao) || '',
      licenciamentoData: parseLicenciamento(carro.licenciamento).data || '',
      licenciamentoValidade: parseLicenciamento(carro.licenciamento).validade || '',
    });
    setMostrarFormCarro(true);
  };

  const salvarCarro = async () => {
    if (!formCarro.marca || !formCarro.modelo || !formCarro.placa) {
      Alert.alert('Erro', 'Informe marca, modelo e placa');
      return;
    }
    if (formCarro.ano && formCarro.ano.length < 4) {
      Alert.alert('Erro', 'Ano invalido');
      return;
    }
    setSalvandoCarro(true);
    try {
      const seguroStr = formatSeguro(formCarro);
      const inspecaoStr = formatInspecao(formCarro);
      const licenciamentoStr = formatLicenciamento(formCarro);

      const formData = new FormData();
      formData.append('marca', formCarro.marca);
      formData.append('modelo', formCarro.modelo);
      formData.append('placa', formCarro.placa);
      if (formCarro.ano) formData.append('ano', String(formCarro.ano));
      if (formCarro.cor) formData.append('cor', formCarro.cor);
      if (seguroStr) formData.append('seguro', seguroStr);
      if (inspecaoStr) formData.append('inspecao', inspecaoStr);
      if (licenciamentoStr) formData.append('licenciamento', licenciamentoStr);

      if (carroEditando) {
        const res = await axios.put(
          `${API_URL}/motoristas/${usuario.id}/carros/${carroEditando.id}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        await notificarAlteracaoVeiculo('editar', res.data || { ...carroEditando, ...formCarro, seguro: seguroStr, inspecao: inspecaoStr, licenciamento: licenciamentoStr });
      } else {
        const res = await axios.post(
          `${API_URL}/motoristas/${usuario.id}/carros`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        await notificarAlteracaoVeiculo('adicionar', res.data || { ...formCarro, seguro: seguroStr, inspecao: inspecaoStr, licenciamento: licenciamentoStr });
      }
      Alert.alert('Sucesso', 'Carro salvo com sucesso!');
      setMostrarFormCarro(false);
      await carregarCarros();
    } catch (error) {
      console.error('Erro ao salvar carro:', error);
      Alert.alert('Erro', 'Nao foi possivel salvar o carro');
    } finally {
      setSalvandoCarro(false);
    }
  };

  const removerCarro = (carroId) => {
    Alert.alert('Remover carro', 'Deseja remover este carro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/motoristas/${usuario.id}/carros/${carroId}`);
            await notificarAlteracaoVeiculo('remover', { id: carroId });
            carregarCarros();
          } catch (error) {
            console.error('Erro ao remover carro:', error);
            Alert.alert('Erro', 'Nao foi possivel remover o carro');
          }
        }
      }
    ]);
  };

  const definirPrincipal = async (carroId) => {
    try {
      await axios.patch(`${API_URL}/motoristas/${usuario.id}/carros/${carroId}/principal`);
      await notificarAlteracaoVeiculo('definir_principal', { id: carroId });
      carregarCarros();
    } catch (error) {
      console.error('Erro ao definir principal:', error);
      Alert.alert('Erro', 'Nao foi possivel definir o carro principal');
    }
  };

  const centralizarMapa = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  };

  const carregarCarteira = async () => {
    setCarregandoCarteira(true);
    try {
      const [carteiraRes, transacoesRes] = await Promise.all([
        axios.get(`${API_URL}/pagamentos/carteira/${usuario.id}`),
        axios.get(`${API_URL}/pagamentos/transacoes/${usuario.id}?limit=50`)
      ]);
      setCarteira(carteiraRes.data);
      setTransacoes(transacoesRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar carteira do motorista:', error);
      Alert.alert('Erro', 'Não foi possível carregar a carteira');
    } finally {
      setCarregandoCarteira(false);
    }
  };

  const adicionarSaldo = async () => {
    const valor = parseFloat(valorRecarga);
    if (!valor || valor <= 0) {
      Alert.alert('Erro', 'Digite um valor válido');
      return;
    }
    if (valor < 10) {
      Alert.alert('Erro', 'Valor mínimo de recarga: R$ 10,00');
      return;
    }
    try {
      await axios.post(`${API_URL}/pagamentos/carteira/adicionar`, {
        userId: usuario.id,
        valor,
        metodoPagamento: metodoRecarga,
        paymentMethodId: paymentMethodId || 'pm_card_visa'
      });
      Alert.alert('Sucesso', `R$ ${valor.toFixed(2)} adicionados à sua carteira!`);
      setModalRecarga(false);
      setValorRecarga('');
      setPaymentMethodId('pm_card_visa');
      carregarCarteira();
    } catch (error) {
      console.error('Erro ao adicionar saldo:', error);
      Alert.alert('Erro', 'Não foi possível adicionar saldo');
    }
  };

  if (!location) {
    return (
      <View style={styles.loading}>
        <Text>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={location}
        ref={mapRef}
        showsMyLocationButton={false}
        showsUserLocation={true}
        toolbarEnabled={false}
        showsCompass={false}
        myLocationButtonEnabled={false}
        zoomControlEnabled={false}
        provider={MapView.PROVIDER_GOOGLE}
        rotateEnabled={false}
      >
        <Marker
          key={online ? 'driver-online' : 'driver-offline'}
          coordinate={location}
          tracksViewChanges={true}
        >
          <View style={[styles.carPin, online ? styles.carPinOnline : styles.carPinOffline]}>
            <MaterialCommunityIcons name="car" size={20} color="#fff" />
          </View>
        </Marker>
        {rotaMotorista.length > 0 && (
          <Polyline coordinates={rotaMotorista} strokeWidth={4} strokeColor="#0ea5e9" />
        )}
      </MapView>

      <TouchableOpacity style={styles.menuButton} onPress={() => setMostrarMenu(true)}>
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
      </TouchableOpacity>

      <View style={[styles.statusBadge, online ? styles.online : styles.offline]}>
        <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
      </View>

      {solicitacao && (
        <View style={styles.corridaCard}>
      <Text style={styles.corridaTitulo}>Nova corrida</Text>
      <Text style={styles.corridaLinha}>Passageiro: {solicitacao.passageiroNome || '-'}</Text>
      <Text style={styles.corridaLinha}>
        Origem: {solicitacao.origemEndereco || `${solicitacao.origem?.latitude?.toFixed(4)}, ${solicitacao.origem?.longitude?.toFixed(4)}`}
      </Text>
      <Text style={styles.corridaLinha}>
        Destino: {solicitacao.destinoEndereco || `${solicitacao.destino?.latitude?.toFixed(4)}, ${solicitacao.destino?.longitude?.toFixed(4)}`}
      </Text>
          <Text style={styles.corridaLinha}>Preco: R$ {solicitacao.preco?.toFixed(2) || '--'}</Text>
          <View style={styles.corridaAcoes}>
            <TouchableOpacity style={styles.btnRecusar} onPress={recusarCorrida}>
              <Text style={styles.btnText}>Recusar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnAceitar} onPress={aceitarCorrida}>
              <Text style={styles.btnText}>Aceitar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {corridaConfirmada && (
        corridaConfirmada.status === 'em_andamento' ? (
          <View style={[styles.corridaCard, styles.corridaCardSlim]}>
            <TouchableOpacity style={[styles.btnAceitar, { flex: 1 }]} onPress={finalizarCorrida}>
              <Text style={styles.btnText}>Finalizar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.corridaCard}>
            <Text style={styles.corridaTitulo}>Corrida aceita</Text>
            <Text style={styles.corridaLinha}>Corrida: {corridaConfirmada.corridaId}</Text>
            <Text style={styles.corridaLinha}>
              Destino: {corridaConfirmada.destinoEndereco || `${corridaConfirmada.destinoLat?.toFixed(4)}, ${corridaConfirmada.destinoLng?.toFixed(4)}`}
            </Text>
            <Text style={styles.corridaLinha}>Status: {corridaConfirmada.status || 'aceita'}</Text>
            <View style={styles.corridaAcoes}>
              <TouchableOpacity style={styles.btnRecusar} onPress={avisarChegada}>
                <Text style={styles.btnText}>Cheguei</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAceitar} onPress={iniciarCorrida}>
                <Text style={styles.btnText}>Iniciar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAceitar} onPress={finalizarCorrida}>
                <Text style={styles.btnText}>Finalizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      )}

      <View style={styles.bottomButton}>
        {!online ? (
          <TouchableOpacity style={styles.btnOnline} onPress={ficarOnline}>
            <Text style={styles.btnText}>Ficar Online</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnOffline} onPress={ficarOffline}>
            <Text style={styles.btnText}>Ficar Offline</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.botaoCentralizar} onPress={centralizarMapa}>
        <Text style={styles.botaoCentralizarText}>↺</Text>
      </TouchableOpacity>

      <Modal visible={mostrarMenu} transparent animationType="slide" onRequestClose={() => setMostrarMenu(false)}>
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMostrarMenu(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatar}>
                {usuario?.avatarUri ? (
                  <Image source={{ uri: usuario.avatarUri }} style={styles.drawerAvatarImg} />
                ) : (
                  <Text style={styles.drawerAvatarText}>{usuario.nome.charAt(0)}</Text>
                )}
              </View>
              <View style={styles.drawerInfo}>
                <Text style={styles.drawerNome}>{usuario.nome}</Text>
                <Text style={styles.drawerEditar}>Motorista</Text>
              </View>
            </View>
            <ScrollView style={styles.drawerList}>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarHistorico(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemText}>Histórico de corridas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarCarteira(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemText}>Minha carteira</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarAgendamentos(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemText}>Agendamentos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarMeusCarros(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemText}>Meus carros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarMeusDados(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemText}>Meus dados</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarTaximetro(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemText}>Taxímetro</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarConfig(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemText}>Configurações</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={onLogout}>
                <Text style={[styles.drawerItemText, { color: '#f87171' }]}>Sair</Text>
              </TouchableOpacity>
              <View style={styles.drawerFooter}>
                <Text style={styles.drawerFooterText}>Meu código de indicação</Text>
                <Text style={styles.drawerFooterCode}>M96062</Text>
                <Text style={styles.drawerFooterText}>Versão 1.2.47</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={mostrarHistorico} animationType="slide">
        <HistoricoScreen usuario={usuario} isMotorista />
        <TouchableOpacity style={styles.modalBotaoFechar} onPress={() => setMostrarHistorico(false)}>
          <Text style={styles.modalBotaoFecharText}>Fechar</Text>
        </TouchableOpacity>
      </Modal>
      <Modal visible={mostrarCarteira} animationType="slide" onRequestClose={() => setMostrarCarteira(false)}>
        <View style={styles.carteiraContainer}>
          <View style={styles.carteiraHeader}>
            <Text style={styles.carteiraTitulo}>Carteira do Motorista</Text>
            <TouchableOpacity onPress={() => setMostrarCarteira(false)}>
              <Text style={styles.carteiraFechar}>Fechar</Text>
            </TouchableOpacity>
          </View>
          {carregandoCarteira ? (
            <View style={styles.loading}>
              <Text>Carregando...</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              <View style={styles.carteiraCard}>
                <Text style={styles.carteiraLabel}>Saldo disponível</Text>
                <Text style={styles.carteiraValor}>R$ {(carteira?.saldo || 0).toFixed(2)}</Text>
                <TouchableOpacity style={styles.botaoAdicionar} onPress={() => setModalRecarga(true)}>
                  <Text style={styles.botaoAdicionarText}>Adicionar Saldo</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.transacoesTitulo}>Transações</Text>
              {transacoes.length === 0 ? (
                <Text style={styles.textoVazio}>Nenhuma transação</Text>
              ) : (
                transacoes.map((t) => (
                  <View key={t.id} style={styles.transacaoLinha}>
                    <View>
                      <Text style={styles.transacaoDescricao}>{t.descricao}</Text>
                      <Text style={styles.transacaoData}>{new Date(t.createdAt).toLocaleDateString('pt-BR')}</Text>
                    </View>
                    <Text style={[styles.transacaoValor, t.tipo === 'credito' ? styles.transacaoCredito : styles.transacaoDebito]}>
                      {t.tipo === 'credito' ? '+' : '-'} R$ {t.valor.toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
      <Modal visible={modalRecarga} animationType="slide" transparent onRequestClose={() => setModalRecarga(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Adicionar Saldo</Text>
            <TextInput
              style={styles.input}
              placeholder="Valor (R$)"
              value={valorRecarga}
              onChangeText={setValorRecarga}
              keyboardType="numeric"
            />
            <Text style={styles.modalTitulo}>Método</Text>
            <View style={styles.metodos}>
              <TouchableOpacity
                style={[styles.metodoBtn, metodoRecarga === 'cartao' && styles.metodoBtnAtivo]}
                onPress={() => setMetodoRecarga('cartao')}
              >
                <Text style={[styles.metodoBtnText, metodoRecarga === 'cartao' && styles.metodoBtnTextAtivo]}>Cartão</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metodoBtn, metodoRecarga === 'mbway' && styles.metodoBtnAtivo]}
                onPress={() => setMetodoRecarga('mbway')}
              >
                <Text style={[styles.metodoBtnText, metodoRecarga === 'mbway' && styles.metodoBtnTextAtivo]}>MB Way</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="PaymentMethod ID (ex: pm_card_visa)"
              value={paymentMethodId}
              onChangeText={setPaymentMethodId}
              autoCapitalize="none"
            />
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoCancelar]} onPress={() => setModalRecarga(false)}>
                <Text style={styles.modalBotaoText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoSalvar]} onPress={adicionarSaldo}>
                <Text style={[styles.modalBotaoText, styles.modalBotaoTextSalvar]}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={mostrarAgendamentos} animationType="slide" transparent onRequestClose={() => setMostrarAgendamentos(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Agendamentos</Text>
            <Text style={styles.modalTexto}>Em breve.</Text>
            <TouchableOpacity style={styles.modalBotaoFechar} onPress={() => setMostrarAgendamentos(false)}>
              <Text style={styles.modalBotaoFecharText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={mostrarMeusCarros} animationType="slide" transparent onRequestClose={() => setMostrarMeusCarros(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalContainerTall]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Meus carros</Text>
              <TouchableOpacity onPress={abrirNovoCarro}>
                <Text style={styles.adicionarBtn}>+ Adicionar</Text>
              </TouchableOpacity>
            </View>
            {carregandoCarros ? (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#0ea5e9" />
                <Text style={{ marginTop: 8, color: '#475569' }}>Carregando carros...</Text>
              </View>
            ) : carros.length === 0 ? (
              <Text style={styles.textoVazio}>Nenhum carro cadastrado</Text>
            ) : (
              <ScrollView style={{ flex: 1 }}>
                {carros.map((carro) => (
                  <View key={carro.id} style={styles.carroCard}>
                    <View style={styles.carroHeader}>
                      <Text style={styles.carroTitulo}>{carro.marca} {carro.modelo}</Text>
                      {carro.principal && <Text style={styles.carroBadge}>Principal</Text>}
                    </View>
                    <Text style={styles.carroCampo}>Placa: {carro.placa || '-'}</Text>
                    <Text style={styles.carroCampo}>Ano: {carro.ano || '-'}</Text>
                    <Text style={styles.carroCampo}>Cor: {carro.cor || '-'}</Text>
                    <Text style={styles.carroCampo}>Seguro: {carro.seguro || '-'}</Text>
                    <Text style={styles.carroCampo}>Inspecao: {carro.inspecao || '-'}</Text>
                    <Text style={styles.carroCampo}>Licenciamento: {carro.licenciamento || '-'}</Text>
                    {(carro.docSeguroUri || carro.docInspecaoUri || carro.docLicenciamentoUri) && (
                      <View style={styles.carroDocs}>
                        {carro.docSeguroUri && (
                          <TouchableOpacity onPress={() => Linking.openURL(`${BASE_URL}${carro.docSeguroUri}`)}>
                            <Text style={styles.carroDocLink}>Ver documento do seguro</Text>
                          </TouchableOpacity>
                        )}
                        {carro.docInspecaoUri && (
                          <TouchableOpacity onPress={() => Linking.openURL(`${BASE_URL}${carro.docInspecaoUri}`)}>
                            <Text style={styles.carroDocLink}>Ver documento da inspecao</Text>
                          </TouchableOpacity>
                        )}
                        {carro.docLicenciamentoUri && (
                          <TouchableOpacity onPress={() => Linking.openURL(`${BASE_URL}${carro.docLicenciamentoUri}`)}>
                            <Text style={styles.carroDocLink}>Ver documento do licenciamento</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    <View style={styles.carroAcoes}>
                      <TouchableOpacity style={styles.carroBtn} onPress={() => abrirEdicaoCarro(carro)}>
                        <Text style={styles.carroBtnText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.carroBtn, styles.carroBtnDanger]} onPress={() => removerCarro(carro.id)}>
                        <Text style={[styles.carroBtnText, styles.carroBtnTextDanger]}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                    {!carro.principal && (
                      <TouchableOpacity style={styles.carroPrincipalBtn} onPress={() => definirPrincipal(carro.id)}>
                        <Text style={styles.carroPrincipalText}>Definir como principal</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalBotaoFechar} onPress={() => setMostrarMeusCarros(false)}>
              <Text style={styles.modalBotaoFecharText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={mostrarFormCarro} animationType="slide" transparent onRequestClose={() => setMostrarFormCarro(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalContainerFull]}>
            <Text style={styles.modalTitulo}>{carroEditando ? 'Editar carro' : 'Adicionar carro'}</Text>
            <ScrollView style={{ flex: 1 }}>
              <TextInput style={styles.input} placeholder="Marca" value={formCarro.marca} onChangeText={(text) => setFormCarro({ ...formCarro, marca: text })} />
              <TextInput style={styles.input} placeholder="Modelo" value={formCarro.modelo} onChangeText={(text) => setFormCarro({ ...formCarro, modelo: text })} />
              <TextInput style={styles.input} placeholder="Placa" value={formCarro.placa} onChangeText={(text) => setFormCarro({ ...formCarro, placa: text })} autoCapitalize="characters" />
              <TextInput style={styles.input} placeholder="Ano" value={formCarro.ano} onChangeText={(text) => setFormCarro({ ...formCarro, ano: text })} keyboardType="numeric" />
              <TextInput style={styles.input} placeholder="Cor" value={formCarro.cor} onChangeText={(text) => setFormCarro({ ...formCarro, cor: text })} />
              <Text style={styles.label}>Seguro</Text>
              <TextInput style={styles.input} placeholder="Seguradora" value={formCarro.seguradora} onChangeText={(text) => setFormCarro({ ...formCarro, seguradora: text })} />
              <TextInput style={styles.input} placeholder="N° da apolice" value={formCarro.apolice} onChangeText={(text) => setFormCarro({ ...formCarro, apolice: text })} />
              <TextInput style={styles.input} placeholder="Validade (Seguro)" value={formCarro.seguroValidade} onChangeText={(text) => setFormCarro({ ...formCarro, seguroValidade: text })} />
              <TouchableOpacity style={styles.uploadBtn} onPress={() => escolherFotoDocumento('seguro')}>
              </TouchableOpacity>

              <Text style={styles.label}>Inspecao</Text>
              <TextInput style={styles.input} placeholder="Validade (Inspecao)" value={formCarro.inspecaoValidade} onChangeText={(text) => setFormCarro({ ...formCarro, inspecaoValidade: text })} />
              <TouchableOpacity style={styles.uploadBtn} onPress={() => escolherFotoDocumento('inspecao')}>
              </TouchableOpacity>

              <Text style={styles.label}>Licenciamento</Text>
              <TextInput style={styles.input} placeholder="Data" value={formCarro.licenciamentoData} onChangeText={(text) => setFormCarro({ ...formCarro, licenciamentoData: text })} />
              <TextInput style={styles.input} placeholder="Validade (Licenciamento)" value={formCarro.licenciamentoValidade} onChangeText={(text) => setFormCarro({ ...formCarro, licenciamentoValidade: text })} />
              <TouchableOpacity style={styles.uploadBtn} onPress={() => escolherFotoDocumento('licenciamento')}>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoCancelar]} onPress={() => setMostrarFormCarro(false)}>
                <Text style={styles.modalBotaoText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoSalvar]} onPress={salvarCarro} disabled={salvandoCarro}>
                <Text style={[styles.modalBotaoText, styles.modalBotaoTextSalvar]}>{salvandoCarro ? 'Salvando...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={mostrarMeusDados} animationType="slide" transparent onRequestClose={() => setMostrarMeusDados(false)}>
        <View style={{ flex: 1, backgroundColor: 'white' }}>
          <PerfilScreen usuario={usuario} onLogout={onLogout} onAtualizar={() => {}} />
          <TouchableOpacity style={[styles.modalBotaoFechar, { marginHorizontal: 20 }]} onPress={() => setMostrarMeusDados(false)}>
            <Text style={styles.modalBotaoFecharText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={mostrarTaximetro} animationType="slide" transparent onRequestClose={() => setMostrarTaximetro(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Taxímetro</Text>
            <Text style={styles.modalTexto}>Em breve.</Text>
            <TouchableOpacity style={styles.modalBotaoFechar} onPress={() => setMostrarTaximetro(false)}>
              <Text style={styles.modalBotaoFecharText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={mostrarConfig} animationType="slide" transparent onRequestClose={() => setMostrarConfig(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Configurações</Text>
            <Text style={styles.modalTexto}>Em breve.</Text>
            <TouchableOpacity style={styles.modalBotaoFechar} onPress={() => setMostrarConfig(false)}>
              <Text style={styles.modalBotaoFecharText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  menuButton: { position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'white', padding: 10, borderRadius: 12, elevation: 4 },
  menuLine: { width: 22, height: 2, backgroundColor: '#0f172a', marginVertical: 2 },
  statusBadge: { position: 'absolute', top: 55, right: 20, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, zIndex: 999 },
  online: { backgroundColor: '#10b981' },
  offline: { backgroundColor: '#ef4444' },
  statusText: { color: '#fff', fontSize: 12 },

  bottomButton: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  btnOnline: { backgroundColor: '#10b981', padding: 16, borderRadius: 10, alignItems: 'center' },
  btnOffline: { backgroundColor: '#ef4444', padding: 16, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },

  corridaCard: { position: 'absolute', bottom: 120, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 5 },
  corridaCardSlim: { paddingVertical: 12, paddingHorizontal: 16 },
  corridaTitulo: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  corridaLinha: { fontSize: 14, color: '#334155', marginBottom: 4 },
  corridaAcoes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btnAceitar: { flex: 1, backgroundColor: '#10b981', padding: 12, borderRadius: 10, alignItems: 'center', marginLeft: 6 },
  btnRecusar: { flex: 1, backgroundColor: '#ef4444', padding: 12, borderRadius: 10, alignItems: 'center', marginRight: 6 },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'flex-start' },
  drawer: { width: '75%', backgroundColor: '#0f172a', paddingTop: 60, paddingHorizontal: 20 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  drawerAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  drawerAvatarImg: { width: 56, height: 56, borderRadius: 28 },
  drawerAvatarText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  drawerInfo: { flex: 1 },
  drawerNome: { color: 'white', fontSize: 16, fontWeight: '700' },
  drawerEditar: { color: '#e2e8f0', fontSize: 12, marginTop: 2 },
  drawerPontos: { color: '#38bdf8', fontSize: 12, marginTop: 2 },
  drawerList: { flex: 1 },
  drawerItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  drawerItemText: { color: 'white', fontSize: 15, fontWeight: '600' },
  drawerFooter: { paddingVertical: 16, alignItems: 'flex-start' },
  drawerFooterText: { color: '#cbd5e1', fontSize: 12 },
  drawerFooterCode: { color: '#38bdf8', fontSize: 14, fontWeight: '700', marginBottom: 4 },

  botaoCentralizar: { position: 'absolute', bottom: 90, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 7, borderWidth: 1, borderColor: '#e2e8f0', zIndex: 999 },
  botaoCentralizarText: { fontSize: 22, color: '#0f172a', fontWeight: '700' },

  carteiraContainer: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#f8fafc' },
  carteiraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  carteiraTitulo: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  carteiraFechar: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  carteiraCard: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 20, elevation: 2 },
  carteiraLabel: { color: '#64748b', fontSize: 14, marginBottom: 6 },
  carteiraValor: { fontSize: 32, fontWeight: '800', color: '#0f172a' },
  transacoesTitulo: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  transacaoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  transacaoDescricao: { fontSize: 14, color: '#0f172a' },
  transacaoData: { fontSize: 12, color: '#94a3b8' },
  transacaoValor: { fontSize: 15, fontWeight: '700' },
  transacaoCredito: { color: '#10b981' },
  transacaoDebito: { color: '#ef4444' },

  botaoAdicionar: { marginTop: 12, backgroundColor: '#0ea5e9', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  botaoAdicionarText: { color: 'white', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: 'white', borderRadius: 12, padding: 20 },
  modalContainerTall: { width: '98%', height: '98%' },
  modalContainerFull: { width: '100%', height: '100%', borderRadius: 0 },
  modalTitulo: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  adicionarBtn: { fontSize: 14, color: '#0ea5e9', fontWeight: '700' },
  input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, fontSize: 14, color: '#0f172a', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 8, marginBottom: 4 },
  metodos: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  metodoBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#e2e8f0', alignItems: 'center' },
  metodoBtnAtivo: { backgroundColor: '#0ea5e9' },
  metodoBtnText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  metodoBtnTextAtivo: { color: 'white' },
  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBotao: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBotaoCancelar: { backgroundColor: '#e2e8f0' },
  modalBotaoSalvar: { backgroundColor: '#0ea5e9' },
  modalBotaoText: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  modalBotaoTextSalvar: { color: 'white' },
  modalBotaoFechar: { margin: 20, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBotaoFecharText: { color: 'white', fontWeight: '700' },
  modalTexto: { color: '#475569', fontSize: 14, marginBottom: 10, textAlign: 'center' },
  textoVazio: { textAlign: 'center', color: '#94a3b8', fontSize: 14, marginVertical: 10 },
  carroCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  carroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  carroTitulo: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  carroBadge: { backgroundColor: '#10b981', color: 'white', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: '700' },
  carroCampo: { color: '#475569', fontSize: 13, marginBottom: 3 },
  carroDocs: { marginTop: 6 },
  carroDocLink: { color: '#0ea5e9', fontSize: 13, textDecorationLine: 'underline', marginBottom: 4 },
  carroAcoes: { flexDirection: 'row', gap: 10, marginTop: 8 },
  carroBtn: { flex: 1, backgroundColor: '#e2e8f0', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  carroBtnText: { color: '#0f172a', fontWeight: '700' },
  carroBtnDanger: { backgroundColor: '#fee2e2' },
  carroBtnTextDanger: { color: '#ef4444' },
  carroPrincipalBtn: { marginTop: 8, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#0ea5e9' },
  carroPrincipalText: { color: 'white', fontWeight: '700' },
  uploadBtn: { backgroundColor: '#e2e8f0', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 12 },
  uploadBtnText: { color: '#0f172a', fontWeight: '700', marginBottom: 6 },
  uploadPreview: { width: '100%', height: 160, borderRadius: 8, backgroundColor: '#cbd5e1' },
  carPin: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  carPinOnline: { backgroundColor: '#22c55e' },
  carPinOffline: { backgroundColor: '#0f172a' }
});