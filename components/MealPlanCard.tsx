import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MealPlan } from '@/types';
import Colors from '@/constants/colors';
import { Calendar, ChevronRight } from 'lucide-react-native';

interface MealPlanCardProps {
  mealPlan: MealPlan;
  onPress: (mealPlan: MealPlan) => void;
}

export default function MealPlanCard({ mealPlan, onPress }: MealPlanCardProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(mealPlan)}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.dateContainer}>
          <Calendar size={16} color={Colors.primary} />
          <Text style={styles.date}>{formatDate(mealPlan.createdAt)}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Main Courses</Text>
          <Text style={styles.count}>{mealPlan.mainCourses.length}</Text>
        </View>
        
        {mealPlan.appetizers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appetizers</Text>
            <Text style={styles.count}>{mealPlan.appetizers.length}</Text>
          </View>
        )}
        
        {mealPlan.saladsAndSoups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Salads & Soups</Text>
            <Text style={styles.count}>{mealPlan.saladsAndSoups.length}</Text>
          </View>
        )}
        
        {mealPlan.desserts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Desserts</Text>
            <Text style={styles.count}>{mealPlan.desserts.length}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.viewDetails}>View Details</Text>
        <ChevronRight size={16} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    color: Colors.textSecondary,
    marginLeft: 8,
    fontSize: 14,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  section: {
    alignItems: 'center',
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  count: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  viewDetails: {
    color: Colors.primary,
    marginRight: 4,
    fontSize: 14,
    fontWeight: '500',
  },
});