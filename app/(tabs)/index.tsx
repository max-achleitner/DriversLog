import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-3xl font-bold text-primary">DriversLog</Text>
      <Text className="mt-2 text-lg text-text-secondary">
        Genussfahren & Community
      </Text>
    </View>
  );
}
