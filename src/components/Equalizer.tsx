import { useState } from 'react';
import { setEQ } from '@/lib/audioEngine';

export function Equalizer() {
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);

  const handleChange = (type: 'bass' | 'mid' | 'treble', val: number) => {
    if (type === 'bass') setBass(val);
    if (type === 'mid') setMid(val);
    if (type === 'treble') setTreble(val);
    setEQ(bass, mid, treble);
  };

  return (
    <div className="glass rounded-glass p-4 mt-4 space-y-4">
      <h3 className="font-semibold text-white">Equalizer</h3>
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