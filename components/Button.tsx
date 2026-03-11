import React from 'react';
import { 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps
} from 'react-native';

import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/theme-store';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  isLoading?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  disabled?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  style,
  textStyle,
  disabled = false,
  icon,
  ...rest
}: ButtonProps) {
  const { isDark } = useTheme();
  const themeColors = isDark ? Colors.dark : Colors.light;
  const getButtonStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: themeColors.primary };
      case 'secondary':
        return { 
          backgroundColor: themeColors.surface,
          borderWidth: 1,
          borderColor: themeColors.border
        };
      case 'outline':
        return { 
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: themeColors.primary
        };
      default:
        return { backgroundColor: themeColors.primary };
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
        return { color: themeColors.primaryForeground, fontWeight: '600' as const, fontSize: 16 };
      case 'secondary':
        return { color: themeColors.text, fontWeight: '600' as const, fontSize: 16 };
      case 'outline':
        return { color: themeColors.primary, fontWeight: '600' as const, fontSize: 16 };
      default:
        return { color: themeColors.primaryForeground, fontWeight: '600' as const, fontSize: 16 };
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'small':
        return styles.smallButton;
      case 'medium':
        return styles.mediumButton;
      case 'large':
        return styles.largeButton;
      default:
        return styles.mediumButton;
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator color={variant === 'outline' ? themeColors.primary : themeColors.primaryForeground} />;
    }
    
    return (
      <>
        {icon && icon}
        <Text 
          style={[getTextStyle(), textStyle, icon ? { marginLeft: 8 } : undefined]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
      </>
    );
  };



  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      style={[
        styles.buttonBase,
        getButtonStyle(),
        getSizeStyle(),
        style,
        disabled && styles.disabledButton
      ]}
      activeOpacity={0.8}
      testID="button"
      {...rest}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: Colors.radius,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    flexDirection: 'row' as const,
    ...Colors.shadow,
  },
  smallButton: {
    height: 36,
    paddingHorizontal: 16,
  },
  mediumButton: {
    height: 50,
    paddingHorizontal: 24,
  },
  largeButton: {
    height: 56,
    paddingHorizontal: 32,
  },
  disabledButton: {
    opacity: 0.5,
  },
});