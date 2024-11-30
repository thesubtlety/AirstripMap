import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import L from 'leaflet';
import Fuse from 'fuse.js';
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
const createColoredIcon = (fieldName, size) => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="text-align: center; font-size:${size.fontSize}px"><b>${fieldName}</b></div><img src=${markerPath} style="width: ${size.width}px; height: ${size.height}px;"/>`,
    iconSize: [size.width, size.height],
    iconAnchor: [size.width / 2, size.height],
    popupAnchor: [0, -size.height],
  });
};

const createGreyIcon = (fieldName, size) => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="text-align: center; font-size:${size.fontSize}px"><b>${fieldName}</b></div><img src=${markerPathGrey} style="width: ${size.width}px; height: ${size.height}px;"/>`,
    iconSize: [size.width, size.height],
    iconAnchor: [size.width / 2, size.height],
    popupAnchor: [0, -size.height],
  });
};

const getIconSize = (zoomLevel) => {
  if (zoomLevel > 10) {
    return { width: 25, height: 40, fontSize: 14 };
  } else if (zoomLevel > 7) {
    return { width: 20, height: 35, fontSize: 12 };
  } else if (zoomLevel > 6) {
    return { width: 15, height: 25, fontSize: 10 };
  } else {
    return { width: 13, height: 20, fontSize: 8 };
  }
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
  const markersRef = useRef([]);

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
    return isInteresting ? createColoredIcon(item.name, getIconSize(mapRef.current.getZoom())) : createGreyIcon(item.name, getIconSize(mapRef.current.getZoom()));
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
    const fuse = new Fuse(items, {
        keys: ['id', 'name'],      // Specify fields to search by
        threshold: 0.3,            // Adjust this to control match sensitivity (0 = exact match, 1 = match anything)
    });

    const results = fuse.search(locationIdentifier);
    
    if (results.length > 0) {
        const foundLocation = results[0].item; // Get the first matching result
        setUserLocation([foundLocation.latitude, foundLocation.longitude]);
        mapRef.current.flyTo([foundLocation.latitude, foundLocation.longitude], 8);
    } else {
        alert('Location identifier not found.');
    }
};

  useEffect(() => {
    const map = mapRef.current;

    const adjustIconSize = (zoomLevel) => {
      const newSize = getIconSize(zoomLevel);
      markersRef.current.forEach(marker => {
        if (marker) { // Ensure marker is not null
          const fieldName = marker.options.fieldName;
          if (marker.options.type === 'colored') {
            marker.setIcon(createColoredIcon(fieldName, newSize));
          } else if (marker.options.type === 'grey') {
            marker.setIcon(createGreyIcon(fieldName, newSize));
          }
        }
      });
    };

    if (map) {
      map.on('zoomend', () => {
        const zoomLevel = map.getZoom();
        console.log('zoom level: ' + zoomLevel);
        adjustIconSize(zoomLevel);
      });

      adjustIconSize(map.getZoom());
    }
  }, []);

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
          A worse $100 hamburger finder with state airport directory info and pdf images. Data may be inaccurate and outdated. Proceed at your own risk.
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
        <button onClick={handleSetLocationFromIdentifier}
          className="search-button">
        🔎
        </button>

        <br/><br/>
        <div>
          <b className="filter-title">Filter Options</b>
        {['courtesy_car', 'bicycles', 'camping', 'meals'].map((option) => (
          <div key={option} className="filter-option">
            <input
              type="checkbox"
              id={option}
              checked={filter[option]}
              onChange={(e) => setFilter({ ...filter, [option]: e.target.checked })}
              className="filter-checkbox"
            />
            <label htmlFor={option} className="filter-label">
              {option.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
            </label>
          </div>
        ))}
      </div>

    </div>
    <div>
      <button 
        onClick={getUserLocation} 
        className='location-button'
      >
        ⌖
      </button>
    </div>
    
    <div style={{ position: 'absolute', top: '70px', right: '24px', zIndex: 1000, fontSize: '24px', }}>
      <button onClick={() => setIsTextBoxVisible(!isTextBoxVisible)}
      className="icon-button"
        >
        ℹ
      </button>
      {isTextBoxVisible && (
        <div ref={textBoxRef} style={{ fontSize: '18px', marginTop: '10px', border: '1px solid #ccc', padding: '10px', backgroundColor: 'white', maxWidth: '400px', padding: '20px', borderRadius: '10px',  }}>
          This site features public airport destinations using data from state airport directories, including directory images.
          <br/><br/>The quality of data depends on what's published in these directories. 
          <br/><br/>Some states don't publish these and those airports won't be identified here.
          <br/><br/>Check out other great resources like pirep.io and skyvector.com.
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
            ref={(marker) => { if (marker) markersRef.current.push(marker); }}
            options={{ fieldName: filteredItem.name, type: filteredItem.courtesy_car || filteredItem.bicycles || filteredItem.camping || filteredItem.meals ? 'colored' : 'grey' }}
           >
            <Popup>
              <div style={{ fontSize: '16px', marginBottom: '5px' }}>
                <strong>{filteredItem.name}</strong> ({filteredItem.id})
              </div>
              <div style={{ fontSize: '14px' }}>
                {filteredItem.elevation}' MSL
              </div>

              <div style={{ marginBottom: '10px', textAlign: 'center' }}>
              {filteredItem.id ? (
                <img 
                  src={`${path}/images/${filteredItem.id}.png`}
                  alt={`${filteredItem.name} Preview`} 
                  style={{
                    maxWidth: '100%', 
                    height: 'auto', 
                    maxHeight: '100px', 
                    borderRadius: '5px', 
                    border: '1px solid #ccc'
                  }} 
                  onClick={() => handleOpenModal(filteredItem.id)}
                />
              ) : (
                <span style={{ fontSize: '12px', color: '#999' }}>No image available</span>
              )}
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
              <br/>
              <div style={{ fontSize: '14px' }}>
                <a target="_blank" rel="noopener noreferrer" href={`https://www.airnav.com/airport/${filteredItem.id}`}>AirNav</a> &nbsp;&nbsp;|&nbsp;&nbsp;
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
