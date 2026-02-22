import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signUp } from '../../src/lib/auth';
import { useToast } from '../../src/contexts/ToastContext';

function getPasswordStrength(password: string): { label: string; color: string } | null {
  if (!password) return null;
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  if (hasMinLength && hasNumber) return { label: 'Sicher', color: '#2E7D4F' };
  if (hasMinLength || hasNumber) return { label: 'Mittel', color: '#C4841D' };
  return { label: 'Schwach', color: '#B91C1C' };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = getPasswordStrength(password);

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Benutzername muss mindestens 3 Zeichen haben.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    if (password.length < 8 || !/\d/.test(password)) {
      setError('Passwort muss mindestens 8 Zeichen und eine Zahl enthalten.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signUp(email.trim(), password, username.trim());
      if (!result.success) {
        setError(result.error.message);
        showToast({ type: 'error', message: result.error.message });
      }
      // Bei Erfolg uebernimmt der Auth-Guard in _layout.tsx die Navigation
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ marginBottom: 40 }}>
          <Text className="text-4xl font-bold text-primary">Konto erstellen</Text>
          <Text className="mt-1 text-base text-text-secondary">Deine Touren warten.</Text>
        </View>

        {/* ── Form ── */}
        <View className="gap-4">
          <View>
            <Text className="mb-1.5 text-sm font-semibold text-primary">Benutzername</Text>
            <TextInput
              className="rounded-xl border border-primary/20 bg-background-card px-4 py-3.5 text-base text-text"
              placeholder="max_driver"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoComplete="username"
              value={username}
              onChangeText={setUsername}
              editable={!loading}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-semibold text-primary">E-Mail</Text>
            <TextInput
              className="rounded-xl border border-primary/20 bg-background-card px-4 py-3.5 text-base text-text"
              placeholder="deine@email.de"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-semibold text-primary">Passwort</Text>
            <TextInput
              className="rounded-xl border border-primary/20 bg-background-card px-4 py-3.5 text-base text-text"
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
            {strength && (
              <View className="mt-2 flex-row items-center gap-2">
                <View
                  style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: strength.color, opacity: 0.3 }}
                />
                <View
                  style={{
                    flex: strength.label === 'Schwach' ? 0 : strength.label === 'Mittel' ? 1 : 2,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: strength.color,
                  }}
                />
                <Text style={{ fontSize: 12, color: strength.color, fontWeight: '600' }}>
                  {strength.label}
                </Text>
              </View>
            )}
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-semibold text-primary">Passwort bestätigen</Text>
            <TextInput
              className="rounded-xl border border-primary/20 bg-background-card px-4 py-3.5 text-base text-text"
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoComplete="new-password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
              onSubmitEditing={handleRegister}
              returnKeyType="go"
            />
          </View>

          {error && (
            <View className="rounded-lg bg-error/10 px-4 py-3">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={({ pressed }) => ({ opacity: pressed || loading ? 0.75 : 1 })}
            className="mt-2 items-center rounded-xl bg-primary py-4"
          >
            {loading ? (
              <ActivityIndicator color="#F5F2ED" />
            ) : (
              <Text className="text-base font-semibold text-text-light">Registrieren</Text>
            )}
          </Pressable>
        </View>

        {/* ── Login link ── */}
        <View className="mt-10 flex-row justify-center">
          <Text className="text-sm text-text-secondary">Bereits ein Konto? </Text>
          <Pressable onPress={() => router.back()}>
            <Text className="text-sm font-semibold text-accent">Anmelden</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
