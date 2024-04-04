import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
L.Icon.Default.imagePath='leaflet_images/';

const path = process.env.PUBLIC_URL;
const markerPath = `${path}/leaflet_images/marker-icon.png`
const markerPathGrey = `${path}/leaflet_images/marker-icon-gray.png`

const userLocationIcon = L.icon({
  iconUrl: `${path}/leaflet_images/marker-icon-user.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
const coloredIcon  = (fieldName) => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="text-align: center;"><b>${fieldName}</b></div><img src=${markerPath} style="width: 25px; height: 41px;"/>`,
    iconSize: [25, 41],
    iconAnchor: [12, 56], // Adjust based on the actual size of your icon + text height
    popupAnchor: [0, -56], // Adjust based on iconAnchor to align popup correctly
  });
};
const greyIcon = (fieldName) => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="text-align: center;"><b>${fieldName}</b></div><img src=${markerPathGrey} style="width: 25px; height: 41px;"/>`,
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
  const [isTextBoxVisible, setIsTextBoxVisible] = useState(false);
  const textBoxRef = useRef(null);
  const mapRef = useRef(null);

  const [filter, setFilter] = useState({
    courtesy_car: false,
    bicycles: false,
    camping: false,
    meals: false,
  });
  
  const handleOpenModal = (ident) => {
    setCurrentImageUrl(`${path}/images/${ident}.png`);
    setIsModalOpen(true);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (textBoxRef.current && !textBoxRef.current.contains(event.target)) {
        setIsTextBoxVisible(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetch(`${path}/data.json`)
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
      .catch(error => console.error("Failed to load data:", error));
  }, []);

  const handleSliderChange = (event) => {
    const newValue = Number(event.target.value);
    setLocalRadius(newValue); // This updates the local state with the new slider value
  };  
  
  const commitRadiusChange = () => {
    setRadius(localRadius); // Commit the local state to the global state
  };
  
  function determineIcon(item) {
    const isInteresting = item.courtesy_car || item.bicycles || item.camping || item.meals;
    return isInteresting ? coloredIcon(item.name) : greyIcon(item.name);
  }

  const getUserLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        mapRef.current.flyTo([latitude, longitude],8);
      },
      () => {
        console.log("Unable to retrieve your location");
      }
    );
  };

  const handleSetLocationFromIdentifier = () => {
    // Assuming `items` is your state holding the array of locations from data.json
    const foundLocation = items.find(item => item.id === locationIdentifier);
    if (foundLocation) {
      setUserLocation([foundLocation.latitude, foundLocation.longitude]);
      mapRef.current.flyTo([foundLocation.latitude, foundLocation.longitude],8);
    } else {
      alert('Location identifier not found.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px' }}>
        <div style={{ flexGrow: 1 }}>
          <label>
            Radius (miles): {localRadius}
            <input 
              type="range"
              value={localRadius}
              onChange={handleSliderChange}
              onMouseUp={commitRadiusChange}
              onTouchEnd={commitRadiusChange} //for mobile
              onBlur={commitRadiusChange} 
              min="0" 
              max="500" 
              step="10"
              style={{ marginLeft: '10px', width: '100%' }}
            />
          </label>
        </div>
        
        <div style={{ flexGrow: 2, textAlign: 'right'}}> 
          <b>Airstrip Map</b>
        </div>

        <div style={{ flexGrow: 2, textAlign: 'right', fontSize: 'small' , paddingLeft: '5px'}}>
          A better $100 hamburger finder. Data may be inaccurate and outdated. Proceed at your own risk.
        </div>
        
      </div>

      <div style={{ position: 'absolute', top: 70, left: 65, zIndex: 1000, backgroundColor: 'white', padding: '10px', borderRadius: '5px' }}>
        <b>Airport Identifier</b> <br/>
        <input
          type="text"
          placeholder="Location Identifier"
          value={locationIdentifier}
          onChange={(e) => setLocationIdentifier(e.target.value.toUpperCase())} // Assuming identifiers are uppercase
        />
        <button onClick={handleSetLocationFromIdentifier}>
        🔎
        </button>
        
        <br/><br/>
        <b>Filter Options</b>
        <br/>
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
    <div>
      <button 
        onClick={getUserLocation} 
        style={{
          position: 'absolute',
          bottom: '100px',
          right: '30px',
          zIndex: 1000,
          fontSize: '24px',
          cursor: 'pointer'
        }}
      >
        ⌖
      </button>
    </div>
    
    <div style={{ position: 'absolute', top: '70px', right: '24px', zIndex: 1000, fontSize: '24px', }}>
      <button onClick={() => setIsTextBoxVisible(!isTextBoxVisible)}>
        ℹ
      </button>
      {isTextBoxVisible && (
        <div ref={textBoxRef} style={{ fontSize: '18px', marginTop: '10px', border: '1px solid #ccc', padding: '10px', backgroundColor: 'white', maxWidth: '400px' }}>
          This site features public airport destinations using data from state airport directories, including directory images. The quality of data depends on what's published in these directories. The goal is to make it easier to find interesting places to fly to and explore.
        </div>
      )}
    </div>

      <MapContainer 
        style={{ height: '100vh', width: '100vw' }}
        center={userLocation || [48.192, -114.316]}
        zoom={8} 
        ref={mapRef}
      >
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
          <Marker 
            icon={determineIcon(filteredItem)} 
            key={filteredItem.id} 
            position={[filteredItem.latitude, filteredItem.longitude]}
          >
            <Popup>
              <div style={{ fontSize: '16px', marginBottom: '5px' }}>
                <strong>{filteredItem.name}</strong> ({filteredItem.id})
              </div>
              <div style={{ fontSize: '14px' }}>
                <strong>Elevation:</strong> {filteredItem.elevation} ft
              </div>
              {filteredItem.courtesy_car && (
                <div style={{ fontSize: '14px' }}><strong>Courtesy Car:</strong> Yes</div>
              )}
              {filteredItem.bicycles && (
                <div style={{ fontSize: '14px' }}><strong>Bicycles:</strong> Available</div>
              )}
              {filteredItem.camping && (
                <div style={{ fontSize: '14px' }}><strong>Camping:</strong> Yes</div>
              )}
              {filteredItem.meals && (
                <div style={{ fontSize: '14px' }}><strong>Meals:</strong> Nearby</div>
              )}
              <div style={{ fontSize: '14px' }}>
                <a href="#" onClick={() => handleOpenModal(filteredItem.id)}>View Directory Image</a>
              </div>
              <div style={{ fontSize: '14px' }}>
                <a target="_blank" rel="noopener noreferrer" href={`https://www.airnav.com/airport/${filteredItem.id}`}>AirNav</a> | 
                <a target="_blank" rel="noopener noreferrer" href={`https://www.skyvector.com/airport/${filteredItem.id}`}>SkyVector</a>
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
