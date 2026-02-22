import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { resetPassword } from '../../src/lib/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      setError('Bitte E-Mail-Adresse eingeben.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await resetPassword(email.trim());

    setLoading(false);

    if (!result.success) {
      setError(result.error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}>
        {/* ── Header ── */}
        <View style={{ marginBottom: 40 }}>
          <Text className="text-3xl font-bold text-primary">Passwort zurücksetzen</Text>
          <Text className="mt-2 text-base leading-6 text-text-secondary">
            Wir senden dir einen Link, mit dem du ein neues Passwort festlegen kannst.
          </Text>
        </View>

        {sent ? (
          /* ── Success State ── */
          <View>
            {/* Kein success-Token in tailwind.config → accent-Gruen als naechste passende Farbe */}
            <View className="mb-6 rounded-xl bg-accent/10 px-5 py-5">
              <Text className="text-base font-semibold text-accent">E-Mail wurde gesendet</Text>
              <Text className="mt-1 text-sm leading-5 text-accent/80">
                Schau in dein Postfach ({email}) und folge dem Link zum Zurücksetzen.
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              className="items-center rounded-xl bg-primary py-4"
            >
              <Text className="text-base font-semibold text-text-light">Zurück zur Anmeldung</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Form ── */
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
                onSubmitEditing={handleReset}
                returnKeyType="send"
              />
            </View>

            {error && (
              <View className="rounded-lg bg-error/10 px-4 py-3">
                <Text className="text-sm text-error">{error}</Text>
              </View>
            )}

            <Pressable
              onPress={handleReset}
              disabled={loading}
              style={({ pressed }) => ({ opacity: pressed || loading ? 0.75 : 1 })}
              className="mt-2 items-center rounded-xl bg-primary py-4"
            >
              {loading ? (
                <ActivityIndicator color="#F5F2ED" />
              ) : (
                <Text className="text-base font-semibold text-text-light">Link senden</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              className="items-center py-2"
            >
              <Text className="text-sm text-text-secondary">Zurück zur Anmeldung</Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
