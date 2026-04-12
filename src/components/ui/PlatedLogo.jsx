export default function PlatedLogo({ size = 100, dark = false }) {
  const bg       = dark ? '#2A1E18' : '#F5EDE6'
  const plateBg  = dark ? '#3A2A22' : '#EDE3D8'

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="50" fill={bg} />

      {/* Plate outer rim */}
      <circle cx="50" cy="50" r="33" fill={plateBg} stroke="#C17A5A" strokeWidth="2.5" />
      {/* Plate inner detail ring */}
      <circle cx="50" cy="50" r="26.5" stroke="#C17A5A" strokeWidth="1" strokeOpacity="0.35" />

      {/* FORK — 3 tines, shoulder curve, handle */}
      <line x1="19.5" y1="13" x2="19.5" y2="33.5" stroke="#C17A5A" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="23.5" y1="13" x2="23.5" y2="35"   stroke="#C17A5A" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="27.5" y1="13" x2="27.5" y2="33.5" stroke="#C17A5A" strokeWidth="2.2" strokeLinecap="round" />
      {/* Shoulder */}
      <path d="M19.5 33 C19.5 41.5 23.5 43 23.5 43 C23.5 43 27.5 41.5 27.5 33Z" fill="#C17A5A" />
      {/* Handle */}
      <line x1="23.5" y1="43" x2="23.5" y2="85" stroke="#C17A5A" strokeWidth="2.8" strokeLinecap="round" />

      {/* SPOON — oval bowl, neck, handle */}
      <ellipse cx="76.5" cy="24" rx="5.5" ry="9" fill="#C17A5A" />
      <path d="M74.2 32.5 Q74.5 35 76.5 35.5 Q78.5 35 78.8 32.5" fill="#C17A5A" />
      <line x1="76.5" y1="35" x2="76.5" y2="85" stroke="#C17A5A" strokeWidth="2.8" strokeLinecap="round" />

      {/* LEAF — body, stem, veins */}
      {/* Stem */}
      <path d="M62 41 Q61.5 44.5 61 48" stroke="#7A9E7E" strokeWidth="1.4" strokeLinecap="round" />
      {/* Leaf body */}
      <path
        d="M62 41 C65.5 34.5 69 27.5 71 22 C68 20 62.5 22.5 59.5 27 C57 31.5 58 37.5 62 41Z"
        fill="#7A9E7E"
      />
      {/* Central vein */}
      <path d="M62 41 C65.5 34.5 69 27.5 71 22" stroke="#4D7355" strokeWidth="0.85" strokeLinecap="round" strokeOpacity="0.85" />
      {/* Side veins */}
      <path d="M64.5 37.5 Q66 35.5 67 34"   stroke="#4D7355" strokeWidth="0.55" strokeLinecap="round" strokeOpacity="0.7" />
      <path d="M66 33.5 Q67.5 31.5 68.5 30" stroke="#4D7355" strokeWidth="0.55" strokeLinecap="round" strokeOpacity="0.7" />
      <path d="M63 39.5 Q64 38 64.5 37.5"   stroke="#4D7355" strokeWidth="0.45" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  )
}
