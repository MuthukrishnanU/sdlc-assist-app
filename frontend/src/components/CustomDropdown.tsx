import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../ThemeContext';

interface CustomDropdownProps {
  label: string;
  options: (string | number)[];
  value: string | number;
  onChange: (value: any) => void;
  icon?: React.ReactNode;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  icon
}) => {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className={`text-xs font-semibold tracking-wider flex items-center gap-2 ${(label == 'Select Parameter') ? (isDark ? 'text-white/50' : 'text-gray-550') : (isDark ? 'text-white/50 uppercase' : 'text-gray-500 uppercase')}`}>
        {icon} {label}
      </label>

      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`h-[42px] w-full rounded-lg px-3 flex items-center justify-between cursor-pointer transition-all focus-within:ring-2 ${isDark
            ? `bg-white/10 border border-white/10 hover:border-white/20 focus-within:ring-axis-red/30 ${isOpen ? 'ring-2 ring-axis-red/30 border-axis-red/50' : ''}`
            : `bg-white border border-gray-200 hover:border-gray-300 focus-within:ring-axis-burgundy/20 ${isOpen ? 'ring-2 ring-axis-burgundy/20 border-axis-burgundy/50' : ''}`
            }`}
        >
          <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-700'}`}>{value}</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDark ? 'text-white/40' : 'text-gray-400'} ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className={`absolute z-50 w-full mt-2 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${isDark
            ? 'bg-axis-burgundy-dark border border-white/10'
            : 'bg-white border border-gray-200'
            }`}>
            <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar">
              {options.map(option => {
                const isSelected = value === option;
                return (
                  <div
                    key={option}
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${isDark
                      ? (isSelected
                        ? 'bg-axis-red/20 text-axis-cream font-medium'
                        : 'text-white/80 hover:bg-axis-red hover:text-white')
                      : (isSelected
                        ? 'bg-axis-burgundy/10 text-axis-burgundy font-medium'
                        : 'text-gray-700 hover:bg-axis-burgundy hover:text-white')
                      }`}
                  >
                    <span>{option}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomDropdown;
