// Script to convert airports_us.csv to optimized JSON format
// Run with: node convert_airports.js

const fs = require('fs');
const readline = require('readline');

const inputFile = './airports_us.csv';
const outputFile = './public/airports_all.json';

const airports = [];

// CSV columns (from the sample):
// 0: id_number, 1: ident, 2: type, 3: name, 4: latitude_deg, 5: longitude_deg, 6: elevation_ft, ...

const fileStream = fs.createReadStream(inputFile);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let lineCount = 0;

rl.on('line', (line) => {
  lineCount++;

  // Skip if line is empty
  if (!line.trim()) return;

  // Parse CSV line (simple parsing - assuming no commas in quoted fields for this data)
  const parts = line.split(',').map(part => part.replace(/^"|"$/g, '').trim());

  const type = parts[2];
  const name = parts[3];
  const lat = parseFloat(parts[4]);
  const lon = parseFloat(parts[5]);
  const ident = parts[1];

  // Skip invalid entries
  if (!ident || !name || isNaN(lat) || isNaN(lon)) return;

  // Filter out non-airport types (balloonports, closed, etc)
  const validTypes = ['small_airport', 'medium_airport', 'large_airport', 'seaplane_base'];
  if (!validTypes.includes(type)) return;

  // Add to array with minimal data
  airports.push({
    id: ident,
    name: name,
    lat: lat,
    lon: lon,
    type: type
  });
});

rl.on('close', () => {
  console.log(`Processed ${lineCount} lines`);
  console.log(`Kept ${airports.length} valid airports`);

  // Write to JSON file
  fs.writeFileSync(outputFile, JSON.stringify(airports, null, 0));

  const stats = fs.statSync(outputFile);
  console.log(`Output file: ${outputFile}`);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('Done!');
});
