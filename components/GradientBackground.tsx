import React from 'react';
import { ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function GradientBackground({ children, style }: GradientBackgroundProps) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <LinearGradient
        colors={[
          '#7C3AED', // Darker bright purple
          '#6B46C1', // Darker medium purple
          '#553C9A', // Darker purple
          '#4C1D95', // Deep purple
          '#1E1B4B', // Very dark purple
          '#000000'  // Black
        ]}
        locations={[0, 0.2, 0.4, 0.55, 0.65, 1]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        }}
      />
      {/* Primary glowing overlay effect */}
      <LinearGradient
        colors={[
          'rgba(124, 58, 237, 0.6)', // Darker stronger purple glow at top
          'rgba(124, 58, 237, 0.4)',
          'rgba(107, 70, 193, 0.25)',
          'rgba(85, 60, 154, 0.15)',
          'rgba(76, 29, 149, 0.08)',
          'transparent'
        ]}
        locations={[0, 0.2, 0.4, 0.55, 0.7, 1]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        }}
      />
      {/* Secondary glow layer for enhanced effect */}
      <LinearGradient
        colors={[
          'rgba(139, 92, 246, 0.4)', // Darker lighter purple glow
          'rgba(139, 92, 246, 0.2)',
          'rgba(124, 58, 237, 0.1)',
          'transparent'
        ]}
        locations={[0, 0.25, 0.5, 1]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        }}
      />
      {/* Radial glow effect simulation */}
      <LinearGradient
        colors={[
          'rgba(168, 85, 247, 0.15)', // Darker very light purple center glow
          'rgba(168, 85, 247, 0.08)',
          'transparent'
        ]}
        locations={[0, 0.4, 1]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '50%',
        }}
      />
      {children}
    </View>
  );
}