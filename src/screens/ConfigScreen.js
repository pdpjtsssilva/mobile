import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';

export default function ConfigScreen({ usuario, onSave, onClose }) {
  const [notificacoes, setNotificacoes] = useState(true);
  const [pagamentoPadrao, setPagamentoPadrao] = useState('cartao');
  const [email, setEmail] = useState(usuario?.email || '');
  const [telefone, setTelefone] = useState(usuario?.telefone || '');

  const salvar = () => {
    Alert.alert('Configurações', 'Preferências salvas (mock).');
    onSave?.({ notificacoes, pagamentoPadrao, email, telefone });
    onClose?.();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Configurações</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />

      <Text style={styles.label}>Telefone</Text>
      <TextInput style={styles.input} value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />

      <Text style={styles.label}>Pagamento padrão</Text>
      <View style={styles.row}>
        {['cartao', 'mbway', 'dinheiro'].map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.metodoBtn, pagamentoPadrao === m && styles.metodoBtnAtivo]}
            onPress={() => setPagamentoPadrao(m)}
          >
            <Text style={[styles.metodoBtnText, pagamentoPadrao === m && styles.metodoBtnTextAtivo]}>
              {m === 'cartao' ? 'Cartão' : m === 'mbway' ? 'MB Way' : 'Dinheiro'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Notificações</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.toggleBtn, notificacoes && styles.toggleAtivo]}
          onPress={() => setNotificacoes(true)}
        >
          <Text style={[styles.toggleText, notificacoes && styles.toggleTextAtivo]}>Ativas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, !notificacoes && styles.toggleAtivo]}
          onPress={() => setNotificacoes(false)}
        >
          <Text style={[styles.toggleText, !notificacoes && styles.toggleTextAtivo]}>Inativas</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.salvar} onPress={salvar}>
        <Text style={styles.salvarText}>Salvar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.fechar} onPress={onClose}>
        <Text style={styles.fecharText}>Fechar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 60, paddingHorizontal: 20 },
  titulo: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 14, color: '#64748b', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: 'white', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  metodoBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#e2e8f0', alignItems: 'center' },
  metodoBtnAtivo: { backgroundColor: '#0ea5e9' },
  metodoBtnText: { color: '#475569', fontWeight: '600' },
  metodoBtnTextAtivo: { color: 'white' },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#e2e8f0', alignItems: 'center' },
  toggleAtivo: { backgroundColor: '#22c55e' },
  toggleText: { color: '#475569', fontWeight: '600' },
  toggleTextAtivo: { color: 'white' },
  salvar: { marginTop: 20, backgroundColor: '#10b981', padding: 14, borderRadius: 10, alignItems: 'center' },
  salvarText: { color: 'white', fontWeight: '700' },
  fechar: { marginTop: 12, alignItems: 'center' },
  fecharText: { color: '#ef4444', fontWeight: '700' },
});
