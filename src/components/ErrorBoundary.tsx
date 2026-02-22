/**
 * ErrorBoundary.tsx
 *
 * React Error Boundary that catches unhandled JS errors in the component tree
 * and shows a friendly German fallback screen with a "Neu laden" button.
 *
 * Usage (wrap the root layout):
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * Note: Error Boundaries must be class components per the React spec.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log for future crash reporter integration
    console.error('[ErrorBoundary] Unhandled error:', error.message);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="warning-outline" size={64} color="#B45309" />
          <Text style={styles.title}>Etwas ist schiefgelaufen</Text>
          <Text style={styles.message}>
            Ein unerwarteter Fehler ist aufgetreten.{'\n'}Bitte versuche es erneut.
          </Text>
          <Pressable
            onPress={this.handleReset}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Neu laden</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F2ED',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B3A4B',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 36,
  },
  button: {
    backgroundColor: '#1B3A4B',
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#F5F2ED',
    fontWeight: '700',
    fontSize: 16,
  },
});
