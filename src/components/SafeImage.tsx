import React, { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';

export const LISTING_PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="none">' +
      '<rect width="400" height="300" fill="#F1F4F9"/>' +
      '<rect x="140" y="88" width="120" height="90" rx="14" stroke="#C69A35" stroke-width="4" fill="#FFFFFF"/>' +
      '<circle cx="172" cy="118" r="10" fill="#E7C875"/>' +
      '<path d="M150 166L182 136L205 156L224 140L250 166H150Z" fill="#C69A35"/>' +
      '<text x="200" y="216" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#596273">Afrique Business</text>' +
    '</svg>'
  );

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onClick?: (e: React.MouseEvent) => void;
  fallbackLabel?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  onClick,
  fallbackLabel = 'Photo indisponible',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const cleanSrc = typeof src === 'string' ? src.trim() : '';

  if (!cleanSrc || hasError) {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center justify-center bg-[#F1F4F9] text-[#596273] select-none ${className}`}
        role="img"
        aria-label={alt || fallbackLabel}
      >
        <ImageOff className="w-6 h-6 text-[#C69A35]/70 mb-1" />
        <span className="text-[10px] font-semibold text-center px-2">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      onClick={onClick}
      onError={() => setHasError(true)}
      className={className}
    />
  );
};

interface SafeAvatarProps {
  src?: string | null;
  alt?: string;
  initials: string;
  className?: string;
  fallbackClassName?: string;
}

export const SafeAvatar: React.FC<SafeAvatarProps> = ({
  src,
  alt = '',
  initials,
  className = 'w-10 h-10 rounded-full object-cover',
  fallbackClassName = 'w-10 h-10 rounded-full bg-linear-to-tr from-[#C69A35] to-[#E7C875] text-[#172033] font-black flex items-center justify-center text-xs',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const cleanSrc = typeof src === 'string' ? src.trim() : '';

  if (!cleanSrc || hasError) {
    return (
      <div className={fallbackClassName} aria-label={alt || initials}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
