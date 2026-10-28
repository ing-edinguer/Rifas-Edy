import React, { useState } from 'react';

export function SoccerBallSVG({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ballSphere" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </radialGradient>
        <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="pitchPentagon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#065F46" />
          <stop offset="100%" stopColor="#022C22" />
        </linearGradient>
      </defs>

      {/* Outer Gold Halo Ring */}
      <circle cx="60" cy="60" r="56" stroke="url(#goldAccent)" strokeWidth="2.5" opacity="0.85" />
      {/* Main Ball Sphere */}
      <circle cx="60" cy="60" r="50" fill="url(#ballSphere)" stroke="#064E3B" strokeWidth="2.5" />

      {/* Seam Lines */}
      <g stroke="#064E3B" strokeWidth="2.2" strokeLinecap="round">
        <line x1="60" y1="38" x2="60" y2="16" />
        <line x1="81" y1="53" x2="103" y2="43" />
        <line x1="73" y1="78" x2="91" y2="96" />
        <line x1="47" y1="78" x2="29" y2="96" />
        <line x1="39" y1="53" x2="17" y2="43" />
      </g>

      {/* Center Pentagon */}
      <polygon
        points="60,38 81,53 73,78 47,78 39,53"
        fill="url(#pitchPentagon)"
        stroke="url(#goldAccent)"
        strokeWidth="2"
      />

      {/* Outer Partial Pentagons */}
      <path d="M46,12 L60,18 L74,12 C65,9 55,9 46,12 Z" fill="url(#pitchPentagon)" />
      <path d="M99,31 L101,45 L109,52 C108,42 104,36 99,31 Z" fill="url(#pitchPentagon)" />
      <path d="M21,31 L19,45 L11,52 C12,42 16,36 21,31 Z" fill="url(#pitchPentagon)" />
      <path d="M84,103 L90,94 L101,92 C96,98 90,101 84,103 Z" fill="url(#pitchPentagon)" />
      <path d="M36,103 L30,94 L19,92 C24,98 30,101 36,103 Z" fill="url(#pitchPentagon)" />

      {/* Center Gold Star Detail */}
      <circle cx="60" cy="60" r="5" fill="url(#goldAccent)" />
    </svg>
  );
}

export function GoldenTrophySVG({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="trophyGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      {/* Cup Handles */}
      <path
        d="M34 30 H20 C16 30 14 36 16 44 C19 54 28 60 38 60"
        stroke="url(#trophyGold)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M86 30 H100 C104 30 106 36 104 44 C101 54 92 60 82 60"
        stroke="url(#trophyGold)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Main Cup Body */}
      <path
        d="M32 22 H88 V46 C88 66 75 78 60 78 C45 78 32 66 32 46 V22 Z"
        fill="url(#trophyGold)"
      />
      {/* Stem & Base */}
      <rect x="53" y="76" width="14" height="18" rx="3" fill="url(#trophyGold)" />
      <rect x="36" y="92" width="48" height="12" rx="4" fill="#064E3B" stroke="url(#trophyGold)" strokeWidth="2.5" />
      {/* Emblem on Cup */}
      <circle cx="60" cy="46" r="11" fill="#042F2E" />
      <path d="M60 38 L62.5 43.5 L68.5 44 L64 48 L65.5 54 L60 50.8 L54.5 54 L56 48 L51.5 44 L57.5 43.5 Z" fill="#FDE047" />
    </svg>
  );
}

export function PlayerPhotoOrCrest({
  photoUrl,
  playerName,
  sizeClass = 'w-20 h-20',
}: {
  photoUrl?: string;
  playerName: string;
  sizeClass?: string;
}) {
  const [imgError, setImgError] = useState(false);

  const hasValidPhoto = Boolean(photoUrl && photoUrl.trim().length > 4 && !imgError);

  if (hasValidPhoto) {
    return (
      <div
        className={`${sizeClass} rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-md bg-emerald-950 shrink-0 relative`}
      >
        <img
          src={photoUrl}
          alt={`Fotografía de ${playerName}`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-2xl border-2 border-amber-400/70 bg-gradient-to-br from-emerald-800 via-emerald-950 to-slate-950 flex flex-col items-center justify-center p-2 shrink-0 shadow-md`}
    >
      <SoccerBallSVG className="w-11 h-11" />
    </div>
  );
}

export function RaffleCoverBanner({
  coverImageUrl,
  children,
}: {
  coverImageUrl?: string;
  children: React.ReactNode;
}) {
  const [bgError, setBgError] = useState(false);
  const raw = (coverImageUrl || 'preset:cancha-nocturna').trim();
  const isCustomImage = !raw.startsWith('preset:') && raw.length > 5 && !bgError;

  return (
    <div className="relative rounded-3xl overflow-hidden border border-emerald-700/60 bg-[#05291C] shadow-xl">
      {/* Custom Uploaded or URL Cover Image */}
      {isCustomImage ? (
        <div className="absolute inset-0">
          <img
            src={raw}
            alt="Portada de la rifa"
            referrerPolicy="no-referrer"
            onError={() => setBgError(true)}
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#031B12] via-[#042419]/85 to-[#042419]/60" />
        </div>
      ) : (
        /* Original Athletic SVG Stadium Pitch Cover Backdrop */
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {raw === 'preset:balon-dorado' && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#063E29] via-[#042418] to-[#02140D]" />
          )}
          {raw === 'preset:trofeo-liga' && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#093826] via-[#052217] to-[#1A1405]" />
          )}
          {raw === 'preset:cantera-juvenil' && (
            <div className="absolute inset-0 bg-gradient-to-r from-[#043927] via-[#064E3B] to-[#022C22]" />
          )}
          {(raw === 'preset:cancha-nocturna' || !raw.startsWith('preset:')) && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#064E3B] via-[#04281C] to-[#021710]" />
          )}

          {/* Tactical Soccer Pitch Markings SVG */}
          <svg
            viewBox="0 0 1200 500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full object-cover opacity-20"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Outer Pitch Boundary */}
            <rect
              x="40"
              y="30"
              width="1120"
              height="440"
              rx="12"
              stroke="#34D399"
              strokeWidth="2.5"
            />
            {/* Halfway Line */}
            <line x1="600" y1="30" x2="600" y2="470" stroke="#34D399" strokeWidth="2.5" />
            {/* Center Circle */}
            <circle cx="600" cy="250" r="95" stroke="#FBBF24" strokeWidth="2.5" />
            <circle cx="600" cy="250" r="6" fill="#FBBF24" />
            {/* Left Penalty Box */}
            <rect x="40" y="125" width="160" height="250" stroke="#34D399" strokeWidth="2.5" />
            <rect x="40" y="185" width="65" height="130" stroke="#34D399" strokeWidth="2" />
            {/* Right Penalty Box */}
            <rect x="1000" y="125" width="160" height="250" stroke="#34D399" strokeWidth="2.5" />
            <rect x="1095" y="185" width="65" height="130" stroke="#34D399" strokeWidth="2" />
            {/* Diagonal Turf Stripes */}
            <g fill="#FFFFFF" opacity="0.03">
              <rect x="120" y="30" width="80" height="440" />
              <rect x="280" y="30" width="80" height="440" />
              <rect x="440" y="30" width="80" height="440" />
              <rect x="600" y="30" width="80" height="440" />
              <rect x="760" y="30" width="80" height="440" />
              <rect x="920" y="30" width="80" height="440" />
            </g>
          </svg>

          {/* Decorative Original Soccer Ball / Trophy Watermark on Right */}
          <div className="hidden lg:block absolute -right-10 -bottom-10 opacity-15">
            {raw === 'preset:trofeo-liga' ? (
              <GoldenTrophySVG className="w-72 h-72" />
            ) : (
              <SoccerBallSVG className="w-72 h-72" />
            )}
          </div>
        </div>
      )}

      {/* Foreground Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
