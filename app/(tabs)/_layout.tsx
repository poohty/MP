import { Tabs } from "expo-router";
import { Home, Book, Calendar, User, Users, ShoppingBag } from "lucide-react-native";
import React from "react";
import Colors from "@/constants/colors";
import { useTheme } from "@/hooks/theme-store";

export default function TabLayout() {
  const { themeMode } = useTheme();
  const theme = themeMode === 'dark' ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopWidth: 0,
          elevation: 0,
          height: 60,
          paddingBottom: 8,
        },
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTintColor: theme.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerTitle: "",
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recipe-book"
        options={{
          title: "Cook Book",
          tabBarIcon: ({ color }) => <Book size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="meal-plans"
        options={{
          title: "Meal Plans",
          tabBarIcon: ({ color }) => <Calendar size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="grocery-list"
        options={{
          title: "Grocery",
          tabBarIcon: ({ color }) => <ShoppingBag size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}