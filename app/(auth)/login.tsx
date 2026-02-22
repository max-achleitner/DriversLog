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
import { signIn } from '../../src/lib/auth';
import { useToast } from '../../src/contexts/ToastContext';

export default function LoginScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signIn(email.trim(), password);
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
          <Text className="text-4xl font-bold text-primary">DriversLog</Text>
          <Text className="mt-1 text-base text-text-secondary">Willkommen zurück.</Text>
        </View>

        {/* ── Form ── */}
        <View className="gap-4">
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
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
          </View>

          {error && (
            <View className="rounded-lg bg-error/10 px-4 py-3">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => ({ opacity: pressed || loading ? 0.75 : 1 })}
            className="mt-2 items-center rounded-xl bg-primary py-4"
          >
            {loading ? (
              <ActivityIndicator color="#F5F2ED" />
            ) : (
              <Text className="text-base font-semibold text-text-light">Anmelden</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            className="items-center py-2"
          >
            <Text className="text-sm text-text-secondary">Passwort vergessen?</Text>
          </Pressable>
        </View>

        {/* ── Register link ── */}
        <View className="mt-10 flex-row justify-center">
          <Text className="text-sm text-text-secondary">Noch kein Konto? </Text>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text className="text-sm font-semibold text-accent">Jetzt registrieren</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
