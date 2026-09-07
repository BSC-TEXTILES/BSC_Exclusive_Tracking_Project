import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Navigation, 
  Layers, 
  ShieldCheck, 
  Phone, 
  Clock, 
  ExternalLink,
  Sparkles,
  Compass,
  Cpu
} from 'lucide-react';

interface OfficeLocation {
  id: string;
  tag: string;
  badge: string;
  name: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  landmark?: string;
  googleMapsUrl: string;
  coordinates: { lat: string; lng: string };
  hours: string;
  phone: string;
  features: string[];
  is3dHighlight?: boolean;
}

const OFFICE_LOCATIONS: OfficeLocation[] = [
  {
    id: 'belagavi',
    tag: '3D Flagship Tech Hub',
    badge: 'Virtual 3D Interactive Center',
    name: 'Belagavi Regional Operations & 3D Tech Hub',
    address: 'RGQ4+C68, Mangalwar Peth, Tilakwadi',
    city: 'Belagavi',
    state: 'Karnataka',
    pincode: '590006',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=RGQ4%2BC68%2C+Mangalwar+Peth%2C+Tilakwadi%2C+Belagavi%2C+Karnataka+590006',
    coordinates: { lat: '15.8497° N', lng: '74.5098° E' },
    hours: 'Mon - Sat: 09:00 AM - 07:00 PM',
    phone: '+91 831 240 9100',
    features: [
      'Interactive 3D Digital Twin & Audit Telemetry',
      'High-Security Central Compliance Vault',
      'Executive Verification & Strategy Center',
      'Real-time ISO & Evidence Certification Wing'
    ],
    is3dHighlight: true
  },
  {
    id: 'davangere',
    tag: 'Central Audit Center',
    badge: 'Main Compliance Hub',
    name: 'Davangere Compliance & Verification Center',
    address: 'Medical College Rd, MCC B Block, Kuvempu Nagar',
    city: 'Davangere',
    state: 'Karnataka',
    pincode: '577004',
    landmark: 'Near Medical College Campus',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Medical+College+Rd%2C+MCC+B+Block%2C+Kuvempu+Nagar%2C+Davangere%2C+Karnataka+577004',
    coordinates: { lat: '14.4644° N', lng: '75.9218° E' },
    hours: 'Mon - Sat: 09:30 AM - 06:30 PM',
    phone: '+91 819 222 3450',
    features: [
      'Core Checkpoint Auditing & Document Scanners',
      'Departmental Intake & Officer Consultations',
      'Zero-Trust Biometric Entry Security',
      'On-site Regulatory Verification Desks'
    ]
  },
  {
    id: 'shivamogga',
    tag: 'Regional Operations Center',
    badge: 'High-Capacity Facility',
    name: 'Shivamogga Corporate Operations Office',
    address: '2nd B.H. Road, in a large building opposite the Royal Orchid Hotel',
    city: 'Shivamogga',
    state: 'Karnataka',
    pincode: '577201',
    landmark: 'Opposite Royal Orchid Hotel, 2nd B.H. Road',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=2nd+B.H.+Road%2C+Opposite+Royal+Orchid+Hotel%2C+Shivamogga',
    coordinates: { lat: '13.9299° N', lng: '75.5681° E' },
    hours: 'Mon - Sat: 09:00 AM - 06:00 PM',
    phone: '+91 818 226 7890',
    features: [
      'Corporate Multi-Story Verification Infrastructure',
      'Regional Review Tribunal & Briefing Auditoriums',
      'Direct Transit Access on National B.H. Highway',
      'High-Speed Secure Dedicated Data Uplink'
    ]
  }
];

export const ProjectOffices3D: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>('belagavi');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse tilt tracking for 3D perspective effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePos({ x: 0, y: 0 });
  };

  const activeOffice = OFFICE_LOCATIONS.find((o) => o.id === selectedId) || OFFICE_LOCATIONS[0];

  // Dynamic 3D rotation transform based on mouse position
  const rotateX = isHovered ? -mousePos.y * 12 : 0;
  const rotateY = isHovered ? mousePos.x * 15 : 0;

  return (
    <section id="offices" className="relative py-24 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white overflow-hidden border-t border-slate-800">
      {/* Background ambient lighting and grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.12),rgba(255,255,255,0))]" />
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4 shadow-sm">
            <Compass className="w-3.5 h-3.5 animate-spin-slow" />
            Strategic Presence & Verification Centers
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Project Office Locations
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
            Our physical verification centers and advanced 3D compliance hub empower real-time audit governance across Karnataka.
          </p>
        </div>

        {/* Location selector tabs */}
        <div className="flex flex-wrap justify-center items-center gap-3 mb-12">
          {OFFICE_LOCATIONS.map((loc) => {
            const isActive = loc.id === selectedId;
            return (
              <button
                key={loc.id}
                onClick={() => setSelectedId(loc.id)}
                className={`relative px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2.5 border ${
                  isActive
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/20 scale-[1.02]'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                {loc.is3dHighlight ? (
                  <Sparkles className={`w-4 h-4 ${isActive ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
                ) : (
                  <MapPin className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                )}
                <span>{loc.city}</span>
                {loc.is3dHighlight && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    3D Tech Hub
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main 3D Showcase Showcase Card */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          className="relative rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-10 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out"
          style={{
            perspective: '1200px',
          }}
        >
          <div
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center transition-all duration-300 ease-out"
            style={{
              transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Left Column: 3D Holographic Isometric Architectural Model */}
            <div className="lg:col-span-6 relative flex flex-col items-center justify-center p-6 sm:p-10 rounded-2xl bg-gradient-to-br from-slate-950/90 via-slate-900/90 to-slate-950/90 border border-amber-500/20 overflow-hidden group shadow-inner">
              {/* Radial gradient backing */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.15)_0%,transparent_70%)] pointer-events-none" />

              {/* Top HUD Stats */}
              <div className="w-full flex items-center justify-between text-xs font-mono text-slate-400 mb-6 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-amber-300 font-semibold uppercase">{activeOffice.tag}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>ONLINE FACILITY</span>
                </div>
              </div>

              {/* 3D Isometric Building Model Representation */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center my-4 select-none">
                {/* Rotating Rings */}
                <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-spin-slow" />
                <div className="absolute inset-4 rounded-full border border-dashed border-amber-500/30" style={{ animation: 'spin 24s linear infinite reverse' }} />
                
                {/* 3D Isometric Building Structure */}
                <div 
                  className="relative transition-transform duration-500"
                  style={{
                    transform: `translateZ(40px) rotateX(60deg) rotateZ(-45deg)`,
                    transformStyle: 'preserve-3d'
                  }}
                >
                  {/* Building Base Shadow */}
                  <div className="w-36 h-36 bg-amber-500/10 rounded-2xl blur-md shadow-2xl" />

                  {/* Floor 1 (Base) */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-amber-500/40 rounded-xl shadow-lg flex items-center justify-center"
                    style={{ transform: 'translateZ(0px)' }}
                  >
                    <div className="w-full h-full grid grid-cols-3 gap-1 p-2 opacity-50">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="bg-amber-400/20 rounded-xs border border-amber-400/30" />
                      ))}
                    </div>
                  </div>

                  {/* Floor 2 (Mid Tower) */}
                  <div 
                    className="absolute inset-2 bg-gradient-to-tr from-slate-800 to-amber-950/60 border-2 border-amber-400/60 rounded-lg shadow-xl flex items-center justify-center"
                    style={{ transform: 'translateZ(35px)' }}
                  >
                    <div className="w-full h-full grid grid-cols-2 gap-1 p-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-amber-400/30 rounded-xs border border-amber-400/50" />
                      ))}
                    </div>
                  </div>

                  {/* Floor 3 (Upper Deck) */}
                  <div 
                    className="absolute inset-4 bg-gradient-to-tr from-amber-600/40 to-slate-800 border-2 border-amber-400 rounded-md shadow-2xl flex items-center justify-center backdrop-blur-sm"
                    style={{ transform: 'translateZ(70px)' }}
                  >
                    <Building2 className="w-8 h-8 text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                  </div>

                  {/* Hologram Beam Pillar on top */}
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-28 bg-gradient-to-t from-amber-400 to-transparent pointer-events-none"
                    style={{ transform: 'translateZ(85px)' }}
                  />
                </div>

                {/* Floating GPS/Radar badge */}
                <div 
                  className="absolute bottom-2 left-2 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700 text-[11px] font-mono text-amber-300 shadow-md backdrop-blur-md"
                  style={{ transform: 'translateZ(50px)' }}
                >
                  COORD: {activeOffice.coordinates.lat} / {activeOffice.coordinates.lng}
                </div>
              </div>

              {/* Telemetry Footer */}
              <div className="w-full flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80 mt-2">
                <div className="flex items-center gap-1 text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>3D Digital Twin Active</span>
                </div>
                <div className="text-amber-400 font-mono text-[11px]">
                  PIN: {activeOffice.pincode}
                </div>
              </div>
            </div>

            {/* Right Column: Office Detailed Information */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider">
                    {activeOffice.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {activeOffice.id.toUpperCase()}-HUB
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {activeOffice.name}
                </h3>

                {/* Full Address Block */}
                <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/80">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {activeOffice.address}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {activeOffice.city}, {activeOffice.state} — <span className="font-mono text-amber-300 font-medium">{activeOffice.pincode}</span>
                      </p>
                      {activeOffice.landmark && (
                        <p className="text-xs text-amber-400/90 mt-1.5 font-medium flex items-center gap-1">
                          <span className="font-bold">Landmark:</span> {activeOffice.landmark}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timings & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Operating Hours</div>
                      <div className="font-medium text-slate-200">{activeOffice.hours}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
                    <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Verification Desk</div>
                      <div className="font-medium text-slate-200">{activeOffice.phone}</div>
                    </div>
                  </div>
                </div>

                {/* Key Center Capabilities / Features */}
                <div className="mt-5">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Key Center Capabilities & Amenities
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    {activeOffice.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-slate-800/30 p-2 rounded-md border border-slate-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-3">
                <a
                  href={activeOffice.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200"
                >
                  <Navigation className="w-4 h-4" />
                  Get Google Maps Directions
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom 3 Office Location Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          {OFFICE_LOCATIONS.map((loc) => {
            const isSelected = loc.id === selectedId;
            return (
              <div
                key={loc.id}
                onClick={() => setSelectedId(loc.id)}
                className={`cursor-pointer rounded-2xl p-6 border transition-all duration-300 relative group ${
                  isSelected
                    ? 'bg-slate-800/90 border-amber-500/60 shadow-xl shadow-amber-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-semibold text-amber-400">
                    {loc.city.toUpperCase()}
                  </span>
                  {loc.is3dHighlight ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      3D Hub
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400">
                      Center
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-white text-base group-hover:text-amber-300 transition-colors">
                  {loc.name}
                </h4>

                <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {loc.address}, {loc.city}, Karnataka {loc.pincode}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">{loc.phone}</span>
                  <span className="text-amber-400 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    View Center &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
