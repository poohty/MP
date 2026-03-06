import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/theme-store';
import { Home, BookOpen, CalendarDays, Dices, ShoppingCart } from 'lucide-react-native';

interface HelpSection {
  title: string;
  icon: React.ReactNode;
  tips: { title: string; body: string }[];
}

export default function HelpSupportScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const sections: HelpSection[] = [
    {
      title: 'Home',
      icon: <Home size={20} color={colors.primary} />,
      tips: [
        { title: 'Add recipes', body: 'You can add recipes in three ways.' },
        { title: 'Upload a photo', body: 'Use the Photo option to scan a recipe from an image.' },
        { title: 'Paste a link', body: 'Use the Link option to paste any recipe URL and import it.' },
        { title: 'Import a folder', body: 'Use Folder/Bookmark import to upload multiple recipe links at once.' },
      ],
    },
    {
      title: 'Recipe Book',
      icon: <BookOpen size={20} color={colors.primary} />,
      tips: [
        { title: 'Browse categories', body: 'Tap a category to filter your cookbook.' },
        { title: 'Search recipes', body: 'Use the search bar to find recipes by name across your cookbook.' },
        { title: 'Open a recipe', body: 'Tap a recipe card to view ingredients, instructions, and details.' },
      ],
    },
    {
      title: 'Meal Plans',
      icon: <CalendarDays size={20} color={colors.primary} />,
      tips: [
        { title: 'Create a meal plan', body: 'Tap Create Meal Plan to answer a few questions so we can build your plan.' },
        { title: 'Review plans', body: 'Your saved meal plans appear here. Tap one to open it.' },
      ],
    },
    {
      title: 'Meal Plan Review',
      icon: <Dices size={20} color={colors.primary} />,
      tips: [
        { title: 'Roulette changes', body: 'Tap the Roulette Wheel to swap a suggestion. You can spin as many times as you want.' },
        { title: 'Schedule a meal', body: 'Tap the calendar icon next to any suggested recipe to pick a day for it. Choose a date and tap Save to add it to your calendar. You can skip this entirely and go straight to Create Grocery List if you prefer.' },
      ],
    },
    {
      title: 'Grocery List',
      icon: <ShoppingCart size={20} color={colors.primary} />,
      tips: [
        { title: 'Check items off', body: 'Tap the checkbox to mark items as you shop.' },
        { title: 'Find cheapest store near me', body: 'Use Find Cheapest Store to compare the 3 closest stores for your full list.' },
        { title: 'Add a store manually', body: 'You can also add a store manually to compare pricing.' },
      ],
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Help & Support' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.header, { color: colors.text }]}>How to use the app</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          A quick reference for every major feature.
        </Text>

        {sections.map((section) => (
          <View key={section.title} style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary + '14' }]}>
                {section.icon}
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            </View>

            {section.tips.map((tip, i) => (
              <View key={i} style={[styles.tipRow, i < section.tips.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[styles.tipBullet, { backgroundColor: colors.primary }]} />
                <View style={styles.tipText}>
                  <Text style={[styles.tipTitle, { color: colors.text }]}>{tip.title}</Text>
                  <Text style={[styles.tipBody, { color: colors.textSecondary }]}>{tip.body}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Need more help? Reach out via the app settings or email us.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 26,
    fontWeight: '800' as const,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 24,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  tipBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    marginTop: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
