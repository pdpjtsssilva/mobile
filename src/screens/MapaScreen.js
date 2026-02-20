import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, Image, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import socket from '../services/websocket';

const { width, height } = Dimensions.get('window');

export default function MapaScreen() {
  const mapRef = useRef(null);
  const [localizacaoMotorista, setLocalizacaoMotorista] = useState(null);

  useEffect(() => {
    socket.on('posicao_motorista', (dados) => {
      setLocalizacaoMotorista({ latitude: dados.latitude, longitude: dados.longitude });
    });

    socket.on('motorista_chegando', (dados) => {
      Alert.alert("Chegando!", dados.mensagem);
    });

    return () => {
      socket.off('posicao_motorista');
      socket.off('motorista_chegando');
    };
  }, []);

  return (
    <View style={styles.container}>
      <MapView style={styles.map} provider={PROVIDER_GOOGLE}>
        {localizacaoMotorista && (
          <Marker coordinate={localizacaoMotorista}>
            <Image source={require('../../assets/carro.png')} style={{ width: 40, height: 40 }} />
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, map: { width, height } });