// mobile/src/services/websocket.js
import io from 'socket.io-client';
import { SOCKET_URL } from '../config';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = {};
  }

  connect() {
    if (this.socket && this.connected) {
      console.log('WebSocket já conectado');
      return;
    }

    console.log('Conectando ao WebSocket...', SOCKET_URL);

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('WebSocket conectado!', this.socket.id);
      this.connected = true;
      if (this.listeners.connect) {
        this.listeners.connect.forEach(callback => callback());
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket desconectado:', reason);
      this.connected = false;
      if (this.listeners.disconnect) {
        this.listeners.disconnect.forEach(callback => callback());
      }
    });

    this.socket.on('error', (error) => {
      console.error('Erro WebSocket:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      console.log('WebSocket desconectado');
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected;
  }

  onConnect(callback) {
    if (!this.listeners.connect) {
      this.listeners.connect = [];
    }
    this.listeners.connect.push(callback);
  }

  onDisconnect(callback) {
    if (!this.listeners.disconnect) {
      this.listeners.disconnect = [];
    }
    this.listeners.disconnect.push(callback);
  }

  // Passageiro
  entrarComoPassageiro(passageiroId) {
    if (!this.socket) return;
    console.log('Emitindo: passageiro:entrar', { passageiroId });
    this.socket.emit('passageiro:entrar', { passageiroId });
  }

  solicitarCorrida(data) {
    if (!this.socket) return;
    console.log('Emitindo: passageiro:solicitarCorrida', data);
    this.socket.emit('passageiro:solicitarCorrida', data);
  }

  onCorridaAceita(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: corrida:aceita');
    this.socket.on('corrida:aceita', callback);
  }

  onMotoristaPosicaoAtualizada(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: motorista:posicaoAtualizada');
    this.socket.on('motorista:posicaoAtualizada', callback);
  }

  onMotoristaChegou(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: motorista:chegou');
    this.socket.on('motorista:chegou', callback);
  }

  onCorridaIniciada(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: corrida:iniciada');
    this.socket.on('corrida:iniciada', callback);
  }

  onCorridaFinalizada(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: corrida:finalizada');
    this.socket.on('corrida:finalizada', callback);
  }

  onCorridaRecusada(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: corrida:recusada');
    this.socket.on('corrida:recusada', callback);
  }

  onCorridaCancelada(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: corrida:cancelada');
    this.socket.on('corrida:cancelada', callback);
  }

  // Motorista
  motoristaOnline(data) {
    if (!this.socket) return;
    console.log('Emitindo: motorista:online', data);
    this.socket.emit('motorista:online', data);
  }

  motoristaOffline(motoristaId) {
    if (!this.socket) return;
    console.log('Emitindo: motorista:offline', { motoristaId });
    this.socket.emit('motorista:offline', { motoristaId });
  }

  entrarComoMotorista(motoristaId, nome, localizacao) {
    if (!this.socket) return;
    console.log('Emitindo: motorista:online', { motoristaId, nome, ...localizacao });
    this.socket.emit('motorista:online', { motoristaId, nome, ...localizacao });
  }

  aceitarCorrida(data) {
    if (!this.socket) return;
    console.log('Emitindo: motorista:aceitarCorrida', data);
    this.socket.emit('motorista:aceitarCorrida', data);
  }

  recusarCorrida(data) {
    if (!this.socket) return;
    console.log('Emitindo: motorista:recusarCorrida', data);
    this.socket.emit('motorista:recusarCorrida', data);
  }

  motoristaChegouOrigem(data) {
    if (!this.socket) return;
    console.log('Emitindo: motorista:chegouOrigem', data);
    this.socket.emit('motorista:chegouOrigem', data);
  }

  iniciarCorrida(data) {
    if (!this.socket) return;
    console.log('Emitindo: motorista:iniciarCorrida', data);
    this.socket.emit('motorista:iniciarCorrida', data);
  }

  finalizarCorrida(data) {
    if (!this.socket) return;
    console.log('Emitindo: motorista:finalizarCorrida', data);
    this.socket.emit('motorista:finalizarCorrida', data);
  }

  atualizarPosicao(data) {
    if (!this.socket) return;
    console.log('Emitindo: motorista:atualizarPosicao', data);
    this.socket.emit('motorista:atualizarPosicao', data);
  }

  onNovaSolicitacao(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: corrida:novaSolicitacao');
    this.socket.on('corrida:novaSolicitacao', callback);
  }

  onCorridaConfirmada(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: motorista:corridaConfirmada');
    this.socket.on('motorista:corridaConfirmada', callback);
  }

  onCorridaJaPega(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: corrida:jaPega');
    this.socket.on('corrida:jaPega', callback);
  }

  onNovaSolicitacaoCorrida(callback) {
    if (!this.socket) return;
    console.log('Ouvindo evento: corrida:novaSolicitacao');
    this.socket.on('corrida:novaSolicitacao', callback);
  }
}

// Exportar uma instância única (singleton)
const websocketService = new WebSocketService();
export default websocketService;
