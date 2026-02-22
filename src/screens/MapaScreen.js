import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Alert, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image, Linking } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import websocketService from '../services/websocket';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import HistoricoScreen from './HistoricoScreen';
import AvaliacaoScreen from './AvaliacaoScreen';
import PerfilScreen from './PerfilScreen';
import ConfigScreen from './ConfigScreen';
import PagamentoScreen from './PagamentoScreen';
import { API_URL, GOOGLE_MAPS_API_KEY, MAPBOX_STYLE_URL } from '../config';
import MapboxGL from '../mapbox';

export default function MapaScreen({ usuario, onLogout, onAtualizarUsuario }) {
  const isMotorista = usuario?.papel === 'motorista' || usuario?.tipo === 'motorista';
  const disableMap = false;
  const [location, setLocation] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapboxError, setMapboxError] = useState('');
  const [mapboxStyleLoaded, setMapboxStyleLoaded] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [destino, setDestino] = useState(null);
  const [destinoEndereco, setDestinoEndereco] = useState('');
  const [rota, setRota] = useState([]);
  const [rotaMotorista, setRotaMotorista] = useState([]);
  const [distancia, setDistancia] = useState(0);
  const [preco, setPreco] = useState(0);
  const [corridaAtual, setCorridaAtual] = useState(null);
  const corridaAtualRef = useRef(null);
  const [motoristasOnline, setMotoristasOnline] = useState({});
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
  const cameraRef = useRef(null);
  const pollingRef = useRef(null);
  const normalizeCoords = (input) => {
    if (!input) return null;
    if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
      return { latitude: input.latitude, longitude: input.longitude };
    }
    if (typeof input.lat === 'number' && typeof input.lng === 'number') {
      return { latitude: input.lat, longitude: input.lng };
    }
    if (typeof input.motoristaLat === 'number' && typeof input.motoristaLng === 'number') {
      return { latitude: input.motoristaLat, longitude: input.motoristaLng };
    }
    return null;
  };
  const toLineString = (coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords.map((p) => [p.longitude, p.latitude])
      }
    };
  };
  const getBoundsFromCoords = (coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    let minLat = coords[0].latitude;
    let maxLat = coords[0].latitude;
    let minLng = coords[0].longitude;
    let maxLng = coords[0].longitude;
    coords.forEach((p) => {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    });
    return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
  };
  const emNavegacao = corridaAtual?.status === 'em_andamento';
  const showDestinoRoute = !corridaAtual || emNavegacao;
  const cameraBounds = useMemo(() => {
    if (showDestinoRoute) {
      if (Array.isArray(rota) && rota.length > 1) return getBoundsFromCoords(rota);
      if (location && destino) return getBoundsFromCoords([location, destino]);
      return null;
    }
    if (Array.isArray(rotaMotorista) && rotaMotorista.length > 1) return getBoundsFromCoords(rotaMotorista);
    const motoristaCoords = normalizeCoords(corridaAtual?.motoristaLocalizacao || corridaAtual);
    if (motoristaCoords && location) return getBoundsFromCoords([motoristaCoords, location]);
    return null;
  }, [showDestinoRoute, rota, rotaMotorista, location, destino, corridaAtual?.motoristaLocalizacao, corridaAtual?.motoristaLat, corridaAtual?.motoristaLng]);
  const rotaShape = useMemo(() => (Array.isArray(rota) && rota.length > 1 ? toLineString(rota) : null), [rota]);
  const rotaFallbackShape = useMemo(() => {
    if (!location || !destino || (Array.isArray(rota) && rota.length > 0)) return null;
    return toLineString([location, destino]);
  }, [location, destino, rota.length]);
  const rotaMotoristaShape = useMemo(() => {
    if (Array.isArray(rotaMotorista) && rotaMotorista.length > 1) return toLineString(rotaMotorista);
    return null;
  }, [rotaMotorista]);
  const rotaMotoristaFallbackShape = useMemo(() => {
    const motoristaCoords = normalizeCoords(corridaAtual?.motoristaLocalizacao || corridaAtual);
    if (!motoristaCoords || !location || (Array.isArray(rotaMotorista) && rotaMotorista.length > 0)) return null;
    return toLineString([motoristaCoords, location]);
  }, [corridaAtual?.motoristaLocalizacao, corridaAtual?.motoristaLat, corridaAtual?.motoristaLng, location, rotaMotorista.length]);
  const motoristasOnlineList = useMemo(() => Object.values(motoristasOnline), [motoristasOnline]);
  const mostrarMotoristasOnline = !corridaAtual;
  const getDirectionsKey = () =>
    GOOGLE_MAPS_API_KEY ||
    Constants?.expoConfig?.android?.config?.googleMaps?.apiKey ||
    Constants?.manifest?.android?.config?.googleMaps?.apiKey ||
    '';

  const buscarRotaGoogle = async (origem, dest) => {
    const apiKey = getDirectionsKey();
    if (!apiKey) return null;
    const origemStr = `${origem.latitude},${origem.longitude}`;
    const destStr = `${dest.latitude},${dest.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origemStr)}&destination=${encodeURIComponent(destStr)}&key=${apiKey}`;
    const response = await axios.get(url);
    const route = response.data?.routes?.[0];
    const leg = route?.legs?.[0];
    if (!route?.overview_polyline?.points || !leg?.distance?.value) return null;
    return {
      coords: decodePolyline(route.overview_polyline.points),
      distanciaKm: leg.distance.value / 1000
    };
  };
  const calcularTempoEstimado = (distanciaKm, tempoServer) => {
    if (tempoServer && tempoServer > 0) return tempoServer;
    if (!distanciaKm || distanciaKm <= 0) return 0;
    const minutos = (distanciaKm / 30) * 60; // fallback: 30 km/h
    return Math.max(1, Math.ceil(minutos));
  };

  const abrirNavegacao = async () => {
    if (!destino) {
      Alert.alert('Navegacao', 'Destino indisponivel.');
      return;
    }
    Alert.alert('Navegacao', 'A rota ja esta exibida no mapa.');
    centralizarMapa();
  };

  const limparEstadoCorrida = () => {
    setCorridaAtual(null);
    setDestino(null);
    setDestinoEndereco('');
    setRota([]);
    setRotaMotorista([]);
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
    websocketService.onMotoristasOnline((lista) => {
      if (!Array.isArray(lista)) return;
      const proximo = {};
      lista.forEach((motorista) => {
        if (!motorista?.motoristaId || !motorista?.localizacao) return;
        proximo[motorista.motoristaId] = motorista;
      });
      setMotoristasOnline(proximo);
    });
    websocketService.onMotoristaOnline((motorista) => {
      if (!motorista?.motoristaId) return;
      setMotoristasOnline((prev) => ({
        ...prev,
        [motorista.motoristaId]: motorista
      }));
    });
    websocketService.onMotoristaOffline((data) => {
      const motoristaId = data?.motoristaId;
      if (!motoristaId) return;
      setMotoristasOnline((prev) => {
        const proximo = { ...prev };
        delete proximo[motoristaId];
        return proximo;
      });
    });
    websocketService.onMotoristaPosicaoOnline((data) => {
      const motoristaId = data?.motoristaId;
      const localizacao = normalizeCoords(data?.localizacao || data);
      if (!motoristaId || !localizacao) return;
      setMotoristasOnline((prev) => ({
        ...prev,
        [motoristaId]: {
          ...(prev[motoristaId] || {}),
          motoristaId,
          localizacao
        }
      }));
    });
    websocketService.onCorridaAceita((data) => {
      const motoristaCoords = normalizeCoords(data.motoristaLocalizacao || data.localizacao || data);
      setAguardandoMotorista(false);
      setCorridaAtual((prev) => ({
        ...prev,
        motoristaId: data.motoristaId,
        motoristaNome: data.motoristaNome,
        motoristaLocalizacao: motoristaCoords,
        status: 'aceita'
      }));
      Alert.alert('Motorista encontrado', `${data.motoristaNome} aceitou sua corrida!`);
    });
    websocketService.onCorridaRecusada((data) => {
      const atual = corridaAtualRef.current;
      if (!atual || atual.id !== data.corridaId) return;
      setCorridaAtual((prev) => (prev ? { ...prev, status: 'aguardando', motoristaId: null, motoristaNome: null } : prev));
      setAguardandoMotorista(true);
    });
    websocketService.onMotoristaChegou(() => {
      setCorridaAtual((prev) => (prev ? { ...prev, status: 'chegou' } : prev));
    });
    websocketService.onCorridaIniciada(() => {
      setCorridaAtual((prev) => (prev ? { ...prev, status: 'em_andamento' } : prev));
      setAguardandoMotorista(false);
    });
    websocketService.onCorridaFinalizada(async () => {
      console.log('Corrida finalizada (evento)');
      const finalizada = corridaAtualRef.current;
      if (finalizada?.id) {
        setCorridaParaAvaliar(finalizada);
        setMostrarAvaliacao(true);
      }
      limparEstadoCorrida();
      
      // Limpar método de pagamento para forçar escolha na próxima corrida
      try {
        const usuarioAtualizado = { ...usuario, metodoPagamentoPadrao: null };
        onAtualizarUsuario?.(usuarioAtualizado);
        await AsyncStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));
        console.log('Método de pagamento limpo após finalizar corrida');
      } catch (error) {
        console.error('Erro ao limpar método de pagamento:', error);
      }
      
      Alert.alert('Corrida finalizada', 'Obrigado por viajar conosco!');
    });
    websocketService.onMotoristaPosicaoAtualizada((data) => {
      const motoristaCoords = normalizeCoords(data.localizacao || data);
      setCorridaAtual((prev) => (prev ? {
        ...prev,
        motoristaLocalizacao: motoristaCoords || prev.motoristaLocalizacao,
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
      if (coords.length > 1) {
        setRota(coords);
        setDistancia(response.data.distancia);
        setPreco(2 + (response.data.distancia * 1.5));
        return;
      }
      const rotaGoogle = await buscarRotaGoogle(origem, dest);
      if (rotaGoogle?.coords?.length > 1) {
        setRota(rotaGoogle.coords);
        setDistancia(rotaGoogle.distanciaKm);
        setPreco(2 + (rotaGoogle.distanciaKm * 1.5));
        return;
      }
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      try {
        const rotaGoogle = await buscarRotaGoogle(origem, dest);
        if (rotaGoogle?.coords?.length > 1) {
          setRota(rotaGoogle.coords);
          setDistancia(rotaGoogle.distanciaKm);
          setPreco(2 + (rotaGoogle.distanciaKm * 1.5));
          return;
        }
      } catch (googleError) {
        // Ignore fallback error.
      }
      setRota([]);
      setDistancia(1);
      setPreco(5);
    }
  };

  const calcularRotaMotorista = async (origem, dest) => {
    try {
      const response = await axios.post(`${API_URL}/corridas/rota`, {
        origemLat: origem.latitude,
        origemLng: origem.longitude,
        destinoLat: dest.latitude,
        destinoLng: dest.longitude
      });
      const coords = decodePolyline(response.data.polyline);
      if (coords.length > 1) {
        setRotaMotorista(coords);
        return;
      }
      const rotaGoogle = await buscarRotaGoogle(origem, dest);
      if (rotaGoogle?.coords?.length > 1) {
        setRotaMotorista(rotaGoogle.coords);
        return;
      }
    } catch (error) {
      try {
        const rotaGoogle = await buscarRotaGoogle(origem, dest);
        if (rotaGoogle?.coords?.length > 1) {
          setRotaMotorista(rotaGoogle.coords);
          return;
        }
      } catch (googleError) {
        // Ignore fallback error.
      }
    }
    setRotaMotorista([]);
  };

  // Ajusta zoom automaticamente quando rota é calculada
  useEffect(() => {
    if (!cameraRef.current || !cameraBounds) return;
    if (emNavegacao) return;
    cameraRef.current.setCamera({
      bounds: {
        ne: cameraBounds.ne,
        sw: cameraBounds.sw,
        paddingTop: 80,
        paddingBottom: 220,
        paddingLeft: 40,
        paddingRight: 40
      },
      animationDuration: 500
    });
  }, [cameraBounds, emNavegacao]);

  useEffect(() => {
    if (!cameraRef.current || !location) return;
    if (!emNavegacao) return;
    cameraRef.current.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      zoomLevel: 16.5,
      pitch: 45,
      animationDuration: 500
    });
  }, [emNavegacao, location]);

  useEffect(() => {
    const motoristaCoords = normalizeCoords(corridaAtual?.motoristaLocalizacao || corridaAtual);
    if (!motoristaCoords || !location) {
      setRotaMotorista([]);
      return;
    }
    if (corridaAtual?.status === 'em_andamento' || corridaAtual?.status === 'finalizada') {
      setRotaMotorista([]);
      return;
    }
    calcularRotaMotorista(motoristaCoords, location);
  }, [corridaAtual?.motoristaLocalizacao, corridaAtual?.motoristaLat, corridaAtual?.motoristaLng, corridaAtual?.status, location]);

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
          const status = resp.data?.status;
          const motoristaCoords = normalizeCoords(resp.data?.motoristaLocalizacao || resp.data);
          if (status || motoristaCoords) {
            setCorridaAtual((prev) => (prev ? {
              ...prev,
              status: status || prev.status,
              motoristaLocalizacao: motoristaCoords || prev.motoristaLocalizacao
            } : prev));
          }
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
    if (!cameraRef.current || !location) return;
    if (emNavegacao) {
      cameraRef.current.setCamera({
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: 16.5,
        pitch: 45,
        animationDuration: 500
      });
      return;
    }
    if (cameraBounds) {
      cameraRef.current.setCamera({
        bounds: {
          ne: cameraBounds.ne,
          sw: cameraBounds.sw,
          paddingTop: 80,
          paddingBottom: 220,
          paddingLeft: 40,
          paddingRight: 40
        },
        animationDuration: 500
      });
      return;
    }
    cameraRef.current.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      zoomLevel: 14,
      animationDuration: 500
    });
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
      {disableMap ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Mapa desativado para teste</Text>
        </View>
      ) : location && mapReady ? (
        <MapboxGL.MapView
          style={styles.map}
          ref={mapRef}
          styleURL={MAPBOX_STYLE_URL}
          logoEnabled={false}
          compassEnabled={false}
          rotateEnabled={false}
          onDidFinishLoadingStyle={() => setMapboxStyleLoaded(true)}
          onDidFailLoadingStyle={(event) => {
            const message = event?.message || event?.nativeEvent?.message || 'Falha ao carregar estilo do mapa';
            setMapboxError(message);
          }}
          onDidFailLoadingMap={(event) => {
            const message = event?.message || event?.nativeEvent?.message || 'Falha ao carregar mapa';
            setMapboxError(message);
          }}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            centerCoordinate={[location.longitude, location.latitude]}
            zoomLevel={14}
            animationDuration={500}
          />
          {!(corridaAtual?.status === 'em_andamento') && (
            <MapboxGL.PointAnnotation id="user" coordinate={[location.longitude, location.latitude]}>
              <View style={styles.userPin} />
            </MapboxGL.PointAnnotation>
          )}
          {destino && (
            <MapboxGL.PointAnnotation id="destino" coordinate={[destino.longitude, destino.latitude]}>
              <View style={styles.destinoPin} />
            </MapboxGL.PointAnnotation>
          )}
          {showDestinoRoute && rotaShape && (
            <MapboxGL.ShapeSource id="rota" shape={rotaShape}>
              <MapboxGL.LineLayer id="rotaLine" style={{ lineColor: '#3b82f6', lineWidth: 4 }} />
            </MapboxGL.ShapeSource>
          )}
          {showDestinoRoute && rotaFallbackShape && (
            <MapboxGL.ShapeSource id="rotaFallback" shape={rotaFallbackShape}>
              <MapboxGL.LineLayer id="rotaFallbackLine" style={{ lineColor: '#3b82f6', lineWidth: 3, lineDasharray: [2, 2] }} />
            </MapboxGL.ShapeSource>
          )}
          {normalizeCoords(corridaAtual?.motoristaLocalizacao || corridaAtual) && (
            <>
              <MapboxGL.MarkerView
                id="motorista"
                coordinate={[
                  normalizeCoords(corridaAtual?.motoristaLocalizacao || corridaAtual).longitude,
                  normalizeCoords(corridaAtual?.motoristaLocalizacao || corridaAtual).latitude
                ]}
              >
                <View style={[styles.carPinPass, styles.carPinOnlinePass]}>
                  <MaterialCommunityIcons name="car" size={18} color="#fff" />
                </View>
              </MapboxGL.MarkerView>
              {rotaMotoristaShape && (
                <MapboxGL.ShapeSource id="rotaMotorista" shape={rotaMotoristaShape}>
                  <MapboxGL.LineLayer id="rotaMotoristaLine" style={{ lineColor: '#10b981', lineWidth: 3 }} />
                </MapboxGL.ShapeSource>
              )}
              {rotaMotoristaFallbackShape && (
                <MapboxGL.ShapeSource id="rotaMotoristaFallback" shape={rotaMotoristaFallbackShape}>
                  <MapboxGL.LineLayer id="rotaMotoristaFallbackLine" style={{ lineColor: '#10b981', lineWidth: 3, lineDasharray: [2, 2] }} />
                </MapboxGL.ShapeSource>
              )}
            </>
          )}
          {mostrarMotoristasOnline && motoristasOnlineList.map((motorista) => {
            const localizacao = normalizeCoords(motorista.localizacao);
            if (!localizacao) return null;
            return (
              <MapboxGL.PointAnnotation
                key={`motorista-online-${motorista.motoristaId}`}
                id={`motorista-online-${motorista.motoristaId}`}
                coordinate={[localizacao.longitude, localizacao.latitude]}
              >
                <View style={[styles.carPinPass, styles.carPinOnlinePass]}>
                  <MaterialCommunityIcons name="car" size={16} color="#fff" />
                </View>
              </MapboxGL.PointAnnotation>
            );
          })}
        </MapboxGL.MapView>
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
      {mapboxError ? (
        <View style={styles.mapboxError}>
          <Text style={styles.mapboxErrorText}>Mapa: {mapboxError}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.menuButton} onPress={() => setMostrarMenu(true)}>
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
      </TouchableOpacity>

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
          
          <TouchableOpacity 
            style={styles.botaoPagamento} 
            onPress={() => setMostrarPagamentos(true)}
          >
            <Text style={styles.botaoPagamentoText}>
              💳 PAGAMENTO
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.botaoSolicitar, 
              !usuario.metodoPagamentoPadrao && styles.botaoSolicitarDesabilitado
            ]} 
            onPress={solicitarCorrida}
            disabled={!usuario.metodoPagamentoPadrao}
          >
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
            <View style={styles.corridaHeaderAcoes}>
              <TouchableOpacity onPress={abrirNavegacao}>
                <Text style={styles.botaoNavegar}></Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelarCorrida}>
                <Text style={styles.botaoCancelar}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
          {corridaAtual?.id && (
            <Text style={styles.corridaId}>Corrida: {corridaAtual.id}</Text>
          )}
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
        <PagamentoScreen 
          usuario={usuario} 
          onVoltar={() => setMostrarPagamentos(false)}
          onAtualizarUsuario={onAtualizarUsuario}
        />
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
                <Text style={styles.drawerItemIcon}></Text>
                <Text style={styles.drawerItemText}>Editar Perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarHistorico(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemIcon}></Text>
                <Text style={styles.drawerItemText}>Historico de viagens</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarPagamentos(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemIcon}></Text>
                <Text style={styles.drawerItemText}>Forma de pagamento</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarAgendamentos(true); setMostrarMenu(false); }}>
                <Text style={styles.drawerItemIcon}></Text>
                <Text style={styles.drawerItemText}>Agendamentos</Text>
              </TouchableOpacity>
              {/* Motoristas favoritos removido a pedido */}
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarMenu(false); Alert.alert('Suporte', 'Em breve'); }}>
                <Text style={styles.drawerItemIcon}></Text>
                <Text style={styles.drawerItemText}>Suporte</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMostrarConfig(true); setMostrarMenu(false); }}>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={onLogout}>
                <Text style={styles.drawerItemIcon}></Text>
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
  mapboxError: { position: 'absolute', top: 110, left: 20, right: 20, backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', zIndex: 999 },
  mapboxErrorText: { color: '#991b1b', fontSize: 12, fontWeight: '700' },
  bottomPanel: { position: 'absolute', bottom: 36, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, elevation: 8 },
  infoViagem: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  infoItem: { alignItems: 'center' },
  infoLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  infoValor: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  botaoPagamento: { backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  botaoPagamentoText: { color: 'white', fontSize: 15, fontWeight: '600' },
  botaoSolicitar: { backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 8, alignItems: 'center' },
  botaoSolicitarDesabilitado: { backgroundColor: '#94a3b8', opacity: 0.6 },
  botaoSolicitarText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  corridaCard: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'white', borderRadius: 12, padding: 20, elevation: 8 },
  corridaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  corridaHeaderAcoes: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  corridaStatus: { fontSize: 16, fontWeight: '600', color: '#10b981' },
  botaoNavegar: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  corridaId: { fontSize: 12, color: '#94a3b8', marginBottom: 6 },
  botaoCancelar: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  motoristaNome: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  corridaInfo: { flexDirection: 'row', justifyContent: 'space-around' },
  corridaInfoText: { fontSize: 14, color: '#1e293b' },
  carPinPass: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff', elevation: 6 },
  carPinOnlinePass: { backgroundColor: '#22c55e' },
  userPin: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2563eb', borderWidth: 2, borderColor: '#fff' },
  destinoPin: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff' },
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