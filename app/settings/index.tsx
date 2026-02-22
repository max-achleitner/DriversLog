import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import MapView, { Circle, MapPressEvent, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSettings } from '../../src/hooks/useSettings';
import { useSync } from '../../src/contexts/SyncContext';
import { retryFailedItems } from '../../src/lib/offlineStore';

const ACCENT_GREEN = '#2E5A3C';
const MUTED = '#9CA3AF';
const PRIMARY = '#1B3A4B';
const CIRCLE_FILL = 'rgba(46,90,60,0.15)';
const CIRCLE_STROKE = 'rgba(46,90,60,0.5)';
const RACE_RED = '#E11D48';

export default function SettingsScreen() {
  const { settings, loading, update } = useSettings();
  const { pendingCount, failedCount, isSyncing, syncNow, refreshPendingCount } = useSync();
  const mapRef = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);

  const homeSet = settings.homeLat !== null && settings.homeLng !== null;

  const handleRaceModeToggle = useCallback(
    (value: boolean) => {
      if (value) {
        Alert.alert(
          'Race Mode aktivieren',
          'Warnung: Nur auf abgesperrten Strecken nutzen. Keine Haftung fuer Schaeden oder Strafzettel.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            {
              text: 'Bestaetigen',
              style: 'destructive',
              onPress: () => update('isRaceModeEnabled', true),
            },
          ],
        );
      } else {
        update('isRaceModeEnabled', false);
      }
    },
    [update],
  );

  const handleMapPress = useCallback(
    (e: MapPressEvent) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      update('homeLat', latitude);
      update('homeLng', longitude);
    },
    [update],
  );

  const handleUseCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Standort verweigert', 'Bitte erlaube den Standort-Zugriff in den Geraeteeinstellungen.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await update('homeLat', loc.coords.latitude);
      await update('homeLng', loc.coords.longitude);
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500,
      );
    } catch {
      Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
    } finally {
      setLocating(false);
    }
  }, [update]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const mapRegion = homeSet
    ? {
        latitude: settings.homeLat!,
        longitude: settings.homeLng!,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }
    : {
        latitude: 48.7758,
        longitude: 9.1829,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-12">
      {/* ── Sektion: Race Mode ── */}
      <Text className="mx-5 mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-text-secondary">
        Modus
      </Text>

      <View className="mx-4 overflow-hidden rounded-2xl bg-background-card">
        <View className="flex-row items-center px-4 py-4">
          <View
            className="h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: settings.isRaceModeEnabled ? RACE_RED : '#F3F4F6' }}
          >
            <Ionicons
              name="speedometer-outline"
              size={20}
              color={settings.isRaceModeEnabled ? '#FFFFFF' : MUTED}
            />
          </View>
          <View className="ml-3 mr-3 flex-1">
            <Text className="text-sm font-semibold text-text">Race Mode (Track Only)</Text>
            <Text className="mt-0.5 text-xs text-text-muted">
              High-Contrast-Theme fuer abgesperrte Strecken
            </Text>
          </View>
          <Switch
            value={settings.isRaceModeEnabled}
            onValueChange={handleRaceModeToggle}
            trackColor={{ false: '#D1D5DB', true: RACE_RED }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D5DB"
          />
        </View>
      </View>

      {/* ── Sektion: Automatische Erkennung ── */}
      <Text className="mx-5 mb-2 mt-8 text-xs font-semibold uppercase tracking-widest text-text-secondary">
        Automatische Erkennung
      </Text>

      <View className="mx-4 overflow-hidden rounded-2xl bg-background-card">
        <SettingRow
          icon="play-circle-outline"
          label="Auto-Start bei Verlassen der Homezone"
          value={settings.autoStartEnabled}
          onToggle={(v) => update('autoStartEnabled', v)}
        />
        <Divider />
        <SettingRow
          icon="stop-circle-outline"
          label="Auto-Stop bei Ankunft in Homezone"
          value={settings.autoStopEnabled}
          onToggle={(v) => update('autoStopEnabled', v)}
        />
        <Divider />
        <SettingRow
          icon="eye-off-outline"
          label="Privacy Zone aktivieren"
          subtitle="Verbirgt Start und Ziel im Radius"
          value={settings.privacyZoneEnabled}
          onToggle={(v) => update('privacyZoneEnabled', v)}
        />
      </View>

      {/* ── Sektion: Home Point definieren ── */}
      <Text className="mx-5 mb-2 mt-8 text-xs font-semibold uppercase tracking-widest text-text-secondary">
        Home Point definieren
      </Text>

      <View className="mx-4 overflow-hidden rounded-2xl bg-background-card">
        {/* Karte */}
        <View className="h-56">
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
            onPress={handleMapPress}
          >
            {homeSet && (
              <>
                <Marker
                  coordinate={{
                    latitude: settings.homeLat!,
                    longitude: settings.homeLng!,
                  }}
                  pinColor={ACCENT_GREEN}
                />
                <Circle
                  center={{
                    latitude: settings.homeLat!,
                    longitude: settings.homeLng!,
                  }}
                  radius={settings.homeRadiusMeters}
                  fillColor={CIRCLE_FILL}
                  strokeColor={CIRCLE_STROKE}
                  strokeWidth={2}
                />
              </>
            )}
          </MapView>
        </View>

        {/* Standort-Button */}
        <Pressable
          onPress={handleUseCurrentLocation}
          disabled={locating}
          className="flex-row items-center justify-center border-t border-text-muted/10 py-3.5 active:opacity-70"
        >
          {locating ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Ionicons name="locate-outline" size={18} color={PRIMARY} />
          )}
          <Text className="ml-2 text-sm font-semibold text-primary">
            {locating ? 'Standort wird ermittelt...' : 'Aktuellen Standort nutzen'}
          </Text>
        </Pressable>

        <Divider />

        {/* Radius-Anzeige */}
        <View className="flex-row items-center justify-between px-4 py-3.5">
          <View className="flex-row items-center">
            <Ionicons name="resize-outline" size={20} color={MUTED} />
            <Text className="ml-3 text-sm text-text">Radius</Text>
          </View>
          <View className="flex-row items-center">
            <RadiusButton
              label="-"
              onPress={() => {
                const next = Math.max(50, settings.homeRadiusMeters - 50);
                update('homeRadiusMeters', next);
              }}
            />
            <Text className="mx-3 min-w-[52px] text-center text-sm font-bold text-primary">
              {settings.homeRadiusMeters} m
            </Text>
            <RadiusButton
              label="+"
              onPress={() => {
                const next = Math.min(1000, settings.homeRadiusMeters + 50);
                update('homeRadiusMeters', next);
              }}
            />
          </View>
        </View>

        {/* Status-Hinweis */}
        {!homeSet && (
          <View className="border-t border-text-muted/10 px-4 py-3">
            <Text className="text-center text-xs text-text-muted">
              Tippe auf die Karte oder nutze deinen aktuellen Standort, um den Home Point zu setzen.
            </Text>
          </View>
        )}
      </View>

      {/* ── Sektion: Synchronisierung ── */}
      <Text className="mx-5 mb-2 mt-8 text-xs font-semibold uppercase tracking-widest text-text-secondary">
        Synchronisierung
      </Text>

      <View className="mx-4 overflow-hidden rounded-2xl bg-background-card">
        {/* Status row */}
        <View className="flex-row items-center px-4 py-4">
          <View
            className="h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: failedCount > 0 ? '#FEF2F2' : pendingCount > 0 ? '#FFF7ED' : '#F0FDF4' }}
          >
            <Ionicons
              name={failedCount > 0 ? 'alert-circle-outline' : pendingCount > 0 ? 'cloud-upload-outline' : 'checkmark-circle-outline'}
              size={20}
              color={failedCount > 0 ? '#DC2626' : pendingCount > 0 ? '#B45309' : '#16A34A'}
            />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-sm font-semibold text-text">
              {pendingCount === 0
                ? 'Alles synchronisiert'
                : `${pendingCount} ${pendingCount === 1 ? 'Eintrag' : 'Einträge'} ausstehend`}
            </Text>
            {failedCount > 0 && (
              <Text className="mt-0.5 text-xs" style={{ color: '#DC2626' }}>
                {failedCount} {failedCount === 1 ? 'Eintrag' : 'Einträge'} fehlgeschlagen
              </Text>
            )}
          </View>
        </View>

        <Divider />

        {/* Manual sync button */}
        <Pressable
          onPress={syncNow}
          disabled={isSyncing || pendingCount === 0}
          className="flex-row items-center justify-center py-3.5 active:opacity-70"
          style={{ opacity: isSyncing || pendingCount === 0 ? 0.45 : 1 }}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Ionicons name="sync-outline" size={18} color={PRIMARY} />
          )}
          <Text className="ml-2 text-sm font-semibold text-primary">
            {isSyncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
          </Text>
        </Pressable>

        {/* Retry failed items */}
        {failedCount > 0 && (
          <>
            <Divider />
            <Pressable
              onPress={async () => {
                await retryFailedItems();
                await refreshPendingCount();
                await syncNow();
              }}
              className="flex-row items-center justify-center py-3.5 active:opacity-70"
            >
              <Ionicons name="refresh-outline" size={18} color="#DC2626" />
              <Text className="ml-2 text-sm font-semibold" style={{ color: '#DC2626' }}>
                Fehlgeschlagene erneut versuchen
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

/* ── Hilfs-Komponenten ── */

interface SettingRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}

function SettingRow({ icon, label, subtitle, value, onToggle }: SettingRowProps) {
  return (
    <View className="flex-row items-center px-4 py-3.5">
      <Ionicons name={icon} size={20} color={MUTED} />
      <View className="ml-3 mr-3 flex-1">
        <Text className="text-sm text-text">{label}</Text>
        {subtitle && (
          <Text className="mt-0.5 text-xs text-text-muted">{subtitle}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#D1D5DB', true: ACCENT_GREEN }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#D1D5DB"
      />
    </View>
  );
}

function Divider() {
  return <View className="ml-12 h-px bg-text-muted/10" />;
}

interface RadiusButtonProps {
  label: string;
  onPress: () => void;
}

function RadiusButton({ label, onPress }: RadiusButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10 active:bg-primary/20"
    >
      <Text className="text-base font-bold text-primary">{label}</Text>
    </Pressable>
  );
}
