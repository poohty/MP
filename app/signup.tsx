import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import Input from '@/components/Input';
import Button from '@/components/Button';
import GradientBackground from '@/components/GradientBackground';
import Colors from '@/constants/colors';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';

export default function SignupScreen() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  const validate = () => {
    const newErrors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    
    if (!name) {
      newErrors.name = 'Name is required';
    }
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationPermission(granted);
      
      if (!granted) {
        Alert.alert(
          'Location Permission',
          'Location access will help us find the best grocery store prices near you. You can change this later in settings.',
          [{ text: 'OK' }]
        );
      }
      
      return granted;
    } catch (error) {
      console.error('Location permission error:', error);
      setLocationPermission(false);
      return false;
    }
  };

  const handleSignup = async () => {
    if (!validate()) return;
    
    setIsLoading(true);
    try {
      let locationGranted = false;
      if (locationPermission === null) {
        locationGranted = await requestLocationPermission();
      } else {
        locationGranted = locationPermission;
      }
      
      const success = await signup(name, email, password, locationGranted);
      if (!success) {
        setErrors({ email: 'Failed to create account' });
      }
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({ email: 'An error occurred during signup' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>
        
        <View style={styles.signupBlock}>
          <Input
            label="Name"
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
            error={errors.name}
          />
          
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          
          <Input
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            isPassword
            error={errors.password}
          />
          
          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            error={errors.confirmPassword}
          />
          
          {locationPermission === null && (
            <View style={styles.locationSection}>
              <Text style={styles.locationTitle}>Location Services</Text>
              <Text style={styles.locationDescription}>
                Allow location access to find the best grocery store prices near you
              </Text>
              <View style={styles.locationButtons}>
                <TouchableOpacity
                  style={[styles.locationButton, styles.allowButton]}
                  onPress={async () => {
                    const granted = await requestLocationPermission();
                    setLocationPermission(granted);
                  }}
                >
                  <MapPin size={20} color={Colors.background} />
                  <Text style={styles.allowButtonText}>Allow Location</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.locationButton, styles.skipButton]}
                  onPress={() => setLocationPermission(false)}
                >
                  <Text style={styles.skipButtonText}>Skip for Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <Button
            title="Sign Up"
            onPress={handleSignup}
            isLoading={isLoading}
            style={styles.button}
            disabled={locationPermission === null}
          />
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={styles.footerLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    marginBottom: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  signupBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    ...Colors.shadowMd,
  },
  button: {
    marginTop: 8,
  },
  locationSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: Colors.light.muted,
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  locationDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  locationButtons: {
    gap: 10,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Colors.radius,
    gap: 8,
  },
  allowButton: {
    backgroundColor: Colors.primary,
  },
  skipButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  allowButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  skipButtonText: {
    color: Colors.text,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 20,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginRight: 4,
  },
  footerLink: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});