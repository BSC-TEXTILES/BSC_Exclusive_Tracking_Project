import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * ScrollToTopButton
 * 
 * Features:
 * - Automatically tracks page scroll progress percentage (0 - 100%).
 * - Renders a circular SVG progress ring that fills up smoothly as the user scrolls down.
 * - Shows an upward arrow with sleek pulsing glow.
 * - When clicked: triggers smooth scroll to top, animates outside (slides down and fades off-screen),
 *   and automatically hides when near the top (scroll < 120px).
 */
export const ScrollToTopButton: React.FC = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      
      if (scrollHeight > 0) {
        const progress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
        setScrollProgress(progress);
      }

      if (scrollTop > 140) {
        setIsVisible(true);
        setIsExiting(false);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = () => {
    // Animate outside (slide down and fade out) immediately when clicked
    setIsExiting(true);
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    // Reset exiting state after scroll completes
    setTimeout(() => {
      setIsExiting(false);
      setIsVisible(false);
    }, 600);
  };

  // SVG ring dimensions
  const size = 52;
  const strokeWidth = 3.5;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scrollProgress / 100) * circumference;

  const shouldRender = isVisible || isExiting;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out ${
        shouldRender && !isExiting
          ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
          : 'opacity-0 translate-y-16 pointer-events-none scale-75'
      }`}
      aria-hidden={!shouldRender}
    >
      <button
        type="button"
        onClick={handleClick}
        title={`Scroll to top (${Math.round(scrollProgress)}% scrolled)`}
        aria-label="Scroll back to top of page"
        className="group relative flex items-center justify-center w-13 h-13 rounded-full bg-slate-900/90 text-amber-400 backdrop-blur-md shadow-xl shadow-amber-500/10 border border-amber-500/20 hover:border-amber-400/60 hover:shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
      >
        {/* Glow halo */}
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Circular Progress Ring */}
        <svg
          className="w-13 h-13 -rotate-90 pointer-events-none"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-700/40"
          />
          {/* Filled progress bar */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#scrollProgressGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-150 ease-out"
          />
          <defs>
            <linearGradient id="scrollProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Arrow Icon & Tooltip */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ArrowUp className="w-5 h-5 text-amber-300 group-hover:text-amber-200 group-hover:-translate-y-0.5 transition-transform duration-200" />
        </div>

        {/* Percentage badge on hover */}
        <span className="absolute -top-7 px-1.5 py-0.5 rounded bg-slate-900/95 text-[10px] font-mono text-amber-400 font-semibold border border-amber-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-md pointer-events-none">
          {Math.round(scrollProgress)}%
        </span>
      </button>
    </div>
  );
};
