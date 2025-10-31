import React from 'react';
import type { FontSize } from '../App';

const fontSizes: { label: string, value: FontSize }[] = [
  { label: 'S', value: 'sm' },
  { label: 'M', value: 'base' },
  { label: 'L', value: 'lg' },
];

const fontFamilies = [
  { label: 'Nunito', value: "'Nunito', sans-serif" },
  { label: 'Comic Neue', value: "'Comic Neue', cursive" },
  { label: 'Patrick Hand', value: "'Patrick Hand', cursive" },
];

interface StyleControlsProps {
  fontSize: FontSize;
  fontFamily: string;
  onFontSizeChange: (size: FontSize) => void;
  onFontFamilyChange: (family: string) => void;
}

const StyleControls: React.FC<StyleControlsProps> = ({
  fontSize,
  fontFamily,
  onFontSizeChange,
  onFontFamilyChange,
}) => {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold">Size:</span>
        <div className="flex items-center bg-gray-200 rounded-full p-0.5">
          {fontSizes.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onFontSizeChange(value)}
              className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-colors ${
                fontSize === value
                  ? 'bg-purple-500 text-white'
                  : 'bg-transparent text-gray-600 hover:bg-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="font-family-select" className="text-xs font-bold">
          Style:
        </label>
        <select
          id="font-family-select"
          value={fontFamily}
          onChange={(e) => onFontFamilyChange(e.target.value)}
          className="text-xs bg-gray-100 border-gray-200 border text-gray-900 rounded-full focus:ring-purple-500 focus:border-purple-500 block h-8 px-3"
          style={{ fontFamily: fontFamily }}
        >
          {fontFamilies.map(({ label, value }) => (
            <option key={value} value={value} style={{ fontFamily: value }}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default StyleControls;
