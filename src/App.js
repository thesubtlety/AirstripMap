import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
L.Icon.Default.imagePath='leaflet_images/';

const userLocationIcon = L.icon({
  iconUrl: '/leaflet_images/marker-icon-user.png', // Adjust path to your icon
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const createCustomIcon = (fieldName) => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="text-align: center;"><b>${fieldName}</b></div><img src="/leaflet_images/marker-icon.png" style="width: 25px; height: 41px;"/>`,
    iconSize: [25, 41],
    iconAnchor: [12, 56], // Adjust based on the actual size of your icon + text height
    popupAnchor: [0, -56], // Adjust based on iconAnchor to align popup correctly
  });
};

function ImageModal({ isOpen, onClose, imageUrl }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000, // Ensure it's above other content
    }} onClick={onClose}>
      <img src={imageUrl} alt="Modal" style={{ maxWidth: '90%', maxHeight: '90%' }} />
    </div>
  );
}

function FullPageMap() {
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius] = useState(100); // This is the "committed" state
  const [localRadius, setLocalRadius] = useState(100); // Initial value
  const [items, setItems] = useState([]); 
  const [locationIdentifier, setLocationIdentifier] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');


  const [filter, setFilter] = useState({
    courtesy_car: false,
    bicycles: false,
    camping: false,
    meals: false,
  });
  
  const handleOpenModal = (ident) => {
    setCurrentImageUrl('images/' + ident + '.png');
    setIsModalOpen(true);
  };

  useEffect(() => {
    fetch('/data.json')
      .then(response => response.json())
      .then(data => {
        // Access the 'items' array inside the fetched data
        const itemsData = data.items;
  
        // Optionally, you can log the items to verify their structure
       //console.log("Fetched items:", itemsData);
  
        // Now, process and set the items to state as before
        const parsedItems = itemsData.map(item => ({
          ...item,
          latitude: parseFloat(item.latitude),
          longitude: parseFloat(item.longitude),
        })).filter(item => !isNaN(item.latitude) && !isNaN(item.longitude));
  
        setItems(parsedItems);
      })
      .catch(error => console.error("Failed to load data.json:", error));
  }, []);
  

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
      },
      () => {
        console.log("Unable to retrieve your location");
      }
    );
  }, []);

  // // Distance calculation function
  // function getDistanceFromLatLonInMiles(lat1, lon1, lat2, lon2) {
  //   var R = 3958.8; // Radius of the earth in miles
  //   var dLat = deg2rad(lat2 - lat1);
  //   var dLon = deg2rad(lon2 - lon1);
  //   var a =
  //     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
  //     Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
  //     Math.sin(dLon / 2) * Math.sin(dLon / 2);
  //   var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  //   var distance = R * c; // Distance in miles
  //   return distance;
  // }

  // function deg2rad(deg) {
  //   return deg * (Math.PI / 180);
  // }

  const handleSetLocationFromIdentifier = () => {
    // Assuming `items` is your state holding the array of locations from data.json
    const foundLocation = items.find(item => item.id === locationIdentifier);
    if (foundLocation) {
      setUserLocation([foundLocation.latitude, foundLocation.longitude]);
    } else {
      alert('Location identifier not found.');
    }
  };

  const handleSliderChange = (event) => {
    const newValue = Number(event.target.value);
    setLocalRadius(newValue); // This updates the local state with the new slider value
  };  
  
  const commitRadiusChange = () => {
    setRadius(localRadius); // Commit the local state to the global state
  };
  

  return (
    <div>
      <div style={{ padding: '10px' }}>
        <label>
          Radius (miles): {localRadius}
          <input 
            type="range"
            value={localRadius}
            onChange={handleSliderChange}
            onMouseUp={commitRadiusChange}
            onBlur={commitRadiusChange} 
            min="0" 
            max="500" 
            step="10"
            style={{ marginLeft: '10px' }} 
          />
        </label>
      </div>

      <div style={{ position: 'absolute', top: 150, left: 10, zIndex: 1000, backgroundColor: 'white', padding: '10px', borderRadius: '5px' }}>
      
      <h4>Enter Airport Identifier</h4>
      <input
        type="text"
        placeholder="Location Identifier"
        value={locationIdentifier}
        onChange={(e) => setLocationIdentifier(e.target.value.toUpperCase())} // Assuming identifiers are uppercase
      />
      <button onClick={handleSetLocationFromIdentifier}>
        Enter
      </button>
      
      <h4>Filter Options</h4>
      <div>
        <input
          type="checkbox"
          id="courtesy_car"
          checked={filter.courtesy_car}
          onChange={e => setFilter({ ...filter, courtesy_car: e.target.checked })}
        />
        <label htmlFor="courtesy_car">Courtesy Car</label>
      </div>
      <div>
        <input
          type="checkbox"
          id="bicycles"
          checked={filter.bicycles}
          onChange={e => setFilter({ ...filter, bicycles: e.target.checked })}
        />
        <label htmlFor="bicycles">Bicycles</label>
      </div>
      <div>
        <input
          type="checkbox"
          id="camping"
          checked={filter.camping}
          onChange={e => setFilter({ ...filter, camping: e.target.checked })}
        />
        <label htmlFor="camping">Camping</label>
      </div>
      <div>
        <input
          type="checkbox"
          id="meals"
          checked={filter.meals}
          onChange={e => setFilter({ ...filter, meals: e.target.checked })}
        />
        <label htmlFor="meals">Meals</label>
      </div>
    </div>


      <MapContainer style={{ height: '100vh', width: '100vw' }} center={userLocation || [48.192, -114.316]} zoom={8}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {userLocation && (
          <>
            <Marker position={userLocation} icon={userLocationIcon}>
              <Popup>Your location</Popup>
            </Marker>
            <Circle center={userLocation} radius={radius * 1609.34} /> {/* Convert miles to meters */}
          </>
        )}
        {items.length > 0 && items.filter(item => 
            (filter.courtesy_car ? item.courtesy_car : true) &&
            (filter.bicycles ? item.bicycles : true) &&
            (filter.camping ? item.camping : true) &&
            (filter.meals ? item.meals : true)
        ).map(filteredItem => (
          <Marker icon={createCustomIcon(filteredItem.name)} key={filteredItem.id} position={[filteredItem.latitude, filteredItem.longitude]}>
            <Popup>
              <div style={{ fontSize: '16px', marginBottom: '5px' }}>
                <strong>{filteredItem.name}</strong> (ID: {filteredItem.id})
              </div>
              <div style={{ fontSize: '14px' }}>
                <strong>Elevation:</strong> {filteredItem.elevation} ft
              </div>
              <div style={{ fontSize: '14px' }}>
                <strong>Courtesy Car:</strong> {filteredItem.courtesy_car ? 'Yes' : 'No'}
              </div>
              <div style={{ fontSize: '14px' }}>
                <strong>Bicycles:</strong> {filteredItem.bicycles ? 'Available' : 'Not Available'}
              </div>
              <div style={{ fontSize: '14px' }}>
                <strong>Camping:</strong> {filteredItem.camping ? 'Yes' : 'No'}
              </div>
              <div style={{ fontSize: '14px' }}>
                <strong>Meals:</strong> {filteredItem.meals ? 'Nearby' : 'No'}
              </div>
              <div style={{ fontSize: '14px' }}>
                <a href="#" onClick={() => handleOpenModal(filteredItem.id)}>View Image</a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <ImageModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} imageUrl={currentImageUrl} />
    </div>
  );
}

export default FullPageMap;
