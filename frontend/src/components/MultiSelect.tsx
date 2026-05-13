import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

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

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        {icon} {label}
      </label>
      
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`min-h-[42px] w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 flex flex-wrap gap-1.5 items-center cursor-pointer hover:bg-white/10 transition-all focus-within:ring-2 focus-within:ring-indigo-500/50 ${isOpen ? 'ring-2 ring-indigo-500/50 border-indigo-500/50' : ''}`}
        >
          {selected.length === 0 ? (
            <span className="text-sm text-gray-500 ml-1">{placeholder}</span>
          ) : (
            selected.map(item => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md text-xs font-medium animate-in fade-in zoom-in duration-200"
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
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-[#16161a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl">
            <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No options available</div>
              ) : (
                options.map(option => {
                  const isSelected = selected.includes(option);
                  return (
                    <div
                      key={option}
                      onClick={() => toggleOption(option)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-indigo-500/20 text-indigo-300' 
                          : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <span>{option}</span>
                      <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                        isSelected 
                          ? 'bg-indigo-500 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]' 
                          : 'border-white/20 bg-white/5'
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
