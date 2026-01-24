import React, { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import websocketService from '../services/websocket';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HistoricoScreen from './HistoricoScreen';
import AvaliacaoScreen from './AvaliacaoScreen';
import PerfilScreen from './PerfilScreen';
import ConfigScreen from './ConfigScreen';
import PagamentoScreen from './PagamentoScreen';
import { API_URL } from '../config';

export default function MapaScreen({ usuario, onLogout, onAtualizarUsuario }) {
  const isMotorista = usuario?.papel === 'motorista' || usuario?.tipo === 'motorista';
  const disableMap = true;
  const [location, setLocation] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [destino, setDestino] = useState(null);
  const [destinoEndereco, setDestinoEndereco] = useState('');
  const [rota, setRota] = useState([]);
  const [distancia, setDistancia] = useState(0);
  const [preco, setPreco] = useState(0);
  const [corridaAtual, setCorridaAtual] = useState(null);
  const corridaAtualRef = useRef(null);
  const [favoritos, setFavoritos] = useState([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [mostrarPagamentos, setMostrarPagamentos] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [mostrarAgendamentos, setMostrarAgendamentos] = useState(false);
  const [mostrarCarteiraPassageiro, setMostrarCarteiraPassageiro] = useState(false);
  const [mostrarTermos, setMostrarTermos] = useState(false);
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [mostrarAvaliacao, setMostrarAvaliacao] = useState(false);
  const [corridaParaAvaliar, setCorridaParaAvaliar] = useState(null);
  const [websocketConectado, setWebsocketConectado] = useState(false);
  const [aguardandoMotorista, setAguardandoMotorista] = useState(false);
  const [enderecoBusca, setEnderecoBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const mapRef = useRef(null);
  const pollingRef = useRef(null);
  const calcularTempoEstimado = (distanciaKm, tempoServer) => {
    if (tempoServer && tempoServer > 0) return tempoServer;
    if (!distanciaKm || distanciaKm <= 0) return 0;
    const minutos = (distanciaKm / 30) * 60; // fallback: 30 km/h
    return Math.max(1, Math.ceil(minutos));
  };

  const limparEstadoCorrida = () => {
    setCorridaAtual(null);
    setDestino(null);
    setDestinoEndereco('');
    setRota([]);
    setDistancia(0);
    setPreco(0);
    setAguardandoMotorista(false);
    setEnderecoBusca('');
    setSugestoes([]);
  };

  useEffect(() => {
    obterLocalizacao();
    carregarFavoritos();
    conectarWebSocket();
    return () => websocketService.disconnect();
  }, []);

  useEffect(() => {
    corridaAtualRef.current = corridaAtual;
  }, [corridaAtual]);

  const conectarWebSocket = () => {
    websocketService.connect();
    websocketService.onConnect(() => {
      setWebsocketConectado(true);
      websocketService.entrarComoPassageiro(usuario.id);
    });
    websocketService.onDisconnect(() => setWebsocketConectado(false));
    websocketService.onCorridaAceita((data) => {
      setAguardandoMotorista(false);
      setCorridaAtual((prev) => ({
        ...prev,
        motoristaId: data.motoristaId,
        motoristaNome: data.motoristaNome,
        motoristaLocalizacao: data.motoristaLocalizacao,
        status: 'aceita'
      }));
      Alert.alert('Motorista encontrado', `${data.motoristaNome} aceitou sua corrida!`);
    });
    websocketService.onCorridaRecusada((data) => {
      const atual = corridaAtualRef.current;
      if (!atual || atual.id !== data.corridaId) return;
      setCorridaAtual((prev) => (prev ? { ...prev, status: 'aguardando', motoristaId: null, motoristaNome: null } : prev));
      setAguardandoMotorista(true);
      Alert.alert('Motorista recusou', 'Estamos buscando outro motorista...');
    });
    websocketService.onMotoristaChegou(() => {
      setCorridaAtual((prev) => (prev ? { ...prev, status: 'chegou' } : prev));
    });
    websocketService.onCorridaIniciada(() => {
      setCorridaAtual((prev) => (prev ? { ...prev, status: 'em_andamento' } : prev));
      setAguardandoMotorista(false);
    });
    websocketService.onCorridaFinalizada(() => {
      console.log('Corrida finalizada (evento)');
      const finalizada = corridaAtualRef.current;
      if (finalizada?.id) {
        setCorridaParaAvaliar(finalizada);
        setMostrarAvaliacao(true);
      }
      limparEstadoCorrida();
      Alert.alert('Corrida finalizada', 'Obrigado por viajar conosco!');
    });
    websocketService.onMotoristaPosicaoAtualizada((data) => {
      setCorridaAtual((prev) => (prev ? {
        ...prev,
        motoristaLocalizacao: data.localizacao,
        distancia: data.distancia,
        tempoEstimado: data.tempoEstimado
      } : prev));
    });
  };

  const obterLocalizacao = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permissao negada para localizacao');
        Alert.alert('Permissao negada', 'Nao foi possivel acessar sua localizacao');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });
      setTimeout(() => setMapReady(true), 400);
    } catch (error) {
      console.error('Erro ao obter localizacao:', error);
      setLocationError('Falha ao obter localizacao');
    }
  };

  const carregarFavoritos = async () => {
    try {
      const response = await axios.get(`${API_URL}/favoritos/usuario/${usuario.id}`);
      setFavoritos(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
    }
  };

  const buscarEndereco = async (texto) => {
    setEnderecoBusca(texto);
    if (texto.length < 3) {
      setSugestoes([]);
      return;
    }
    setBuscando(true);
    try {
      const response = await axios.get(`${API_URL}/corridas/buscar-endereco?input=${encodeURIComponent(texto)}`);
      const sugestoesData = Array.isArray(response.data) ? response.data : [];
      setSugestoes(sugestoesData);
    } catch (error) {
      console.error('Erro ao buscar endereco:', error);
      setSugestoes([]);
    } finally {
      setBuscando(false);
    }
  };

  const selecionarSugestao = async (sugestao) => {
    try {
      Keyboard.dismiss();
      setEnderecoBusca(sugestao.principal);
      setSugestoes([]);
      const response = await axios.get(`${API_URL}/corridas/lugar-coordenadas?placeId=${sugestao.id}`);
      const coords = response.data;
      const novoDestino = { latitude: coords.latitude, longitude: coords.longitude };
      setDestino(novoDestino);
      const endDestino = sugestao.descricao || `${sugestao.principal}${sugestao.secundario ? `, ${sugestao.secundario}` : ''}`;
      setDestinoEndereco(endDestino);
      await calcularRota(location, novoDestino);
    } catch (error) {
      console.error('Erro ao obter coordenadas:', error);
      Alert.alert('Erro', 'Nao foi possivel obter as coordenadas do endereco');
    }
  };

  const calcularRota = async (origem, dest) => {
    try {
      const response = await axios.post(`${API_URL}/corridas/rota`, {
        origemLat: origem.latitude,
        origemLng: origem.longitude,
        destinoLat: dest.latitude,
        destinoLng: dest.longitude
      });
      const coords = decodePolyline(response.data.polyline);
      setRota(coords);
      setDistancia(response.data.distancia);
      setPreco(2 + (response.data.distancia * 1.5));
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      setRota([]);
      setDistancia(1);
      setPreco(5);
    }
  };

  // Ajusta zoom automaticamente quando rota é calculada
  useEffect(() => {
    if (mapRef.current && location && destino && rota.length > 0) {
      mapRef.current.fitToCoordinates([location, destino], {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true
      });
    }
  }, [rota, location, destino]);

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

  const solicitarCorrida = async () => {
    console.log('Solicitar corrida: clique recebido');
    if (!location) {
      Alert.alert('Atencao', 'Aguardando sua localizacao');
      return;
    }
    let alvo = destino;
    if (!alvo) {
      alvo = { latitude: location.latitude + 0.005, longitude: location.longitude + 0.005 };
      setDestino(alvo);
      setDestinoEndereco('Destino proximo');
      setDistancia((prev) => (prev && prev > 0 ? prev : 1));
      setPreco((prev) => (prev && prev > 0 ? prev : 5));
    }
    try {
      setAguardandoMotorista(true);
      const response = await axios.post(`${API_URL}/corridas/solicitar`, {
        passageiroId: usuario.id,
        origemLat: location.latitude,
        origemLng: location.longitude,
        destinoLat: alvo.latitude,
        destinoLng: alvo.longitude,
        origemEndereco: 'Minha localizacao',
        destinoEndereco
      });
      setCorridaAtual(response.data);
      websocketService.solicitarCorrida({
        corridaId: response.data.id,
        passageiroId: usuario.id,
        passageiroNome: usuario.nome,
        origem: { latitude: location.latitude, longitude: location.longitude },
        destino: alvo,
        origemEndereco: response.data.origemEndereco || 'Minha localizacao',
        destinoEndereco: response.data.destinoEndereco || destinoEndereco || 'Destino',
        preco
      });
      console.log('Corrida solicitada com sucesso:', response.data.id);
      Alert.alert('Corrida solicitada', 'Procurando motoristas proximos...');
    } catch (error) {
      console.error('Erro ao solicitar corrida:', error);
      setAguardandoMotorista(false);
      Alert.alert('Erro', 'Nao foi possivel solicitar a corrida');
    }
  };

  const cancelarCorrida = async () => {
    Alert.alert('Cancelar Corrida', 'Deseja realmente cancelar esta corrida?', [
      { text: 'Nao', style: 'cancel' },
      {
        text: 'Sim, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.patch(`${API_URL}/corridas/${corridaAtual.id}/cancelar`, { canceladoPor: 'passageiro' });
            limparEstadoCorrida();
            Alert.alert('Corrida Cancelada', 'Sua corrida foi cancelada');
          } catch (error) {
            console.error('Erro ao cancelar corrida:', error);
            Alert.alert('Erro', 'Nao foi possivel cancelar a corrida');
          }
        }
      }
    ]);
  };

  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (!isMotorista && corridaAtual?.id) {
      pollingRef.current = setInterval(async () => {
        try {
          const resp = await axios.get(`${API_URL}/corridas/${corridaAtual.id}`);
          if (resp.data?.status === 'finalizada' || resp.data?.status === 'cancelada') {
            limparEstadoCorrida();
          }
        } catch (error) {
          // Silencioso para evitar spam de logs em rede instavel.
        }
      }, 5000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [corridaAtual?.id, isMotorista]);

  const centralizarMapa = () => {
    if (mapRef.current) {
      if (rota.length > 0) {
        mapRef.current.fitToCoordinates([location, destino], {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true
        });
      } else if (destino) {
        mapRef.current.fitToCoordinates([location, destino], {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true
        });
      } else if (location) {
        mapRef.current.animateToRegion(location, 1000);
      }
    }
  };

  if (!usuario || !usuario.id) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.menuButton} onPress={() => setMostrarMenu(true)}>
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
      </TouchableOpacity>

      {!corridaAtual && (
        <View style={styles.buscaContainer}>
          <TextInput
            style={styles.buscaInput}
            placeholder="Para onde vamos?"
            value={enderecoBusca}
            onChangeText={buscarEndereco}
            placeholderTextColor="#94a3b8"
          />
          {buscando && (
            <View style={styles.buscandoContainer}>
              <Text style={styles.buscandoText}>Buscando...</Text>
            </View>
          )}
          {sugestoes.length > 0 && (
            <ScrollView style={styles.sugestoesContainer} keyboardShouldPersistTaps="handled">
              {sugestoes.map((sugestao) => (
                <TouchableOpacity
                  key={sugestao.id}
                  style={styles.sugestaoItem}
                  onPress={() => selecionarSugestao(sugestao)}
                >
                  <Text style={styles.sugestaoIcone}>-</Text>
                  <View style={styles.sugestaoTextoContainer}>
                    <Text style={styles.sugestaoPrincipal}>{sugestao.principal}</Text>
                    {sugestao.secundario ? (
                      <Text style={styles.sugestaoSecundario}>{sugestao.secundario}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {disableMap ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Mapa desativado para teste</Text>
        </View>
      ) : location && mapReady ? (
        <MapView
          style={styles.map}
          initialRegion={location}
          ref={mapRef}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          myLocationButtonEnabled={false}
          zoomControlEnabled={false}
          provider={MapView.PROVIDER_GOOGLE}
          rotateEnabled={false}
        >
          {!(corridaAtual?.status === 'em_andamento') && (
            <Marker coordinate={location} title="Voce" pinColor="blue" />
          )}
          {destino && <Marker coordinate={destino} title="Destino" pinColor="red" />}
          {rota.length > 0 && <Polyline coordinates={rota} strokeColor="#3b82f6" strokeWidth={4} />}
          {corridaAtual?.motoristaLocalizacao && (
            <>
              <Marker coordinate={corridaAtual.motoristaLocalizacao} title="Motorista">
                <View style={[styles.carPinPass, styles.carPinOnlinePass]}>
                  <MaterialCommunityIcons name="car" size={18} color="#fff" />
                </View>
              </Marker>
              <Polyline
                coordinates={[corridaAtual.motoristaLocalizacao, location]}
                strokeColor="#10b981"
                strokeWidth={3}
                lineDashPattern={[5, 5]}
              />
            </>
          )}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {locationError ? 'Erro ao carregar localizacao' : 'Carregando localizacao...'}
          </Text>
          {locationError ? (
            <TouchableOpacity style={styles.retryButton} onPress={() => {
              setLocationError('');
              setMapReady(false);
              obterLocalizacao();
            }}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {!isMotorista && (
        <TouchableOpacity style={styles.botaoCentralizar} onPress={centralizarMapa}>
          <Text style={styles.botaoCentralizarText}>↺</Text>
        </TouchableOpacity>
      )}

      {!isMotorista && !corridaAtual && location && (
        <View style={styles.bottomPanel}>
          <View style={styles.infoViagem}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Distancia</Text>
              <Text style={styles.infoValor}>{(destino ? (distancia || 0) : 0).toFixed(1)} km</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Preco</Text>
              <Text style={styles.infoValor}>R$ {(destino ? (preco || 0) : 0).toFixed(2)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.botaoSolicitar} onPress={solicitarCorrida}>
            <Text style={styles.botaoSolicitarText}>
              {aguardandoMotorista ? 'Buscando motorista...' : 'Solicitar Corrida'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {corridaAtual && (
        <View style={styles.corridaCard}>
          <View style={styles.corridaHeader}>
            <Text style={styles.corridaStatus}>
              {corridaAtual?.status === 'aguardando' && 'Buscando motorista...'}
              {corridaAtual?.status === 'em_andamento' && 'Corrida em andamento'}
              {corridaAtual?.status === 'chegou' && 'Motorista chegou'}
              {corridaAtual?.status === 'aceita' && 'Motorista a caminho'}
              {corridaAtual?.status === 'finalizada' && 'Corrida finalizada'}
              {!corridaAtual?.status && (aguardandoMotorista ? 'Buscando motorista...' : 'Motorista a caminho')}
            </Text>
            <TouchableOpacity onPress={cancelarCorrida}>
              <Text style={styles.botaoCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          {corridaAtual.motoristaNome && (
            <>
              <Text style={styles.motoristaNome}>Motorista: {corridaAtual.motoristaNome}</Text>
              <View style={styles.corridaInfo}>
                <Text style={styles.corridaInfoText}>{(corridaAtual.distancia || 0).toFixed(1)} km</Text>
                <Text style={styles.corridaInfoText}>
                  {calcularTempoEstimado(corridaAtual.distancia || 0, corridaAtual.tempoEstimado)} min
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      <Modal visible={mostrarHistorico} animationType="slide">
        <HistoricoScreen usuario={usuario} />
        <TouchableOpacity style={styles.fecharModalButton} onPress={() => setMostrarHistorico(false)}>
          <Text style={styles.fecharModalText}>Fechar</Text>
        </TouchableOpacity>
      </Modal>

      <Modal visible={mostrarPerfil} animationType="slide">
        <PerfilScreen usuario={usuario} onLogout={onLogout} onAtualizar={onAtualizarUsuario} />
        <TouchableOpacity style={styles.fecharModalButton} onPress={() => setMostrarPerfil(false)}>
          <Text style={styles.fecharModalText}>Fechar</Text>
        </TouchableOpacity>
      </Modal>

      <Modal visible={mostrarPagamentos} animationType="slide">
        <PagamentoScreen usuario={usuario} onVoltar={() => setMostrarPagamentos(false)} />
      </Modal>

      <Modal visible={mostrarConfig} animationType="slide">
        <ConfigScreen
          usuario={usuario}
          onSave={(prefs) => console.log('Prefs salvas', prefs)}
          onClose={() => setMostrarConfig(false)}
        />
      </Modal>

      <Modal visible={mostrarAgendamentos} animationType="slide">
        <View style={styles.modalSimples}>
          <Text style={styles.modalTitulo}>Agendamentos</Text>
          <Text style={styles.modalTexto}>Funcionalidade em breve.</Text>
          <TouchableOpacity style={styles.modalBotaoFechar} onPress={() => setMostrarAgendamentos(false)}>
            <Text style={styles.modalBotaoFecharText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={mostrarTermos} animationType="slide">
        <View style={styles.modalSimples}>
          <Text style={styles.modalTitulo}>Termos de uso</Text>
          <Text style={styles.modalTexto}>Conteúdo dos termos será exibido aqui.</Text>
          <TouchableOpacity style={styles.modalBotaoFechar} onPress={() => setMostrarTermos(false)}>
            <Text style={styles.modalBotaoFecharText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={mostrarConfig} animationType="slide">
        <ConfigScreen
          usuario={usuario}
          onSave={(prefs) => console.log('Prefs salvas', prefs)}
          onClose={() => setMostrarConfig(false)}
        />
      </Modal>

      <Modal visible={mostrarMenu} transparent animationType="slide" onRequestClose={() => setMostrarMenu(false)}>
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMostrarMenu(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatar}>
                {usuario?.avatarUri ? (
                  <Image source={{ uri: usuario.avatarUri }} style={styles.drawerAvatarImg} />
                ) : (
                  <Text style={styles.drawerAvatarText}>{usuario?.nome?.charAt(0).toUpperCase() || 'U'}</Text>
                )}
              </View>
              <View style={styles.drawerInfo}>
                <Text style={styles.drawerNome}>{usuario?.nome || 'Usuario'}</Text>
              </View>
            </View>

            <ScrollView style={styles.drawerList}>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarPerfil(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemIcon}>P</Text>
                <Text style={styles.drawerItemText}>Editar Perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarHistorico(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemIcon}>H</Text>
                <Text style={styles.drawerItemText}>Historico de viagens</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarPagamentos(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemIcon}>P</Text>
                <Text style={styles.drawerItemText}>Forma de pagamento</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarAgendamentos(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemIcon}>A</Text>
                <Text style={styles.drawerItemText}>Agendamentos</Text>
              </TouchableOpacity>
              {/* Motoristas favoritos removido a pedido */}
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarMenu(false); Alert.alert('Suporte', 'Em breve'); }}>
                <Text style={styles.drawerItemIcon}>S</Text>
                <Text style={styles.drawerItemText}>Suporte</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarConfig(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemIcon}>G</Text>
                <Text style={styles.drawerItemText}>Configuracoes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={onLogout}>
                <Text style={styles.drawerItemIcon}>X</Text>
                <Text style={styles.drawerItemText}>Sair</Text>
              </TouchableOpacity>
              <View style={styles.drawerFooter}>
                <Text style={styles.drawerFooterText}>Meu código de indicação</Text>
                <Text style={styles.drawerFooterCode}>O82554</Text>
                <Text style={styles.drawerFooterText}>Versão 1.2.41</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AvaliacaoScreen
        corrida={corridaParaAvaliar}
        visible={mostrarAvaliacao}
        onClose={() => {
          setMostrarAvaliacao(false);
          setCorridaParaAvaliar(null);
        }}
        onAvaliacaoEnviada={() => {
          setMostrarAvaliacao(false);
          setCorridaParaAvaliar(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  retryButton: { marginTop: 12, backgroundColor: '#0ea5e9', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryButtonText: { color: 'white', fontWeight: '700' },
  statusWS: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, zIndex: 1000 },
  wsOnline: { backgroundColor: '#10b981' },
  wsOffline: { backgroundColor: '#ef4444' },
  statusWSText: { color: 'white', fontSize: 10 },
  menuButton: { position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'white', padding: 10, borderRadius: 12, elevation: 4 },
  menuLine: { width: 22, height: 2, backgroundColor: '#0f172a', marginVertical: 2 },
  buscaContainer: { position: 'absolute', top: 140, left: 20, right: 20, zIndex: 998 },
  buscaInput: { backgroundColor: 'white', borderRadius: 12, padding: 16, fontSize: 16, elevation: 4, borderWidth: 2, borderColor: '#3b82f6' },
  buscandoContainer: { marginTop: 10, padding: 10, backgroundColor: '#fef3c7', borderRadius: 8, alignItems: 'center' },
  buscandoText: { color: '#92400e', fontSize: 12, fontWeight: '600' },
  sugestoesContainer: { marginTop: 10, backgroundColor: 'white', borderRadius: 12, maxHeight: 300, elevation: 4 },
  sugestaoItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sugestaoIcone: { fontSize: 18, marginRight: 12 },
  sugestaoTextoContainer: { flex: 1 },
  sugestaoPrincipal: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  sugestaoSecundario: { fontSize: 13, color: '#64748b' },
  botaoCentralizar: { position: 'absolute', bottom: 220, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  botaoCentralizarText: { fontSize: 22, color: '#0f172a', fontWeight: '700' },
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, elevation: 8 },
  infoViagem: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  infoItem: { alignItems: 'center' },
  infoLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  infoValor: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  botaoSolicitar: { backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 8, alignItems: 'center' },
  botaoSolicitarText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  corridaCard: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'white', borderRadius: 12, padding: 20, elevation: 8 },
  corridaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  corridaStatus: { fontSize: 16, fontWeight: '600', color: '#10b981' },
  botaoCancelar: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  motoristaNome: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  corridaInfo: { flexDirection: 'row', justifyContent: 'space-around' },
  corridaInfoText: { fontSize: 14, color: '#1e293b' },
  carPinPass: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  carPinOnlinePass: { backgroundColor: '#22c55e' },
  fecharModalButton: { position: 'absolute', top: 50, left: 20, backgroundColor: '#ef4444', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  fecharModalText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
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
  drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  drawerItemIcon: { width: 28, fontSize: 16, color: 'white' },
  drawerItemText: { color: 'white', fontSize: 14, fontWeight: '600' },
  drawerFooter: { paddingVertical: 16, alignItems: 'flex-start' },
  drawerFooterText: { color: '#cbd5e1', fontSize: 12 },
  drawerFooterCode: { color: '#38bdf8', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  modalSimples: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#f8fafc' },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  modalTexto: { fontSize: 14, color: '#475569', marginBottom: 20 },
  modalBotaoFechar: { backgroundColor: '#0ea5e9', padding: 12, borderRadius: 10, alignItems: 'center' },
  modalBotaoFecharText: { color: 'white', fontWeight: '700' },
});
