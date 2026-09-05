'use client'

import Image from 'next/image'

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon-only' | 'badge'
  theme?: 'dark' | 'light'
  showSubtitle?: boolean
  showText?: boolean
  className?: string
}

export default function BrandLogo({
  size = 'md',
  variant = 'full',
  theme = 'dark',
  showSubtitle = false,
  showText = true,
  className = '',
}: BrandLogoProps) {
  // Dimensions for the official logo emblem
  const dimensions = {
    xs: { icon: 28, wrapper: 'w-7 h-7', font: 'text-xs', subFont: 'text-[9px]' },
    sm: { icon: 36, wrapper: 'w-9 h-9', font: 'text-sm', subFont: 'text-[10px]' },
    md: { icon: 48, wrapper: 'w-12 h-12', font: 'text-base font-bold', subFont: 'text-[11px]' },
    lg: { icon: 76, wrapper: 'w-20 h-20', font: 'text-xl font-extrabold', subFont: 'text-xs' },
    xl: { icon: 112, wrapper: 'w-28 h-28', font: 'text-2xl font-black', subFont: 'text-sm' },
  }

  const { icon, wrapper, font, subFont } = dimensions[size]
  const textColor = theme === 'dark' ? 'text-white' : 'text-text'
  const subtextColor = theme === 'dark' ? 'text-primary/90' : 'text-primary'

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Authentic BSC Exclusive Logo Mark */}
      <div
        className={`relative ${wrapper} rounded-lg bg-white overflow-hidden shadow-xs ring-1 ring-black/10 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}
      >
        <Image
          src="/bsc-logo.png"
          alt="BSC Exclusive Logo"
          width={icon}
          height={icon}
          priority
          className="object-contain w-full h-full p-0.5"
        />
      </div>

      {/* Wordmark (shown when variant !== 'icon-only' and showText is true) */}
      {variant !== 'icon-only' && showText && (
        <div className="flex flex-col min-w-0 leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`tracking-tight ${font} ${textColor} transition-colors group-hover:text-primary`}
            >
              BSC Exclusive
            </span>
            {variant === 'full' && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-widest bg-primary/15 text-primary border border-primary/30">
                PRO
              </span>
            )}
          </div>
          {showSubtitle && (
            <span
              className={`font-semibold uppercase tracking-widest mt-1 ${subFont} ${subtextColor}`}
            >
              Since 1938 &bull; Process Tracker
            </span>
          )}
        </div>
      )}
    </div>
  )
}
