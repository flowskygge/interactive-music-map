import React from 'react';

interface VirtualPianoProps {
  onNoteOn: (pitch: number) => void;
  onNoteOff: (pitch: number) => void;
  activePitches: Set<number>;
  disabled?: boolean;
}

const whiteKeys = [
  { pitch: 60, label: 'C4' }, { pitch: 62, label: 'D4' }, { pitch: 64, label: 'E4' },
  { pitch: 65, label: 'F4' }, { pitch: 67, label: 'G4' }, { pitch: 69, label: 'A4' },
  { pitch: 71, label: 'B4' }, { pitch: 72, label: 'C5' }
];

const blackKeyInfo: { [key: number]: { left: string, name: string } } = {
  61: { left: '9.375%', name: 'C♯4' }, 63: { left: '21.875%', name: 'D♯4' },
  66: { left: '46.875%', name: 'F♯4' }, 68: { left: '59.375%', name: 'G♯4' }, 70: { left: '71.875%', name: 'A♯4' }
};
const blackKeys = Object.entries(blackKeyInfo).map(([pitch, info]) => ({ pitch: parseInt(pitch), ...info }));


export const VirtualPiano: React.FC<VirtualPianoProps> = ({ onNoteOn, onNoteOff, disabled, activePitches }) => {

  const handleMouseDown = (pitch: number) => {
    if (disabled) return;
    onNoteOn(pitch);
  };

  const handleMouseUp = (pitch: number) => {
    if (disabled) return;
    onNoteOff(pitch);
  };

  const handleMouseLeave = (pitch: number) => {
    if (activePitches.has(pitch)) {
      handleMouseUp(pitch);
    }
  };

  return (
    <div className="relative h-28 w-full select-none" role="toolbar" aria-label="Virtual Piano">
      {whiteKeys.map((key, index) => (
        <button
          key={key.pitch}
          onMouseDown={() => handleMouseDown(key.pitch)}
          onMouseUp={() => handleMouseUp(key.pitch)}
          onMouseLeave={() => handleMouseLeave(key.pitch)}
          disabled={disabled}
          className={`absolute h-full w-[12.5%] border border-gray-500 rounded-b-md transition-colors ${activePitches.has(key.pitch) ? 'bg-indigo-400' : 'bg-gray-200'} hover:bg-gray-300 disabled:bg-gray-500 disabled:opacity-50`}
          style={{ left: `${index * 12.5}%` }}
          aria-label={`Piano key ${key.label}`}
        >
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-gray-700 font-sans">{key.label}</span>
        </button>
      ))}
      {blackKeys.map(key => (
        <button
          key={key.pitch}
          onMouseDown={() => handleMouseDown(key.pitch)}
          onMouseUp={() => handleMouseUp(key.pitch)}
          onMouseLeave={() => handleMouseLeave(key.pitch)}
          disabled={disabled}
          className={`absolute h-2/3 w-[6.25%] bg-gray-800 border border-gray-900 rounded-b transition-colors z-10 ${activePitches.has(key.pitch) ? 'bg-indigo-600' : 'bg-gray-800'} hover:bg-gray-700 disabled:bg-gray-600 disabled:opacity-50`}
          style={{ left: key.left }}
          aria-label={`Piano key ${key.name}`}
        ></button>
      ))}
    </div>
  );
};
