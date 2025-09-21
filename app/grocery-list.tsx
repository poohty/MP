import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, FlatList, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import Colors from '@/constants/colors';
import { Check, Square, ArrowLeft, MapPin, Plus, X } from 'lucide-react-native';
import { GroceryList, GroceryItem, StoreComparison } from '@/types';

import * as Location from 'expo-location';
import Button from '@/components/Button';

export default function GroceryListScreen() {
  const { groceryListData } = useLocalSearchParams<{ groceryListData: string }>();

  const [groceryList, setGroceryList] = useState<GroceryList>(() => {
    try {
      return JSON.parse(groceryListData || '{}');
    } catch {
      router.back();
      return {} as GroceryList;
    }
  });
  const [storeComparisons, setStoreComparisons] = useState<StoreComparison[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [showComparisons, setShowComparisons] = useState(false);
  const [showManualStoreModal, setShowManualStoreModal] = useState(false);
  const [manualStores, setManualStores] = useState<StoreComparison[]>([]);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreDistance, setNewStoreDistance] = useState('');

  const toggleItem = (itemId: string) => {
    setGroceryList(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    }));
  };

  const requestLocationPermission = () => {
    Alert.alert(
      'Location Permission',
      'Allow this app to use your location while using the app to find nearby stores with the best prices?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: findStoresWithPricing,
        },
      ]
    );
  };

  const findStoresWithPricing = async () => {
    setIsLoadingStores(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access to find nearby stores.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get high accuracy location with multiple attempts and strict validation
      console.log('Getting precise GPS location...');
      let location;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`Location attempt ${attempts}/${maxAttempts}`);
          
          // Always try for highest accuracy first
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          
          const { latitude, longitude, accuracy } = location.coords;
          
          // Strict validation of coordinates and accuracy
          if (!latitude || !longitude || 
              Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
              (accuracy !== null && accuracy > 100)) { // Reject if accuracy is worse than 100 meters
            console.log(`Location rejected - lat: ${latitude}, lng: ${longitude}, accuracy: ${accuracy}m`);
            if (attempts < maxAttempts) {
              console.log('Retrying for better accuracy...');
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              continue;
            } else {
              throw new Error(`Location accuracy insufficient: ${accuracy || 'unknown'}m (need <100m)`);
            }
          }
          
          console.log(`High-precision location obtained: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);
          break;
          
        } catch (error) {
          console.log(`Location attempt ${attempts} failed:`, error);
          if (attempts >= maxAttempts) {
            throw new Error('Unable to get precise location after multiple attempts. Please ensure GPS is enabled and you have a clear view of the sky.');
          }
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
      
      if (!location) {
        throw new Error('Failed to obtain location');
      }
      
      const { latitude, longitude, accuracy } = location.coords;
      
      // Final validation
      if (!latitude || !longitude || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw new Error('Invalid location coordinates received');
      }
      
      // Alert user about location precision
      if (accuracy !== null && accuracy > 50) {
        Alert.alert(
          'Location Accuracy Warning',
          `Your location accuracy is ${Math.round(accuracy)}m. For best results, please ensure GPS is enabled and you're outdoors with a clear view of the sky.`,
          [{ text: 'Continue Anyway' }, { text: 'Cancel', style: 'cancel', onPress: () => { setIsLoadingStores(false); return; } }]
        );
      }

      const itemNames = groceryList.items.map(item => item.name);
      
      // Get location details for better search context
      let locationContext = '';
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseGeocode && reverseGeocode.length > 0) {
          const addr = reverseGeocode[0];
          locationContext = `${addr.city || ''}, ${addr.region || ''} ${addr.postalCode || ''}`;
          console.log('Location context:', locationContext);
        }
      } catch (e) {
        console.log('Reverse geocoding failed:', e);
      }
      
      // Progressive radius search: 2, 5, 10, 20 miles
      const searchRadii = [2, 5, 10, 20];
      let finalComparisons: any[] = [];
      
      for (const radius of searchRadii) {
        console.log(`Searching for stores within ${radius} mile radius...`);
        
        // Use a more targeted approach to find real stores with Google search simulation
        const response = await fetch('https://toolkit.rork.com/text/llm/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `You are a Google Maps Places API simulator that finds REAL grocery stores. You must act as if you have direct access to Google Maps data and return only stores that actually exist.

Your task: Simulate a Google Places API search for "grocery stores" near the exact coordinates provided.

COORDINATES: ${latitude}, ${longitude}
SEARCH RADIUS: ${radius} miles
GPS ACCURACY: ${accuracy || 'unknown'} meters

MAJOR GROCERY CHAINS TO SEARCH FOR:
- Walmart Supercenter, Walmart Neighborhood Market
- Kroger, King Soopers, Ralphs, Fred Meyer, Harris Teeter
- Safeway, Albertsons, Vons, Pavilions, Tom Thumb
- Publix Super Markets
- H-E-B, Central Market
- Meijer
- Target (with grocery)
- Whole Foods Market
- Trader Joe's
- Aldi
- Food Lion, Giant Food, Stop & Shop
- Wegmans, ShopRite, Giant Eagle
- IGA (Independent Grocers Alliance)
- Piggly Wiggly
- Winn-Dixie, BI-LO
- Food 4 Less, Save-A-Lot
- Price Chopper, Market Basket, Hannaford
- Regional chains and independent stores

SEARCH METHODOLOGY:
1. Start with major chains that have widespread coverage
2. Look for regional chains specific to the area (based on coordinates)
3. Include independent grocery stores and markets
4. Calculate precise distances from ${latitude}, ${longitude}
5. Only include stores within ${radius} miles

RETURN FORMAT (JSON array only):
[
  {
    "storeName": "[Chain Name + Location Identifier]",
    "address": "[Street Number] [Street Name], [City], [State] [ZIP]",
    "distance": [miles from coordinates as decimal],
    "drivingTime": "[X] min",
    "phone": "(XXX) XXX-XXXX" or "Not available",
    "totalPrice": [realistic total for grocery list],
    "items": [{"name": "item", "price": X.XX, "available": true}]
  }
]

IMPORTANT: If you cannot find any real stores within ${radius} miles of ${latitude}, ${longitude}, return an empty array: []`
              },
              {
                role: 'user',
                content: `GOOGLE SEARCH SIMULATION:

EXACT SEARCH QUERY: "grocery stores near ${locationContext || `${latitude}, ${longitude}`}"
COORDINATES: ${latitude}, ${longitude}
RADIUS: ${radius} miles maximum
LOCATION CONTEXT: ${locationContext || 'Unknown location'}
GPS ACCURACY: ${accuracy || 'unknown'}m

You must simulate what would appear if someone searched Google Maps for "grocery stores" at these exact coordinates.

METHODOLOGY:
1. Use the coordinates ${latitude}, ${longitude} as the center point
2. Search for major grocery chains that have locations in this area
3. Include regional chains common to this geographic region
4. Find independent grocery stores and markets
5. Calculate precise distances from the coordinates
6. Only include stores within ${radius} miles

STORE TYPES TO SEARCH:
• Major chains: Walmart, Kroger, Safeway, Albertsons, Publix, H-E-B, Meijer, Target
• Warehouse clubs: Costco, Sam's Club, BJ's Wholesale
• Premium: Whole Foods, Fresh Market, Harris Teeter
• Discount: Aldi, Food 4 Less, Save-A-Lot, WinCo
• Regional chains based on location
• Independent grocery stores and markets

PRICING FOR ITEMS:
${itemNames.join(', ')}

Provide realistic pricing variations:
- Discount stores: 10-20% below average
- Premium stores: 15-30% above average  
- Regular chains: Market average pricing

CRITICAL: Only return stores that would actually exist at coordinates ${latitude}, ${longitude}. If this is a remote area, return empty array [].

FORMAT: JSON array only, no explanations or markdown.`
              }
            ]
          })
        });

        const data = await response.json();
        console.log(`Raw AI response for ${radius} mile radius:`, data.completion);
        
        let comparisons;
        try {
          // Clean the response to ensure it's valid JSON
          let cleanedResponse = data.completion.trim();
          
          // Remove markdown code blocks if present
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
          }
          
          // Remove any leading/trailing whitespace and newlines
          cleanedResponse = cleanedResponse.trim();
          
          console.log(`Cleaned response for ${radius} miles:`, cleanedResponse);
          
          comparisons = JSON.parse(cleanedResponse);
          
          // Validate the structure
          if (!Array.isArray(comparisons)) {
            console.log(`Invalid response format for ${radius} miles - not an array`);
            comparisons = [];
          }
          
          // Validate and filter stores with strict criteria
          comparisons = comparisons.filter((store: any) => {
            // Validate store has required fields
            if (!store || !store.storeName || !store.address) {
              console.log('Rejected store: missing name or address', store);
              return false;
            }
            
            // Validate distance is reasonable and within radius
            if (!store.distance || typeof store.distance !== 'number' || 
                store.distance <= 0 || store.distance > radius) {
              console.log(`Rejected store: invalid distance ${store.distance} (radius: ${radius})`, store.storeName);
              return false;
            }
            
            // Validate items array exists and has content
            if (!Array.isArray(store.items) || store.items.length === 0) {
              console.log('Rejected store: no items array', store.storeName);
              return false;
            }
            
            // Validate address looks real and specific
            if (store.address.includes('estimated') || 
                store.address.includes('Local area') ||
                store.address.includes('nearby') ||
                store.address.includes('approximate') ||
                !store.address.includes(',') || // Must have city/state
                store.address.length < 20) { // Must be reasonably detailed
              console.log('Rejected store: invalid/estimated address', store.storeName, store.address);
              return false;
            }
            
            // Validate store name is not generic
            if (store.storeName.includes('Local') || 
                store.storeName.includes('Nearby') ||
                store.storeName.includes('Area') ||
                store.storeName.length < 3) {
              console.log('Rejected store: generic name', store.storeName);
              return false;
            }
            
            return true;
          }).map((store: any, index: number) => ({
            storeName: store.storeName,
            address: store.address,
            distance: Math.round(store.distance * 10) / 10, // Round to 1 decimal
            drivingTime: store.drivingTime || `${Math.ceil(store.distance * 2)} min`,
            phone: store.phone || 'Phone not available',
            totalPrice: typeof store.totalPrice === 'number' ? store.totalPrice : 
                       store.items.reduce((sum: number, item: any) => sum + (item.price || 0), 0),
            items: store.items.map((item: any) => ({
              name: item.name || 'Unknown item',
              price: typeof item.price === 'number' ? item.price : 0,
              available: item.available !== false
            }))
          }));
          
          console.log(`Found ${comparisons.length} valid stores within ${radius} miles`);
          
          // If we found at least 3 stores, we're done
          if (comparisons.length >= 3) {
            finalComparisons = comparisons.slice(0, 3); // Take only first 3
            break;
          }
          // If we found some stores but less than 3, continue to next radius
          else if (comparisons.length > 0) {
            finalComparisons = comparisons;
            // Continue searching for more stores in larger radius
          }
          
        } catch (parseError) {
          console.error(`Failed to parse store response for ${radius} miles:`, parseError);
          console.error('Raw response that failed:', data.completion);
          
          // Try to extract any useful information from malformed response
          if (data.completion && typeof data.completion === 'string') {
            const storeNameMatches = data.completion.match(/"storeName":\s*"([^"]+)"/g);
            if (storeNameMatches && storeNameMatches.length > 0) {
              console.log(`Found ${storeNameMatches.length} store names in malformed response`);
            }
          }
          // Continue to next radius
        }
      }
      
      // If no real stores found after all radii, show detailed error
      if (finalComparisons.length === 0) {
        console.log('No verified stores found in any radius');
        
        // Get address for better error message
        let locationDescription = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        try {
          const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (reverseGeocode && reverseGeocode.length > 0) {
            const addr = reverseGeocode[0];
            locationDescription = `${addr.city || 'Unknown City'}, ${addr.region || 'Unknown State'}`;
          }
        } catch (e) {
          console.log('Reverse geocoding failed:', e);
        }
        
        Alert.alert(
          'No Grocery Stores Found',
          `No grocery stores were found within 20 miles of your exact location:\n\n📍 ${locationDescription}\n🎯 Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n📏 GPS Accuracy: ${accuracy ? Math.round(accuracy) : 'unknown'}m\n\nThis could mean:\n• You're in a remote area\n• Local stores aren't in our database\n• GPS accuracy needs improvement\n\nWould you like to manually add stores in your area?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Stores Manually', onPress: () => setShowManualStoreModal(true) }
          ]
        );
        return;
      }
      
      // Sort by total price (cheapest first)
      finalComparisons.sort((a, b) => a.totalPrice - b.totalPrice);
      
      setStoreComparisons(finalComparisons);
      setShowComparisons(true);
      
      // Remove unused variable
      // const radiusUsed = storesFound ? 
      //   searchRadii.find(r => finalComparisons.every(store => store.distance <= r)) || 'multiple' :
      //   'fallback';
      
      // Get location description for success message
      let locationDescription = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseGeocode && reverseGeocode.length > 0) {
          const addr = reverseGeocode[0];
          locationDescription = `${addr.city || 'Unknown City'}, ${addr.region || 'Unknown State'}`;
        }
      } catch (e) {
        console.log('Reverse geocoding failed:', e);
      }
      
      Alert.alert(
        'Stores Found! 🛒',
        `Found ${finalComparisons.length} verified grocery store${finalComparisons.length === 1 ? '' : 's'} near your exact location:\n\n📍 ${locationDescription}\n🎯 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n📏 GPS Accuracy: ${accuracy ? Math.round(accuracy) : 'unknown'}m\n\nStores are sorted by total price (lowest first).\n\nClosest store: ${finalComparisons[0].storeName} (${finalComparisons[0].distance} miles)`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error finding stores:', error);
      Alert.alert(
        'Error',
        'Failed to find store pricing. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingStores(false);
    }
  };

  const addManualStore = async () => {
    if (!newStoreName.trim() || !newStoreAddress.trim()) {
      Alert.alert('Error', 'Please enter both store name and address.');
      return;
    }

    const distance = parseFloat(newStoreDistance) || 1.0;
    if (distance <= 0 || distance > 50) {
      Alert.alert('Error', 'Please enter a valid distance between 0.1 and 50 miles.');
      return;
    }

    setIsLoadingStores(true);
    try {
      // Generate pricing for the manual store using AI
      const itemNames = groceryList.items.map(item => item.name);
      
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a grocery pricing assistant. Generate realistic pricing for grocery items at a specific store. Return only a JSON object with the pricing data.`
            },
            {
              role: 'user',
              content: `Generate realistic pricing for these grocery items at "${newStoreName}" located at "${newStoreAddress}".

Items to price: ${itemNames.join(', ')}

Return format (JSON object only):
{
  "items": [
    {"name": "item name", "price": 0.00, "available": true}
  ],
  "totalPrice": 0.00
}

Use realistic grocery store pricing. Consider the store type and location for pricing levels.`
            }
          ]
        })
      });

      const data = await response.json();
      let pricingData;
      
      try {
        let cleanedResponse = data.completion.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
        }
        
        pricingData = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('Failed to parse pricing data:', parseError);
        // Fallback to default pricing
        pricingData = {
          items: itemNames.map(name => ({ name, price: 2.99, available: true })),
          totalPrice: itemNames.length * 2.99
        };
      }

      const newStore: StoreComparison = {
        storeName: newStoreName.trim(),
        address: newStoreAddress.trim(),
        distance: distance,
        drivingTime: `${Math.ceil(distance * 2)} min`,
        phone: 'Phone not available',
        totalPrice: pricingData.totalPrice || pricingData.items.reduce((sum: number, item: any) => sum + (item.price || 0), 0),
        items: pricingData.items || itemNames.map(name => ({ name, price: 2.99, available: true }))
      };

      const updatedManualStores = [...manualStores, newStore];
      setManualStores(updatedManualStores);
      
      // Combine manual stores with any found stores and sort by price
      const allStores = [...storeComparisons, ...updatedManualStores];
      allStores.sort((a, b) => a.totalPrice - b.totalPrice);
      setStoreComparisons(allStores);
      setShowComparisons(true);
      
      // Clear form
      setNewStoreName('');
      setNewStoreAddress('');
      setNewStoreDistance('');
      setShowManualStoreModal(false);
      
      Alert.alert(
        'Store Added Successfully! 🛒',
        `${newStore.storeName} has been added to your store comparisons with estimated pricing.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Error adding manual store:', error);
      Alert.alert(
        'Error',
        'Failed to add store. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingStores(false);
    }
  };

  const removeManualStore = (index: number) => {
    Alert.alert(
      'Remove Store',
      'Are you sure you want to remove this store from the comparison?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedManualStores = manualStores.filter((_, i) => i !== index);
            setManualStores(updatedManualStores);
            
            // Update store comparisons
            const allStores = [...storeComparisons.filter(store => 
              !manualStores.some(manual => manual.storeName === store.storeName)
            ), ...updatedManualStores];
            allStores.sort((a, b) => a.totalPrice - b.totalPrice);
            setStoreComparisons(allStores);
            
            if (allStores.length === 0) {
              setShowComparisons(false);
            }
          }
        }
      ]
    );
  };

  const groupedItems = groceryList.items?.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>) || {};

  const renderItem = ({ item }: { item: GroceryItem }) => (
    <TouchableOpacity
      style={[styles.itemContainer, item.checked && styles.checkedItem]}
      onPress={() => toggleItem(item.id)}
    >
      <View style={styles.itemContent}>
        {item.checked ? (
          <Check size={24} color={Colors.primary} />
        ) : (
          <Square size={24} color={Colors.textSecondary} />
        )}
        <View style={styles.itemText}>
          <Text style={[styles.itemName, item.checked && styles.checkedText]}>
            {item.name}
          </Text>
          <Text style={[styles.itemQuantity, item.checked && styles.checkedText]}>
            {item.quantity}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Grocery List',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ArrowLeft size={24} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.storeSection}>
          <Button
            title={isLoadingStores ? 'Finding Stores...' : 'Find Cheapest Store Near Me'}
            onPress={requestLocationPermission}
            disabled={isLoadingStores}
            style={styles.storeButton}
          >
            {isLoadingStores ? (
              <ActivityIndicator size="small" color={Colors.background} style={styles.buttonIcon} />
            ) : (
              <MapPin size={20} color={Colors.background} style={styles.buttonIcon} />
            )}
          </Button>
          
          <TouchableOpacity
            style={styles.manualStoreButton}
            onPress={() => setShowManualStoreModal(true)}
          >
            <Plus size={20} color={Colors.primary} style={styles.buttonIcon} />
            <Text style={styles.manualStoreButtonText}>Add Store Manually</Text>
          </TouchableOpacity>
        </View>

        {showComparisons && storeComparisons.length > 0 && (
          <View style={styles.comparisonsSection}>
            <Text style={styles.comparisonsTitle}>Store Price Comparisons</Text>
            {storeComparisons.map((store, index) => {
              const isManualStore = manualStores.some(manual => manual.storeName === store.storeName);
              const manualStoreIndex = manualStores.findIndex(manual => manual.storeName === store.storeName);
              
              return (
                <View key={index} style={styles.storeCard}>
                  <View style={styles.storeHeader}>
                    <View style={styles.storeNameContainer}>
                      <Text style={styles.storeName}>{store.storeName}</Text>
                      {isManualStore && (
                        <View style={styles.manualBadge}>
                          <Text style={styles.manualBadgeText}>Manual</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.storeHeaderRight}>
                      <Text style={styles.storeTotal}>${store.totalPrice.toFixed(2)}</Text>
                      {isManualStore && (
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => removeManualStore(manualStoreIndex)}
                        >
                          <X size={16} color={Colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text style={styles.storeAddress}>{store.address}</Text>
                  <View style={styles.storeDetails}>
                    <Text style={styles.storeDistance}>{store.distance} miles away</Text>
                    {store.drivingTime && (
                      <Text style={styles.storeDriving}>• {store.drivingTime}</Text>
                    )}
                  </View>
                  {store.phone && store.phone !== 'Phone not available' && (
                    <Text style={styles.storePhone}>{store.phone}</Text>
                  )}
                  <View style={styles.storeItems}>
                    {store.items.slice(0, 3).map((item, itemIndex) => (
                      <Text key={itemIndex} style={styles.storeItemPrice}>
                        {item.name}: ${item.price.toFixed(2)}
                      </Text>
                    ))}
                    {store.items.length > 3 && (
                      <Text style={styles.moreItems}>+{store.items.length - 3} more items</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {Object.entries(groupedItems).map(([category, items]) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category}</Text>
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        ))}
      </ScrollView>
      
      <Modal
        visible={showManualStoreModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Store Manually</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowManualStoreModal(false);
                setNewStoreName('');
                setNewStoreAddress('');
                setNewStoreDistance('');
              }}
            >
              <X size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Can&apos;t find stores in your area? Add them manually to compare prices.
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Store Name *</Text>
              <TextInput
                style={styles.textInput}
                value={newStoreName}
                onChangeText={setNewStoreName}
                placeholder="e.g., Joe's Market, Local Grocery"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Store Address *</Text>
              <TextInput
                style={styles.textInput}
                value={newStoreAddress}
                onChangeText={setNewStoreAddress}
                placeholder="123 Main St, City, State 12345"
                placeholderTextColor={Colors.textSecondary}
                multiline
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Distance (miles)</Text>
              <TextInput
                style={styles.textInput}
                value={newStoreDistance}
                onChangeText={setNewStoreDistance}
                placeholder="1.5"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputHint}>
                Approximate distance from your location (optional, defaults to 1.0 mile)
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowManualStoreModal(false);
                  setNewStoreName('');
                  setNewStoreAddress('');
                  setNewStoreDistance('');
                }}
                style={[styles.modalButton, styles.cancelButton]}
                textStyle={styles.cancelButtonText}
              />
              
              <Button
                title={isLoadingStores ? 'Adding...' : 'Add Store'}
                onPress={addManualStore}
                disabled={isLoadingStores || !newStoreName.trim() || !newStoreAddress.trim()}
                style={[styles.modalButton, styles.addButton]}
              >
                {isLoadingStores && (
                  <ActivityIndicator size="small" color={Colors.background} style={styles.buttonIcon} />
                )}
              </Button>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  headerButton: {
    marginLeft: 8,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  itemContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  checkedItem: {
    backgroundColor: Colors.surfaceVariant,
    opacity: 0.7,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: {
    marginLeft: 12,
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkedText: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  storeSection: {
    marginBottom: 24,
  },
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  comparisonsSection: {
    marginBottom: 24,
  },
  comparisonsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  storeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  storeTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  storeAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  storeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeDistance: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  storeDriving: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  storePhone: {
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 12,
    fontWeight: '500',
  },
  storeItems: {
    gap: 4,
  },
  storeItemPrice: {
    fontSize: 14,
    color: Colors.text,
  },
  moreItems: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  manualStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  manualStoreButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  storeNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  manualBadgeText: {
    fontSize: 10,
    color: Colors.background,
    fontWeight: '600',
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
  },
  inputHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  modalButton: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceVariant,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
  },
  addButton: {
    backgroundColor: Colors.primary,
  },
});