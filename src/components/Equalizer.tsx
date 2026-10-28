import { useState } from 'react';
import { setEQ } from '@/lib/audioEngine';

const PRESETS = {
  Flat: { bass: 0, mid: 0, treble: 0 },
  'Bass Boost': { bass: 8, mid: -2, treble: 0 },
  Vocal: { bass: -2, mid: 5, treble: 2 },
  Rock: { bass: 5, mid: -1, treble: 4 },
  Electronic: { bass: 6, mid: 0, treble: 5 },
};

export function Equalizer() {
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const [activePreset, setActivePreset] = useState('Flat');

  const handleChange = (type: 'bass' | 'mid' | 'treble', val: number) => {
    const newBass = type === 'bass' ? val : bass;
    const newMid = type === 'mid' ? val : mid;
    const newTreble = type === 'treble' ? val : treble;

    if (type === 'bass') setBass(val);
    if (type === 'mid') setMid(val);
    if (type === 'treble') setTreble(val);
    
    setEQ(newBass, newMid, newTreble); // Menggunakan nilai terbaru
    setActivePreset('Custom');
  };

  const applyPreset = (name: keyof typeof PRESETS) => {
    const p = PRESETS[name];
    setBass(p.bass);
    setMid(p.mid);
    setTreble(p.treble);
    setEQ(p.bass, p.mid, p.treble);
    setActivePreset(name);
  };

  return (
    <div className="glass rounded-glass p-4 mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Equalizer</h3>
        <span className="text-xs text-accent font-medium">{activePreset}</span>
      </div>
      
      {/* Tombol Presets */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((preset) => (
          <button
            key={preset}
            onClick={() => applyPreset(preset)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium tap transition-colors ${
              activePreset === preset ? 'bg-accent text-black' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-white/60 flex justify-between mb-1"><span>Bass</span><span>{bass} dB</span></label>
        <input type="range" min="-10" max="10" step="1" value={bass} onChange={(e) => handleChange('bass', Number(e.target.value))} className="w-full accent-accent" />
      </div>
      <div>
        <label className="text-xs text-white/60 flex justify-between mb-1"><span>Mid</span><span>{mid} dB</span></label>
        <input type="range" min="-10" max="10" step="1" value={mid} onChange={(e) => handleChange('mid', Number(e.target.value))} className="w-full accent-accent" />
      </div>
      <div>
        <label className="text-xs text-white/60 flex justify-between mb-1"><span>Treble</span><span>{treble} dB</span></label>
        <input type="range" min="-10" max="10" step="1" value={treble} onChange={(e) => handleChange('treble', Number(e.target.value))} className="w-full accent-accent" />
      </div>
    </div>
  );
}