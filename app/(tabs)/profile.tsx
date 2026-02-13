import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-bold text-primary">Mein Profil</Text>
      </View>

      {/* Einstellungen-Link */}
      <View className="mx-4 mb-8">
        <Pressable
          onPress={() => router.push('/settings')}
          className="flex-row items-center justify-between rounded-2xl bg-background-card px-5 py-4 active:opacity-80"
        >
          <View className="flex-row items-center">
            <Ionicons name="settings-outline" size={22} color="#1B3A4B" />
            <Text className="ml-3 text-base font-semibold text-text">
              Einstellungen
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>
      </View>
    </View>
  );
}
