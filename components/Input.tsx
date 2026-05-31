import React, { useState } from 'react';
import { 
  StyleSheet, 
  TextInput, 
  View, 
  Text, 
  TextInputProps,
  ViewStyle,
  TextStyle,
  TouchableOpacity
} from 'react-native';
import Colors from '@/constants/colors';
import { Eye, EyeOff } from 'lucide-react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  isPassword?: boolean;
}

export default function Input({
  label,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  isPassword = false,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
        </Text>
      )}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.focusedInput,
        error ? styles.errorInput : null
      ]}>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={Colors.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...rest}
        />
        
        {isPassword && (
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          >
            {showPassword ? (
              <EyeOff size={20} color={Colors.textSecondary} />
            ) : (
              <Eye size={20} color={Colors.textSecondary} />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: Colors.text,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Colors.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 50,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    height: '100%',
  },
  focusedInput: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  errorInput: {
    borderColor: Colors.error,
    borderWidth: 2,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 4,
  },
});