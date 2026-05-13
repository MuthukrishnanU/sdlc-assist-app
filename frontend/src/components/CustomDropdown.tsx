import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

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
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
        {icon} {label}
      </label>
      
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`h-[42px] w-full bg-white border border-gray-200 rounded-lg px-3 flex items-center justify-between cursor-pointer hover:border-gray-300 transition-all focus-within:ring-2 focus-within:ring-axis-burgundy/20 ${isOpen ? 'ring-2 ring-axis-burgundy/20 border-axis-burgundy/50' : ''}`}
        >
          <span className="text-sm text-gray-700">{value}</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-axis-burgundy/10 text-axis-burgundy font-medium' 
                        : 'text-gray-700 hover:bg-axis-burgundy hover:text-white'
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
