#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the data.json file
const dataPath = path.join(__dirname, 'public', 'data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log(`Total entries: ${data.items.length}`);

// Find duplicates
const seen = new Map();
const duplicates = [];

data.items.forEach((item, index) => {
  if (seen.has(item.id)) {
    duplicates.push({
      id: item.id,
      firstIndex: seen.get(item.id),
      duplicateIndex: index,
      firstItem: data.items[seen.get(item.id)],
      duplicateItem: item
    });
  } else {
    seen.set(item.id, index);
  }
});

console.log(`\nFound ${duplicates.length} duplicates:`);

duplicates.forEach(dup => {
  console.log(`\n--- Duplicate ID: "${dup.id}" ---`);
  console.log('First occurrence:', {
    name: dup.firstItem.name,
    lat: dup.firstItem.latitude,
    lon: dup.firstItem.longitude,
    elevation: dup.firstItem.elevation
  });
  console.log('Duplicate occurrence:', {
    name: dup.duplicateItem.name,
    lat: dup.duplicateItem.latitude,
    lon: dup.duplicateItem.longitude,
    elevation: dup.duplicateItem.elevation
  });
  
  // Check if they're actually the same airport (same coordinates)
  const latDiff = Math.abs(dup.firstItem.latitude - dup.duplicateItem.latitude);
  const lonDiff = Math.abs(dup.firstItem.longitude - dup.duplicateItem.longitude);
  const isSameLocation = latDiff < 0.001 && lonDiff < 0.001;
  
  console.log(`Same location: ${isSameLocation ? 'YES' : 'NO'}`);
});

// Strategy: Remove exact duplicates, modify IDs for different airports with same ID
const cleanedItems = [];
const processedIds = new Set();

data.items.forEach((item, index) => {
  if (!processedIds.has(item.id)) {
    // First occurrence of this ID
    cleanedItems.push(item);
    processedIds.add(item.id);
  } else {
    // Duplicate ID found
    const existingItemIndex = cleanedItems.findIndex(existing => existing.id === item.id);
    const existingItem = cleanedItems[existingItemIndex];
    
    // Check if it's the same airport (same coordinates)
    const latDiff = Math.abs(existingItem.latitude - item.latitude);
    const lonDiff = Math.abs(existingItem.longitude - item.longitude);
    const isSameLocation = latDiff < 0.001 && lonDiff < 0.001;
    
    if (isSameLocation) {
      // Same airport - merge data (keep the one with more amenities)
      const existingAmenities = [existingItem.courtesy_car, existingItem.bicycles, existingItem.camping, existingItem.meals].filter(Boolean).length;
      const newAmenities = [item.courtesy_car, item.bicycles, item.camping, item.meals].filter(Boolean).length;
      
      if (newAmenities > existingAmenities) {
        // Replace with the one that has more amenities
        cleanedItems[existingItemIndex] = item;
        console.log(`Merged duplicate ${item.id}: kept version with more amenities`);
      } else {
        console.log(`Merged duplicate ${item.id}: kept existing version`);
      }
    } else {
      // Different airports with same ID - modify the duplicate's ID
      let newId = item.id;
      let suffix = 1;
      while (processedIds.has(newId)) {
        newId = `${item.id}_${suffix}`;
        suffix++;
      }
      
      const modifiedItem = { ...item, id: newId };
      cleanedItems.push(modifiedItem);
      processedIds.add(newId);
      console.log(`Different airport with same ID: renamed ${item.id} -> ${newId} (${item.name})`);
    }
  }
});

// Create the cleaned data
const cleanedData = {
  items: cleanedItems
};

console.log(`\nCleaned data: ${cleanedData.items.length} entries (removed ${data.items.length - cleanedData.items.length} duplicates)`);

// Backup original file
const backupPath = path.join(__dirname, 'public', 'data.json.backup');
fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
console.log(`\nBackup created: ${backupPath}`);

// Write cleaned data
fs.writeFileSync(dataPath, JSON.stringify(cleanedData, null, 2));
console.log(`Cleaned data written to: ${dataPath}`);

// Verify no duplicates remain
const finalIds = cleanedData.items.map(item => item.id);
const uniqueFinalIds = new Set(finalIds);
console.log(`\nVerification: ${finalIds.length} total items, ${uniqueFinalIds.size} unique IDs`);

if (finalIds.length === uniqueFinalIds.size) {
  console.log('✅ Success: No duplicates remain!');
} else {
  console.log('❌ Error: Duplicates still exist!');
}