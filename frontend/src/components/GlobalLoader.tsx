import React from 'react';
import { useTheme } from '../ThemeContext';

const GlobalLoader: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
      <div className={`p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border flex flex-col items-center gap-5 max-w-xs w-full mx-4 transition-all duration-300 animate-in zoom-in ${
        isDark 
          ? 'bg-axis-burgundy-deep/95 border-white/10 text-white' 
          : 'bg-white/95 border-gray-150 text-axis-burgundy'
      }`}>
        <div className="relative flex items-center justify-center w-16 h-16">
          {/* Inner pulsing glow */}
          <div className={`absolute inset-2 rounded-full animate-ping opacity-25 ${
            isDark ? 'bg-axis-red' : 'bg-axis-burgundy'
          }`} />
          {/* Main spinner ring */}
          <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${
            isDark 
              ? 'border-axis-red' 
              : 'border-axis-burgundy'
          }`} />
        </div>
        <span className={`text-sm font-semibold tracking-wider uppercase animate-pulse ${
          isDark ? 'text-axis-cream' : 'text-axis-burgundy'
        }`}>
          Loading...
        </span>
      </div>
    </div>
  );
};

export default GlobalLoader;
