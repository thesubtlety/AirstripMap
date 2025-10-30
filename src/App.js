import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import L from 'leaflet';
import Fuse from 'fuse.js';
import MarkerClusterGroup from 'react-leaflet-markercluster'
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

const baseAirportIcon = L.divIcon({
  className: 'base-airport-marker',
  html: '<div class="base-airport-dot"></div>',
  iconSize: [6, 6],
  iconAnchor: [3, 3],
});
const createColoredIcon = (fieldName, size) => {
  // Calculate approximate text height based on font size (1.2em line height is typical)
  const textHeight = Math.ceil(size.fontSize * 1.3);
  const totalHeight = textHeight + size.height;

  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="text-align: center; font-size:${size.fontSize}px; line-height: ${size.fontSize}px; margin-bottom: 2px;"><b>${fieldName}</b></div><img src=${markerPath} style="width: ${size.width}px; height: ${size.height}px;"/>`,
    iconSize: [size.width, totalHeight],
    iconAnchor: [size.width / 2, totalHeight],
    popupAnchor: [0, -totalHeight],
  });
};

const createGreyIcon = (fieldName, size) => {
  // Calculate approximate text height based on font size (1.2em line height is typical)
  const textHeight = Math.ceil(size.fontSize * 1.3);
  const totalHeight = textHeight + size.height;

  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="text-align: center; font-size:${size.fontSize}px; line-height: ${size.fontSize}px; margin-bottom: 2px;"><b>${fieldName}</b></div><img src=${markerPathGrey} style="width: ${size.width}px; height: ${size.height}px;"/>`,
    iconSize: [size.width, totalHeight],
    iconAnchor: [size.width / 2, totalHeight],
    popupAnchor: [0, -totalHeight],
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
      zIndex: 1000,
    }} onClick={onClose}>
      <img src={imageUrl} alt="Modal" style={{ maxWidth: '90%', maxHeight: '90%' }} />
    </div>
  );
}

function InfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        <h2 className="modal-title">About Airstrip Map</h2>

        <div className="modal-body">
          <p>
            Find airports with camping, courtesy cars, bicycles, and nearby meals. View local airport directory images and FAA diagrams sourced from published state airport directories.
          </p>
          <p>
            Data availability depends on what states publish. Some states don't publish directories but you can still see airport locations by enabling "Show All US Airports" in the filter options.
          </p>
          <p>
            Check out other great resources like <a href="https://pirep.io" target="_blank" rel="noopener noreferrer">pirep.io</a> and <a href="https://skyvector.com" target="_blank" rel="noopener noreferrer">skyvector.com</a>.
          </p>

          <div className="modal-links">
            <a
              href="https://buymeacoffee.com/noahpotti"
              target="_blank"
              rel="noopener noreferrer"
              className="modal-link modal-link-primary"
            >
              <span>☕</span> Buy Me a Coffee
            </a>

            <a
              href="https://github.com/thesubtlety/airstripmap"
              target="_blank"
              rel="noopener noreferrer"
              className="modal-link"
            >
              <span>⭐</span> View on GitHub
            </a>
          </div>
        </div>
      </div>
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
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showAllAirports, setShowAllAirports] = useState(false);
  const [allAirports, setAllAirports] = useState([]);
  const [zoomLevel, setZoomLevel] = useState(5);
  const [airportDiagrams, setAirportDiagrams] = useState({});
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const searchDropdownRef = useRef(null);

  const [filter, setFilter] = useState({
    courtesy_car: false,
    bicycles: false,
    camping: false,
    meals: false,
  });

  const [collapsedSections, setCollapsedSections] = useState({
    radius: true,
  });

  // Set initial state based on screen size - expanded on desktop, collapsed on mobile
  const [controlPanelCollapsed, setControlPanelCollapsed] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : true;
  });

  const toggleControlPanel = () => {
    setControlPanelCollapsed(!controlPanelCollapsed);
  };

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  const handleOpenModal = (ident) => {
    setCurrentImageUrl(`${path}/images/${ident}.png`);
    setIsModalOpen(true);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
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
        const itemsData = data.items;
        const parsedItems = itemsData.map(item => ({
          ...item,
          latitude: parseFloat(item.latitude),
          longitude: parseFloat(item.longitude),
        })).filter(item => !isNaN(item.latitude) && !isNaN(item.longitude));

        setItems(parsedItems);
      })
      .catch(error => console.error("Failed to load data:", error));
  }, []);

  // Load airport diagram lookup
  useEffect(() => {
    fetch(`${path}/airport_diagram_lookup.json`)
      .then(response => response.json())
      .then(data => {
        setAirportDiagrams(data);
      })
      .catch(error => console.error("Failed to load airport diagrams:", error));
  }, []);

  // Load all airports when toggle is enabled
  useEffect(() => {
    if (showAllAirports && allAirports.length === 0) {
      fetch(`${path}/airports_all.json`)
        .then(response => response.json())
        .then(data => {
          // Create Set of IDs from data.json to deduplicate
          const priorityIds = new Set(items.map(item => item.id));

          // Filter out airports that exist in data.json
          const dedupedAirports = data
            .filter(airport => !priorityIds.has(airport.id))
            .map(airport => ({
              id: airport.id,
              name: airport.name,
              latitude: airport.lat,
              longitude: airport.lon,
              type: airport.type,
            }));

          setAllAirports(dedupedAirports);
        })
        .catch(error => console.error("Failed to load all airports:", error));
    }
  }, [showAllAirports, items, allAirports.length]);

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

  const getAirportDiagramUrl = (airportId) => {
    // Remove leading "K" only if identifier is 4 characters long and starts with "K"
    const identifier = (airportId.length === 4 && airportId.startsWith('K'))
      ? airportId.substring(1)
      : airportId;

    // Check if diagram exists in lookup
    const pdfName = airportDiagrams[identifier];
    if (!pdfName) {
      return null;
    }

    // Get current year and month in YYMM format
    const now = new Date();
    const year = now.getFullYear().toString().substring(2); // Last 2 digits of year
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
    const yymm = `${year}${month}`;

    return `https://aeronav.faa.gov/d-tpp/${yymm}/${pdfName}`;
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setLocationIdentifier(value);

    if (value.length >= 3) {
      const fuse = new Fuse(items, {
        keys: ['id', 'name'],
        threshold: 0.3,
      });

      const results = fuse.search(value);
      setSearchResults(results.slice(0, 10)); // Limit to 10 results
      setShowDropdown(results.length > 0);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  const handleSelectAirport = (airport) => {
    setLocationIdentifier(airport.id);
    setUserLocation([airport.latitude, airport.longitude]);
    mapRef.current.flyTo([airport.latitude, airport.longitude], 8);
    setShowDropdown(false);
  };

  const handleSetLocationFromIdentifier = () => {
    const fuse = new Fuse(items, {
        keys: ['id', 'name'],
        threshold: 0.3,
    });

    const results = fuse.search(locationIdentifier);

    if (results.length > 0) {
        const foundLocation = results[0].item;
        setUserLocation([foundLocation.latitude, foundLocation.longitude]);
        mapRef.current.flyTo([foundLocation.latitude, foundLocation.longitude], 8);
        setShowDropdown(false);
    } else {
        alert('Location identifier not found.');
    }
};

  useEffect(() => {
    const map = mapRef.current;

    const adjustIconSize = (zoom) => {
      const newSize = getIconSize(zoom);
      markersRef.current.forEach(marker => {
        if (marker) {
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
        const zoom = map.getZoom();
        console.log('zoom level: ' + zoom);
        setZoomLevel(zoom);
        adjustIconSize(zoom);
      });

      const initialZoom = map.getZoom();
      setZoomLevel(initialZoom);
      adjustIconSize(initialZoom);
    }
  }, []);

  return (
    <div>
      <header className="navbar">
        <div className="navbar-content">
          <div className="navbar-header-group">
            <img src={`${path}/favicon.ico`} alt="Logo" className="navbar-logo" />
            <h1 className="site-title">Airstrip Map</h1>
            <button
              onClick={() => setIsInfoModalOpen(true)}
              className="info-button-header"
              aria-label="Information"
            >
              ℹ
            </button>
          </div>
          <p className="site-description">
             Zoom to or search for your airport, then filter by amenities like camping, courtesy cars, bicycles, and nearby meals. Show all US airports for links to AirNav, SkyVector, and FAA diagrams.
          </p>
        </div>
      </header>

      <div className="control-panel">
        <div className="control-panel-header" onClick={toggleControlPanel}>
          <span className="control-panel-title">Controls</span>
          <span className="collapse-icon">{controlPanelCollapsed ? '▼' : '▲'}</span>
        </div>
        {!controlPanelCollapsed && (
          <div className="control-panel-content">
        <div className="radius-section">
          <div className="section-header" onClick={() => toggleSection('radius')}>
            <label className="section-title">Radius</label>
            <span className="collapse-icon">{collapsedSections.radius ? '▼' : '▲'}</span>
          </div>
          {!collapsedSections.radius && (
            <div className="radius-control">
              <label className="radius-label">
                {localRadius} miles
              </label>
              <input
                type="range"
                value={localRadius}
                onChange={handleSliderChange}
                onMouseUp={commitRadiusChange}
                onTouchEnd={commitRadiusChange}
                onBlur={commitRadiusChange}
                min="0"
                max="500"
                step="10"
                className="radius-slider"
              />
            </div>
          )}
        </div>

        <div className="search-section">
          <label className="section-title">Airport Lookup</label>
          <div className="search-container" ref={searchDropdownRef}>
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Location Identifier"
                value={locationIdentifier}
                onChange={handleSearchInputChange}
                onFocus={() => {
                  if (locationIdentifier.length >= 3 && searchResults.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                className="search-input"
              />
              <button
                onClick={handleSetLocationFromIdentifier}
                className="search-button"
                aria-label="Search"
              >
                🔎
              </button>
            </div>
            {showDropdown && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map((result) => (
                  <div
                    key={result.item.id}
                    className="search-dropdown-item"
                    onClick={() => handleSelectAirport(result.item)}
                  >
                    <div className="search-dropdown-item-id">{result.item.id}</div>
                    <div className="search-dropdown-item-name">{result.item.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="filter-section">
          <label className="section-title">Filter Options</label>
          <div>
            <div className="filter-grid">
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
            <div className="filter-separator"></div>
            <div className="filter-option">
              <input
                type="checkbox"
                id="show_all_airports"
                checked={showAllAirports}
                onChange={(e) => setShowAllAirports(e.target.checked)}
                className="filter-checkbox"
              />
              <label htmlFor="show_all_airports" className="filter-label">
                Show All US Airports
              </label>
            </div>
          </div>
        </div>
          </div>
        )}
      </div>

      <div>
      <button
        onClick={getUserLocation}
        className='location-button'
      >
        ⌖
      </button>
    </div>

      <MapContainer
        style={{ height: '100vh', width: '100vw' }}
        center={userLocation || [39.8283, -98.5795]}
        zoom={5} 
        ref={mapRef}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {userLocation && (
          <>
            <Marker position={userLocation} icon={userLocationIcon}>
              <Popup>Your location</Popup>
            </Marker>
            <Circle center={userLocation} radius={radius * 1609.34} /> {/* Convert miles to meters */}
          </>
        )}
        <MarkerClusterGroup
            showCoverageOnHover={false}
            spiderfyOnEveryZoom={true}
            disableClusteringAtZoom={8}
            iconCreateFunction={(cluster) => {
              const count = cluster.getChildCount();
              return L.divIcon({
                html: `
                  <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <img src="${markerPath}" style="width: 40px; height: 40px;" />
                    <div style="position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.7); color: #fff; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; display: flex; align-items: center; justify-content: center;">
                      ${count}
                    </div>
                  </div>
                `,
                className: 'marker-cluster-custom',
                iconSize: [40, 40],
              });
            }}
          >
        {items.length > 0 && items.filter(item => 
          (filter.courtesy_car ? item.courtesy_car : true) &&
          (filter.bicycles ? item.bicycles : true) &&
          (filter.camping ? item.camping : true) &&
          (filter.meals ? item.meals : true)
        ).map((filteredItem, index) => (
          <Marker 
            icon={determineIcon(filteredItem)} 
            key={filteredItem.id || `airport-${index}`} 
            position={[filteredItem.latitude, filteredItem.longitude]}
            ref={(marker) => { if (marker) markersRef.current.push(marker); }}
            options={{ fieldName: filteredItem.name, type: filteredItem.courtesy_car || filteredItem.bicycles || filteredItem.camping || filteredItem.meals ? 'colored' : 'grey' }}
           >
            <Popup>
              <div style={{ fontSize: '15px', marginBottom: '5px' }}>
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
                {getAirportDiagramUrl(filteredItem.id) && (
                  <>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    <a target="_blank" rel="noopener noreferrer" href={getAirportDiagramUrl(filteredItem.id)}>FAA Diagram</a>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        </MarkerClusterGroup>

        {/* Base layer: All US airports (when enabled) */}
        {showAllAirports && allAirports.length > 0 && (
          <MarkerClusterGroup
            showCoverageOnHover={false}
            spiderfyOnEveryZoom={true}
            disableClusteringAtZoom={11}
            maxClusterRadius={10}
            iconCreateFunction={(cluster) => {
              const count = cluster.getChildCount();
              return L.divIcon({
                html: `<div class="base-airport-cluster">${count}</div>`,
                className: 'base-airport-cluster-icon',
                iconSize: [24, 24],
              });
            }}
          >
            {allAirports.map((airport, index) => {
              const diagramUrl = getAirportDiagramUrl(airport.id);
              return (
                <Marker
                  key={`base-${airport.id}-${index}`}
                  position={[airport.latitude, airport.longitude]}
                  icon={baseAirportIcon}
                >
                  <Popup>
                    <div style={{ fontSize: '14px' }}>
                      <strong>{airport.name}</strong> ({airport.id})
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
                      {airport.type?.replace('_', ' ')}
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      <a target="_blank" rel="noopener noreferrer" href={`https://www.airnav.com/airport/${airport.id}`}>AirNav</a> &nbsp;&nbsp;|&nbsp;&nbsp;
                      <a target="_blank" rel="noopener noreferrer" href={`https://www.skyvector.com/airport/${airport.id}`}>SkyVector</a>
                      {diagramUrl && (
                        <>
                          &nbsp;&nbsp;|&nbsp;&nbsp;
                          <a
                            href={diagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#2563eb',
                              textDecoration: 'none',
                              fontWeight: 'bold'
                            }}
                          >
                            📄 Diagram
                          </a>
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        )}

      </MapContainer>
      <ImageModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} imageUrl={currentImageUrl} />
      <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
    </div>
    
  );
}

export default FullPageMap;
