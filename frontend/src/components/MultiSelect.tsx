import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check, Search } from 'lucide-react';
import { useTheme } from '../ThemeContext';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  icon
}) => {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const toggleOption = (option: string) => {
    const isSelected = selected.includes(option);
    if (isSelected) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const removeOption = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    onChange(selected.filter(item => item !== option));
  };

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
        {icon} {label}
      </label>
      
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`min-h-[42px] w-full rounded-lg px-3 py-1.5 flex flex-wrap gap-1.5 items-center cursor-pointer transition-all focus-within:ring-2 ${
            isDark
              ? `bg-white/10 border border-white/10 hover:border-white/20 focus-within:ring-axis-red/30 ${isOpen ? 'ring-2 ring-axis-red/30 border-axis-red/50' : ''}`
              : `bg-white border border-gray-200 hover:border-gray-300 focus-within:ring-axis-burgundy/20 ${isOpen ? 'ring-2 ring-axis-burgundy/20 border-axis-burgundy/50' : ''}`
          }`}
        >
          {selected.length === 0 ? (
            <span className={`text-sm ml-1 ${isDark ? 'text-white/30' : 'text-gray-500'}`}>{placeholder}</span>
          ) : (
            selected.map(item => (
              <span
                key={item}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium animate-in fade-in zoom-in duration-200 ${
                  isDark
                    ? 'bg-axis-red/20 text-axis-cream border border-axis-red/30'
                    : 'bg-axis-burgundy/10 text-axis-burgundy border border-axis-burgundy/20'
                }`}
              >
                {item}
                <button
                  onClick={(e) => removeOption(e, item)}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
          
          <div className="ml-auto flex items-center gap-2 pl-2">
            {selected.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className={`transition-colors ${isDark ? 'text-white/40 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDark ? 'text-white/40' : 'text-gray-400'} ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {isOpen && (
          <div className={`absolute z-50 w-full mt-2 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
            isDark
              ? 'bg-axis-burgundy-dark border border-white/10'
              : 'bg-white border border-gray-200'
          }`}>
            <div className={`p-2 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
              <div className="relative">
                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 transition-all ${
                    isDark
                      ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:ring-axis-red/30'
                      : 'bg-gray-50 border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-axis-burgundy/20'
                  }`}
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className={`px-3 py-2 text-sm ${isDark ? 'text-white/40' : 'text-gray-500'}`}>No options found</div>
              ) : (
                filteredOptions.map(option => {
                  const isSelected = selected.includes(option);
                  return (
                    <div
                      key={option}
                      onClick={() => toggleOption(option)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                        isDark
                          ? (isSelected
                              ? 'bg-axis-red/15 text-axis-cream'
                              : 'text-white/80 hover:bg-white/5')
                          : (isSelected
                              ? 'bg-axis-burgundy/5 text-axis-burgundy'
                              : 'text-gray-700 hover:bg-gray-50')
                      }`}
                    >
                      <span>{option}</span>
                      <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                        isDark
                          ? (isSelected
                              ? 'bg-axis-red border-axis-red shadow-[0_0_10px_rgba(235,17,101,0.2)]'
                              : 'border-white/20 bg-white/5')
                          : (isSelected
                              ? 'bg-axis-burgundy border-axis-burgundy shadow-[0_0_10px_rgba(137,27,63,0.2)]'
                              : 'border-gray-300 bg-white')
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiSelect;
