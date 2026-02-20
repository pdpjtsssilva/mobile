import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image, ActivityIndicator, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import websocketService from '../services/websocket';
import axios from 'axios';
import { API_URL, GOOGLE_MAPS_API_KEY, MAPBOX_STYLE_URL } from '../config';
import HistoricoScreen from './HistoricoScreen';
import PerfilScreen from './PerfilScreen';
import Constants from 'expo-constants';
import MapboxGL from '../mapbox';

export default function MotoristaScreen({ usuario, onLogout }) {
  const BASE_URL = API_URL.replace(/\/api$/, '');
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [mapboxError, setMapboxError] = useState('');
  const [mapboxStyleLoaded, setMapboxStyleLoaded] = useState(false);
  const [navSteps, setNavSteps] = useState([]);
  const [navStepIndex, setNavStepIndex] = useState(-1);
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
  const [navMode, setNavMode] = useState(false);
  const [heading, setHeading] = useState(0);
  const [fotoSeguroUri, setFotoSeguroUri] = useState(null);
  const [fotoInspecaoUri, setFotoInspecaoUri] = useState(null);
  const [fotoLicenciamentoUri, setFotoLicenciamentoUri] = useState(null);
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

  const limparEstadoCorrida = () => {
    setSolicitacao(null);
    setCorridaConfirmada(null);
    setRotaMotorista([]);
  };

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
    if (!route?.overview_polyline?.points) return null;
    return decodePolyline(route.overview_polyline.points);
  };

  const loadImagePicker = async () => {
    try {
      const picker = await import('expo-image-picker');
      if (!picker?.requestMediaLibraryPermissionsAsync) return null;
      return picker;
    } catch (error) {
      return null;
    }
  };

  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const motoristaIdRef = useRef(usuario?.id || `motorista_${Date.now()}`);
  const locationRef = useRef(null);
  const onlineRef = useRef(false);
  const solicitacaoRef = useRef(null);
  const corridaConfirmadaRef = useRef(null);
  const pollingRef = useRef(null);
  const locationWatchRef = useRef(null);
  const lastRouteAtRef = useRef(0);
  const lastNavKeyRef = useRef('');
  const lastSpokenStepRef = useRef(-1);
  const lastPreSpokenStepRef = useRef(-1);
  const lastSpokenAtRef = useRef(0);
  const manualCameraUntilRef = useRef(0);
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
  const rotaMotoristaShape = useMemo(() => (Array.isArray(rotaMotorista) && rotaMotorista.length > 1 ? toLineString(rotaMotorista) : null), [rotaMotorista]);
  const rotaBounds = useMemo(() => {
    if (Array.isArray(rotaMotorista) && rotaMotorista.length > 1) return getBoundsFromCoords(rotaMotorista);
    return null;
  }, [rotaMotorista]);
  const driverCoordinate = useMemo(() => {
    if (!location) return null;
    return [location.longitude, location.latitude];
  }, [location]);

  const getDestinoAtual = () => {
    if (!corridaConfirmada) return null;
    if (corridaConfirmada.status === 'em_andamento') {
      if (corridaConfirmada.destino) return corridaConfirmada.destino;
      if (corridaConfirmada.destinoLat && corridaConfirmada.destinoLng) {
        return { latitude: corridaConfirmada.destinoLat, longitude: corridaConfirmada.destinoLng };
      }
    }
    if (corridaConfirmada.origem) return corridaConfirmada.origem;
    if (corridaConfirmada.origemLat && corridaConfirmada.origemLng) {
      return { latitude: corridaConfirmada.origemLat, longitude: corridaConfirmada.origemLng };
    }
    return null;
  };

  const stripHtml = (value) => {
    if (!value) return '';
    return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  };

  const distanceMeters = (a, b) => {
    if (!a || !b) return 0;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  const speakText = (text) => {
    if (!text) return;
    Speech.stop();
    Speech.speak(text, { language: 'pt-BR', rate: 0.95, pitch: 1.0 });
    lastSpokenAtRef.current = Date.now();
  };

  const speakStep = (index, steps) => {
    if (!Array.isArray(steps) || index < 0 || index >= steps.length) return;
    if (lastSpokenStepRef.current === index) return;
    const instruction = steps[index]?.instruction;
    if (!instruction) return;
    lastSpokenStepRef.current = index;
    speakText(instruction);
  };

  const speakPreStep = (index, steps) => {
    if (!Array.isArray(steps) || index < 0 || index >= steps.length) return;
    if (lastPreSpokenStepRef.current === index) return;
    const instruction = steps[index]?.instruction;
    if (!instruction) return;
    lastPreSpokenStepRef.current = index;
    speakText(`Em 100 metros, ${instruction}`);
  };

  const carregarInstrucoes = async (origem, destino) => {
    const apiKey = getDirectionsKey();
    if (!apiKey || !origem || !destino) return;
    const origemStr = `${origem.latitude},${origem.longitude}`;
    const destStr = `${destino.latitude},${destino.longitude}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origemStr)}&destination=${encodeURIComponent(destStr)}&key=${apiKey}&mode=driving&language=pt-PT`;
    const response = await axios.get(url);
    const steps = response.data?.routes?.[0]?.legs?.[0]?.steps || [];
    const parsed = steps.map((step) => ({
      instruction: stripHtml(step.html_instructions || ''),
      distance: step.distance?.value || 0,
      end: step.end_location ? { latitude: step.end_location.lat, longitude: step.end_location.lng } : null
    })).filter((step) => step.instruction && step.end);
    setNavSteps(parsed);
    setNavStepIndex(parsed.length ? 0 : -1);
    lastSpokenStepRef.current = -1;
    if (parsed.length) {
      speakText('Iniciando navegacao.');
      speakStep(0, parsed);
    }
  };

  const abrirNavegacao = async () => {
    const destino = getDestinoAtual();
    if (!destino) {
      Alert.alert('Navegacao', 'Destino indisponivel.');
      return;
    }
    setNavMode(true);
    if (cameraRef.current && location) {
      cameraRef.current.setCamera({
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: 17,
        pitch: 55,
        heading,
        animationDuration: 500
      });
    }
  };

  useEffect(() => {
    obterLocalizacao();
    websocketService.connect();
    websocketService.onNovaSolicitacao((data) => {
      const recusados = Array.isArray(data?.recusados) ? data.recusados : [];
      if (recusados.includes(motoristaIdRef.current)) return;
      setSolicitacao(data);
    });
    websocketService.onCorridaCancelada((data) => {
      const corridaId = data?.corridaId;
      const solicitacaoId = solicitacaoRef.current?.corridaId;
      const confirmadaId = corridaConfirmadaRef.current?.corridaId;
      if (!corridaId || corridaId === solicitacaoId || corridaId === confirmadaId) {
        limparEstadoCorrida();
        Alert.alert('Corrida cancelada', 'O passageiro cancelou a corrida.');
      }
    });
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
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    const corridaId = corridaConfirmada?.corridaId || solicitacao?.corridaId;
    if (!corridaId) return;
    pollingRef.current = setInterval(async () => {
      try {
        const resp = await axios.get(`${API_URL}/corridas/${corridaId}`);
        const status = resp?.data?.status;
        if (status === 'cancelada' || status === 'finalizada') {
          limparEstadoCorrida();
        }
      } catch (error) {
        // Silencioso para evitar spam.
      }
    }, 5000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [corridaConfirmada?.corridaId, solicitacao?.corridaId]);

  useEffect(() => {
    solicitacaoRef.current = solicitacao;
  }, [solicitacao]);

  useEffect(() => {
    corridaConfirmadaRef.current = corridaConfirmada;
  }, [corridaConfirmada]);

  useEffect(() => {
    if (!corridaConfirmada) {
      setNavMode(false);
      setNavSteps([]);
      setNavStepIndex(-1);
      lastNavKeyRef.current = '';
      lastSpokenStepRef.current = -1;
      lastPreSpokenStepRef.current = -1;
      Speech.stop();
      return;
    }
    const status = corridaConfirmada.status;
    setNavMode(status === 'aceita' || status === 'chegou' || status === 'em_andamento');
  }, [corridaConfirmada?.status, corridaConfirmada?.corridaId]);

  const stopTracking = () => {
    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
      locationWatchRef.current = null;
    }
  };

  const startTracking = async () => {
    if (locationWatchRef.current) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Permissao de localizacao negada');
      return;
    }
    locationWatchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 10
      },
      (loc) => {
        const regiao = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        };
        if (typeof loc.coords.heading === 'number' && loc.coords.heading >= 0) {
          setHeading(loc.coords.heading);
        }
        setLocation(regiao);
        locationRef.current = regiao;
        if (onlineRef.current) {
          websocketService.atualizarPosicao({
            motoristaId: motoristaIdRef.current,
            corridaId: corridaConfirmadaRef.current?.corridaId,
            latitude: regiao.latitude,
            longitude: regiao.longitude,
            localizacao: { latitude: regiao.latitude, longitude: regiao.longitude }
          });
        }
        const destinoAtual = getDestinoAtual();
        const now = Date.now();
        if (destinoAtual && now - lastRouteAtRef.current > 5000) {
          lastRouteAtRef.current = now;
          calcularRotaMotorista(regiao, destinoAtual);
        }
        if (navMode && navSteps.length && navStepIndex >= 0) {
          const currentStep = navSteps[navStepIndex];
          const dist = currentStep?.end ? distanceMeters(regiao, currentStep.end) : null;
          if (dist !== null && dist <= 200) {
            speakPreStep(navStepIndex, navSteps);
          }
          if (dist !== null && dist <= 60) {
            if (navStepIndex < navSteps.length - 1) {
              const nextIndex = navStepIndex + 1;
              setNavStepIndex(nextIndex);
              speakStep(nextIndex, navSteps);
            } else {
              speakText('Voce chegou ao destino.');
            }
          }
          if (Date.now() - lastSpokenAtRef.current > 25000) {
            speakStep(navStepIndex, navSteps);
          }
        }
      }
    );
  };

  useEffect(() => {
    if (mostrarMeusCarros) {
      carregarCarros();
    }
  }, [mostrarMeusCarros]);

  useEffect(() => {
    if (online) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => stopTracking();
  }, [online]);

  useEffect(() => {
    const destinoAtual = getDestinoAtual();
    if (!location || !destinoAtual) {
      setRotaMotorista([]);
      return;
    }
    calcularRotaMotorista(location, destinoAtual);
  }, [corridaConfirmada?.status, corridaConfirmada?.origemLat, corridaConfirmada?.origemLng, corridaConfirmada?.destinoLat, corridaConfirmada?.destinoLng, location]);

  useEffect(() => {
    if (!navMode || !location) return;
    const destinoAtual = getDestinoAtual();
    if (!destinoAtual) return;
    const navKey = `${destinoAtual.latitude},${destinoAtual.longitude}`;
    if (navKey === lastNavKeyRef.current) return;
    lastNavKeyRef.current = navKey;
    lastPreSpokenStepRef.current = -1;
    carregarInstrucoes(location, destinoAtual);
  }, [navMode, location?.latitude, location?.longitude, corridaConfirmada?.destinoLat, corridaConfirmada?.destinoLng, corridaConfirmada?.status]);

  // Centraliza o mapa na localização atual ao obtê-la
  useEffect(() => {
    if (cameraRef.current && location) {
      cameraRef.current.setCamera({
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: navMode ? 17 : 16,
        pitch: navMode ? 55 : 0,
        heading: navMode ? heading : 0,
        animationDuration: 500
      });
    }
  }, [location, navMode, heading]);

  const obterLocalizacao = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Permissao de localizacao negada');
      Alert.alert('Permissao negada', 'Precisamos da localizacao');
      return;
    }
    try {
      const last = await Location.getLastKnownPositionAsync({});
      if (last?.coords) {
        const fallback = {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setLocation(fallback);
        locationRef.current = fallback;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]);
      const regiao = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setLocation(regiao);
      locationRef.current = regiao;
      setLocationError('');
    } catch (error) {
      setLocationError('Falha ao obter localizacao');
    }
  };

  const escolherFotoDocumento = async (tipo) => {
    const ImagePicker = await loadImagePicker();
    if (!ImagePicker) {
      Alert.alert('Erro', 'Recurso de imagens indisponivel neste build.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissao necessaria', 'Permita acesso as fotos para enviar os documentos do veiculo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    const uri = result.assets[0].uri;
    if (tipo === 'seguro') setFotoSeguroUri(uri);
    if (tipo === 'inspecao') setFotoInspecaoUri(uri);
    if (tipo === 'licenciamento') setFotoLicenciamentoUri(uri);
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
      if (coords.length > 1) {
        setRotaMotorista(coords);
        return;
      }
      const rotaGoogle = await buscarRotaGoogle(origem, destino);
      if (rotaGoogle?.length > 1) {
        setRotaMotorista(rotaGoogle);
        return;
      }
    } catch (error) {
      console.error('Erro ao calcular rota do motorista:', error);
      try {
        const rotaGoogle = await buscarRotaGoogle(origem, destino);
        if (rotaGoogle?.length > 1) {
          setRotaMotorista(rotaGoogle);
          return;
        }
      } catch (googleError) {
        // Ignore fallback error.
      }
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
    if (!cameraRef.current || !rotaBounds) return;
    if (navMode) return;
    if (Date.now() < manualCameraUntilRef.current) return;
    cameraRef.current.setCamera({
      bounds: {
        ne: rotaBounds.ne,
        sw: rotaBounds.sw,
        paddingTop: 80,
        paddingBottom: 200,
        paddingLeft: 30,
        paddingRight: 30
      },
      animationDuration: 500
    });
  }, [rotaBounds, navMode]);

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
    abrirNavegacao();
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
    setFotoSeguroUri(null);
    setFotoInspecaoUri(null);
    setFotoLicenciamentoUri(null);
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
    setFotoSeguroUri(carro.fotoSeguro || null);
    setFotoInspecaoUri(carro.fotoInspecao || null);
    setFotoLicenciamentoUri(carro.fotoLicenciamento || null);
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
      if (fotoSeguroUri && !fotoSeguroUri.startsWith('http')) {
        formData.append('fotoSeguro', { uri: fotoSeguroUri, name: 'seguro.jpg', type: 'image/jpeg' });
      }
      if (fotoInspecaoUri && !fotoInspecaoUri.startsWith('http')) {
        formData.append('fotoInspecao', { uri: fotoInspecaoUri, name: 'inspecao.jpg', type: 'image/jpeg' });
      }
      if (fotoLicenciamentoUri && !fotoLicenciamentoUri.startsWith('http')) {
        formData.append('fotoLicenciamento', { uri: fotoLicenciamentoUri, name: 'licenciamento.jpg', type: 'image/jpeg' });
      }

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
    if (cameraRef.current && location) {
      manualCameraUntilRef.current = Date.now() + 5000;
      cameraRef.current.setCamera({
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: navMode ? 17 : 17,
        pitch: navMode ? 55 : 0,
        heading: navMode ? heading : 0,
        animationDuration: 500
      });
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
        <Text>{locationError || 'Carregando mapa...'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={obterLocalizacao}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.retryButtonText}>Abrir configuracoes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        ref={mapRef}
        styleURL={navMode ? MapboxGL.StyleURL.TrafficDay : MAPBOX_STYLE_URL}
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
          zoomLevel={navMode ? 17 : 16}
          pitch={navMode ? 55 : 0}
          heading={navMode ? heading : 0}
          animationDuration={500}
        />
        <MapboxGL.LocationPuck visible={false} />
        {driverCoordinate && (
          <MapboxGL.PointAnnotation
            key={`driver-${online ? 'online' : 'offline'}`}
            id="driver"
            coordinate={driverCoordinate}
          >
            <View style={[styles.carPinDriver, online ? styles.carPinDriverOnline : styles.carPinDriverOffline]}>
              <MaterialCommunityIcons name="car" size={18} color="#fff" />
            </View>
          </MapboxGL.PointAnnotation>
        )}
        {rotaMotoristaShape && (
          <MapboxGL.ShapeSource id="rotaMotorista" shape={rotaMotoristaShape}>
            <MapboxGL.LineLayer id="rotaMotoristaLine" style={{ lineColor: '#0ea5e9', lineWidth: 4 }} />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>
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
            <TouchableOpacity style={[styles.btnAceitar, styles.btnFull]} onPress={finalizarCorrida}>
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
                <Text style={styles.uploadBtnText}>{fotoSeguroUri ? 'Trocar foto do seguro' : 'Anexar foto do seguro'}</Text>
                {fotoSeguroUri && <Image source={{ uri: fotoSeguroUri }} style={styles.uploadPreview} />}
              </TouchableOpacity>

              <Text style={styles.label}>Inspecao</Text>
              <TextInput style={styles.input} placeholder="Validade (Inspecao)" value={formCarro.inspecaoValidade} onChangeText={(text) => setFormCarro({ ...formCarro, inspecaoValidade: text })} />
              <TouchableOpacity style={styles.uploadBtn} onPress={() => escolherFotoDocumento('inspecao')}>
                <Text style={styles.uploadBtnText}>{fotoInspecaoUri ? 'Trocar foto da inspecao' : 'Anexar foto da inspecao'}</Text>
                {fotoInspecaoUri && <Image source={{ uri: fotoInspecaoUri }} style={styles.uploadPreview} />}
              </TouchableOpacity>

              <Text style={styles.label}>Licenciamento</Text>
              <TextInput style={styles.input} placeholder="Data" value={formCarro.licenciamentoData} onChangeText={(text) => setFormCarro({ ...formCarro, licenciamentoData: text })} />
              <TextInput style={styles.input} placeholder="Validade (Licenciamento)" value={formCarro.licenciamentoValidade} onChangeText={(text) => setFormCarro({ ...formCarro, licenciamentoValidade: text })} />
              <TouchableOpacity style={styles.uploadBtn} onPress={() => escolherFotoDocumento('licenciamento')}>
                <Text style={styles.uploadBtnText}>{fotoLicenciamentoUri ? 'Trocar foto do licenciamento' : 'Anexar foto do licenciamento'}</Text>
                {fotoLicenciamentoUri && <Image source={{ uri: fotoLicenciamentoUri }} style={styles.uploadPreview} />}
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
  retryButton: { marginTop: 12, backgroundColor: '#0ea5e9', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  retryButtonText: { color: 'white', fontWeight: '700' },
  menuButton: { position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'white', padding: 10, borderRadius: 12, elevation: 4 },
  mapboxError: { position: 'absolute', top: 110, left: 20, right: 20, backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', zIndex: 999 },
  mapboxErrorText: { color: '#991b1b', fontSize: 12, fontWeight: '700' },
  menuLine: { width: 22, height: 2, backgroundColor: '#0f172a', marginVertical: 2 },
  statusBadge: { position: 'absolute', top: 55, right: 20, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, zIndex: 999 },
  online: { backgroundColor: '#10b981' },
  offline: { backgroundColor: '#ef4444' },
  statusText: { color: '#fff', fontSize: 12 },

  bottomButton: { position: 'absolute', bottom: 48, left: 16, right: 16 },
  btnOnline: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnOffline: { backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },

  corridaCard: { position: 'absolute', bottom: 78, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 10, padding: 10, elevation: 5 },
  corridaCardSlim: { paddingVertical: 8, paddingHorizontal: 10 },
  corridaTitulo: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  corridaLinha: { fontSize: 11, color: '#334155', marginBottom: 2 },
  corridaAcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  btnAceitar: { flexBasis: '48%', backgroundColor: '#10b981', paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  btnRecusar: { flexBasis: '48%', backgroundColor: '#ef4444', paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  btnFull: { flexBasis: '100%' },

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

  botaoCentralizar: { position: 'absolute', bottom: 110, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 7, borderWidth: 1, borderColor: '#e2e8f0', zIndex: 999 },
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
  carPin: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff', elevation: 6 },
  carPinOnline: { backgroundColor: '#22c55e' },
  carPinOffline: { backgroundColor: '#0f172a' },
  carPinDriver: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff', elevation: 6 },
  carPinDriverOnline: { backgroundColor: '#22c55e' },
  carPinDriverOffline: { backgroundColor: '#94a3b8' }
});
