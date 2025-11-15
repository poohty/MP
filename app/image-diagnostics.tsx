import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import Colors from '@/constants/colors';

export default function ImageDiagnostics() {
  const { recipes } = useRecipes();
  const [failures, setFailures] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('meal-planner-image-failures');
        if (raw) setFailures(JSON.parse(raw));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView>
        <Text style={styles.heading}>Image fetch diagnostics</Text>
        {failures.length === 0 ? <Text style={styles.empty}>No failures recorded</Text> : (
          failures.map((f, idx) => (
            <View key={idx} style={styles.card}>
              <Text style={styles.title}>{f.recipeUrl}</Text>
              <Text style={styles.subtitle}>{f.imageUrl} — {f.httpStatus}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: Colors.background },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  empty: { fontSize: 14, color: '#666' },
  card: { padding: 12, backgroundColor: Colors.card, borderRadius: 8, marginBottom: 8 },
  title: { fontWeight: '600' },
  subtitle: { color: '#444', marginTop: 6 }
});
