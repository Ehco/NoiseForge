/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Download, Play, X, Info, Layers, Maximize2, RefreshCw, Check, AlertCircle, Upload, Image as ImageIcon, Copy, LayoutGrid, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NoiseWorker from './noise.worker?worker';

// --- Constants & Types ---
const NOISE_TYPES = [
  { id: 'fbm', name: 'fBm / Musgrave' },
  { id: 'perlin', name: 'Perlin (Single Octave)' },
  { id: 'ridged', name: 'Ridged Multifractal' },
  { id: 'billow', name: 'Billow / Puffy Clouds' },
  { id: 'worley_f1', name: 'Worley / Cellular F1' },
  { id: 'worley_f2f1', name: 'Worley F2-F1 (Borders)' },
  { id: 'domain_warp', name: 'Domain Warped fBm' },
  { id: 'swiss', name: 'Swiss Turbulence' },
  { id: 'jordan', name: 'Jordan Multifractal' },
];

const RESOLUTIONS = [
  { id: '30', name: '30 × 30' },
  { id: '128', name: '128 × 128' },
  { id: '256', name: '256 × 256' },
  { id: '512', name: '512 × 512' },
  { id: '1024', name: '1024 × 1024' },
  { id: '2048', name: '2048 × 2048' },
  { id: '4096', name: '4096 × 4096' },
  { id: '8192', name: '8192 × 8192' },
];

const PRESETS = {
  musgrave:  { noiseType: 'fbm', scale: 3, octaves: 8, persistence: 0.55, lacunarity: 2.0, threshold: 0.50, contrast: 3.0, bias: 0.0, spread: 0 },
  rocky:     { noiseType: 'ridged', scale: 4, octaves: 8, persistence: 0.60, lacunarity: 2.2, threshold: 0.45, contrast: 5.0, bias: 0.05, spread: 0 },
  islands:   { noiseType: 'fbm', scale: 2.5, octaves: 6, persistence: 0.65, lacunarity: 1.8, threshold: 0.50, contrast: 12.0, bias: 0.1, spread: 8 },
  cells:     { noiseType: 'worley_f1', scale: 6, octaves: 1, persistence: 0.5, lacunarity: 2.0, threshold: 0.40, contrast: 6.0, bias: 0.0, spread: 3 },
  swirls:    { noiseType: 'domain_warp', scale: 3, octaves: 8, persistence: 0.55, lacunarity: 2.0, threshold: 0.50, contrast: 4.0, bias: 0.0, spread: 0 },
  crater:    { noiseType: 'worley_f2f1', scale: 5, octaves: 1, persistence: 0.5, lacunarity: 2.0, threshold: 0.35, contrast: 8.0, bias: 0.05, spread: 5 },
  clouds:    { noiseType: 'billow', scale: 2.5, octaves: 7, persistence: 0.60, lacunarity: 2.0, threshold: 0.52, contrast: 2.5, bias: 0.0, spread: 0 },
  fine:      { noiseType: 'fbm', scale: 7, octaves: 10, persistence: 0.45, lacunarity: 2.5, threshold: 0.50, contrast: 2.0, bias: 0.0, spread: 0 },
};

interface NoiseParams {
  noiseType: string;
  width: number;
  height: number;
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  threshold: number;
  contrast: number;
  bias: number;
  spread: number;
  seed: number;
  invert: boolean;
  seamless: boolean;
  imageIntensity: number;
  noiseIntensity: number;
}

interface BatchSettings {
  enabled: boolean;
  count: number;
  randomizeSeed: boolean;
  randomizeThreshold: boolean;
  randomizeContrast: boolean;
  randomizeBias: boolean;
  randomizeSpread: boolean;
}

const DEFAULT_PARAMS: NoiseParams = {
  noiseType: 'fbm',
  width: 512,
  height: 512,
  scale: 3.0,
  octaves: 8,
  persistence: 0.55,
  lacunarity: 2.0,
  threshold: 0.50,
  contrast: 3.0,
  bias: 0.0,
  spread: 0,
  seed: 42,
  invert: false,
  seamless: true,
  imageIntensity: 1.0,
  noiseIntensity: 1.0,
};

export default function App() {
  const [params, setParams] = useState<NoiseParams>(DEFAULT_PARAMS);

  const [batchSettings, setBatchSettings] = useState<BatchSettings>({
    enabled: false,
    count: 4,
    randomizeSeed: true,
    randomizeThreshold: false,
    randomizeContrast: false,
    randomizeBias: false,
    randomizeSpread: false,
  });

  const [batchResults, setBatchResults] = useState<any[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('READY — ADJUST PARAMS AND GENERATE');
  const [statText, setStatText] = useState('Configure and generate');
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [previewInfo, setPreviewInfo] = useState('512 × 512 PREVIEW');
  const [baseImage, setBaseImage] = useState<Uint8Array | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const updateParam = (key: keyof NoiseParams, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const resetParam = (key: keyof NoiseParams) => {
    setParams(prev => ({ ...prev, [key]: DEFAULT_PARAMS[key] }));
  };

  const updateBatchSetting = (key: keyof BatchSettings, value: any) => {
    setBatchSettings(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    setParams(prev => ({ ...prev, ...preset }));
  };

  const processImage = async (file: File) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    setImagePreview(img.src);
    await new Promise(resolve => img.onload = resolve);

    const canvas = document.createElement('canvas');
    // We'll process the image at the current resolution
    canvas.width = params.width;
    canvas.height = params.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, params.width, params.height);
    const imageData = ctx.getImageData(0, 0, params.width, params.height);
    const grayscale = new Uint8Array(params.width * params.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Grayscale conversion: 0.299R + 0.587G + 0.114B
      grayscale[i / 4] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
    }
    
    setBaseImage(grayscale);
  };

  const generate = useCallback(async (forceResolution?: { w: number, h: number }) => {
    const w = forceResolution?.w ?? params.width;
    const h = forceResolution?.h ?? params.height;

    if (w * h > 16384 * 16384) {
      setStatus('RESOLUTION TOO HIGH');
      setStatText('Resolutions above 16k may crash the browser. Proceed with caution.');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    
    if (batchSettings.enabled && !forceResolution) {
      setStatus(`BATCH GENERATING ${batchSettings.count} IMAGES`);
      setStatText(`Generating ${batchSettings.count} variations...`);
      setBatchResults([]);
      
      const results: any[] = [];
      for (let i = 0; i < batchSettings.count; i++) {
        const variationParams = { ...params };
        if (batchSettings.randomizeSeed) variationParams.seed = Math.floor(Math.random() * 1000000);
        if (batchSettings.randomizeThreshold) variationParams.threshold = Math.random();
        if (batchSettings.randomizeContrast) variationParams.contrast = Math.random() * 6; // Adjusted for new range
        if (batchSettings.randomizeBias) variationParams.bias = -0.45 + Math.random() * 0.9;
        if (batchSettings.randomizeSpread) variationParams.spread = Math.floor(Math.random() * 48);

        try {
          const result = await new Promise<any>((resolve, reject) => {
            const worker = new NoiseWorker();
            worker.onmessage = (e) => {
              if (e.data.type === 'done') {
                const { rgba, width, height } = e.data;
                // Convert to dataURL for preview
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const id = new ImageData(new Uint8ClampedArray(rgba), width, height);
                  ctx.putImageData(id, 0, 0);
                  const dataUrl = canvas.toDataURL();
                  worker.terminate();
                  resolve({ ...e.data, dataUrl, params: variationParams });
                }
              }
            };
            worker.onerror = (err) => {
              worker.terminate();
              reject(err);
            };
            worker.postMessage({ ...variationParams, width: w, height: h, baseImage });
          });
          results.push(result);
          setBatchResults([...results]);
          setProgress((i + 1) / batchSettings.count);
        } catch (err) {
          console.error('Batch worker error:', err);
        }
      }
      
      setIsGenerating(false);
      setStatus(`BATCH DONE // ${batchSettings.count} IMAGES`);
      setStatText(`Generated ${batchSettings.count} variations`);
      return;
    }

    // Single generation
    setStatus(`GENERATING ${w}×${h} // ${params.noiseType.toUpperCase()}`);
    setStatText(`${w}×${h} — this may take a moment...`);

    const t0 = performance.now();
    
    if (workerRef.current) workerRef.current.terminate();
    
    const worker = new NoiseWorker();
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setProgress(msg.progress);
        return;
      }
      if (msg.type === 'done') {
        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
        const { rgba, width, height } = msg;

        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const pw = Math.min(width, 512);
          const ph = Math.min(height, 512);
          canvas.width = pw;
          canvas.height = ph;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              const id = new ImageData(rgba, width, height);
              tempCtx.putImageData(id, 0, 0);
              ctx.drawImage(tempCanvas, 0, 0, pw, ph);
            }
          }
        }

        setCurrentResult(msg);
        setIsGenerating(false);
        setProgress(1);
        setStatus(`DONE // ${width}×${height} // ${elapsed}s`);
        setStatText(`Generated in ${elapsed}s — ready to download`);
        setPreviewInfo(`${Math.min(width, 512)}×${Math.min(height, 512)} PREVIEW (FULL: ${width}×${height})`);
        
        setTimeout(() => setProgress(0), 1000);
      }
    };

    worker.onerror = (err) => {
      console.error('Worker error:', err);
      setIsGenerating(false);
      setStatus('ERROR — CHECK CONSOLE');
      setStatText('An error occurred during generation');
      setProgress(0);
    };

    worker.postMessage({ 
      ...params, 
      width: w, 
      height: h, 
      baseImage: baseImage 
    });
  }, [params, isGenerating, baseImage, batchSettings]);

  // Live updates with debounce
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    // For live updates, we generate at a lower resolution if the target is high
    const liveW = params.width > 1024 ? 512 : params.width;
    const liveH = params.height > 1024 ? 512 : params.height;

    debounceTimer.current = setTimeout(() => {
      generate({ w: liveW, h: liveH });
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [
    params.noiseType, 
    params.scale, 
    params.octaves, 
    params.persistence, 
    params.lacunarity, 
    params.threshold, 
    params.contrast, 
    params.bias, 
    params.spread, 
    params.seed, 
    params.invert, 
    params.seamless,
    params.imageIntensity,
    params.noiseIntensity,
    baseImage
  ]);

  const downloadPNG = async (result?: any) => {
    const target = result || currentResult;
    if (!target) return;
    const { rgba, width, height, params: resParams } = target;
    setStatText('Encoding PNG...');

    const offC = document.createElement('canvas');
    offC.width = width;
    offC.height = height;
    const offCtx = offC.getContext('2d');
    if (!offCtx) return;

    const id = new ImageData(new Uint8ClampedArray(rgba), width, height);
    offCtx.putImageData(id, 0, 0);

    offC.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const seed = resParams?.seed ?? params.seed;
      const type = resParams?.noiseType ?? params.noiseType;
      a.download = `noiseforge_${type}_${width}x${height}_s${seed}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setStatText(`Saved ${width}×${height} PNG`);
    }, 'image/png');
  };

  const downloadAllBatch = async () => {
    for (const res of batchResults) {
      await downloadPNG(res);
      // Small delay to prevent browser from blocking multiple downloads
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#080808] text-[#b8b8b8] font-sans overflow-hidden selection:bg-[#c8a030] selection:text-black">
      {/* Header */}
      <header className="h-11 bg-[#0e0e0e] border-b border-[#262626] flex items-center px-4 gap-5 shrink-0 z-20">
        <div className="font-bold text-lg tracking-[3px] uppercase text-[#c8a030]">
          Noise<span className="text-[#606060] font-light">Forge</span>
        </div>
        <div className="ml-auto font-mono text-[11px] text-[#606060] tracking-wider uppercase">
          {status}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-[#0e0e0e] border-r border-[#262626] overflow-y-auto shrink-0 flex flex-col scrollbar-thin scrollbar-thumb-[#262626] scrollbar-track-transparent">
          
          {/* Noise Type & Presets */}
          <section className="p-4 border-b border-[#1a1a1a]">
            <h3 className="font-mono text-[9px] tracking-[2px] uppercase text-[#7a5f18] mb-3 flex items-center gap-2">
              <Layers size={10} /> Noise Type
            </h3>
            <select 
              value={params.noiseType}
              onChange={(e) => updateParam('noiseType', e.target.value)}
              className="w-full bg-[#141414] text-[#f0f0f0] border border-[#262626] p-2 font-mono text-xs outline-none focus:border-[#c8a030] cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%22http://www.w3.org/2000/svg%22_width=%2210%22_height=%226%22%3E%3Cpath_d=%22M0_0l5_6_5-6z%22_fill=%22%23606060%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_10px_center]"
            >
              {NOISE_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <h3 className="font-mono text-[9px] tracking-[2px] uppercase text-[#7a5f18] mt-5 mb-3">Presets</h3>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PRESETS).map(pk => (
                <button 
                  key={pk}
                  onClick={() => applyPreset(pk as any)}
                  className="px-2 py-1 font-mono text-[9px] tracking-wider bg-[#1c1c1c] border border-[#262626] text-[#606060] hover:border-[#c8a030] hover:text-[#c8a030] transition-colors uppercase"
                >
                  {pk}
                </button>
              ))}
            </div>
          </section>

          {/* Resolution */}
          <section className="p-4 border-b border-[#1a1a1a]">
            <h3 className="font-mono text-[9px] tracking-[2px] uppercase text-[#7a5f18] mb-3 flex items-center gap-2">
              <Maximize2 size={10} /> Resolution
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <span className="text-[9px] uppercase text-[#606060] block mb-1">Width</span>
                <input 
                  type="number" 
                  value={params.width}
                  onChange={(e) => updateParam('width', parseInt(e.target.value) || 1)}
                  className="w-full bg-[#141414] text-[#f0f0f0] border border-[#262626] p-2 font-mono text-xs outline-none focus:border-[#c8a030]"
                />
              </div>
              <div>
                <span className="text-[9px] uppercase text-[#606060] block mb-1">Height</span>
                <input 
                  type="number" 
                  value={params.height}
                  onChange={(e) => updateParam('height', parseInt(e.target.value) || 1)}
                  className="w-full bg-[#141414] text-[#f0f0f0] border border-[#262626] p-2 font-mono text-xs outline-none focus:border-[#c8a030]"
                />
              </div>
            </div>
            <select 
              onChange={(e) => {
                const res = parseInt(e.target.value);
                updateParam('width', res);
                updateParam('height', res);
              }}
              className="w-full bg-[#141414] text-[#f0f0f0] border border-[#262626] p-2 font-mono text-xs outline-none focus:border-[#c8a030] cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%22http://www.w3.org/2000/svg%22_width=%2210%22_height=%226%22%3E%3Cpath_d=%22M0_0l5_6_5-6z%22_fill=%22%23606060%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_10px_center]"
            >
              <option value="">Quick Presets...</option>
              {RESOLUTIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </section>

          {/* Image Import */}
          <section className="p-4 border-b border-[#1a1a1a]">
            <h3 className="font-mono text-[9px] tracking-[2px] uppercase text-[#7a5f18] mb-3 flex items-center gap-2">
              <ImageIcon size={10} /> Image Heightmap
            </h3>
            <div className="flex flex-col gap-3">
              <label className="w-full cursor-pointer group">
                <div className="w-full border border-dashed border-[#262626] group-hover:border-[#c8a030] p-4 flex flex-col items-center justify-center gap-2 transition-colors">
                  <Upload size={16} className="text-[#606060] group-hover:text-[#c8a030]" />
                  <span className="text-[10px] uppercase tracking-wider text-[#606060]">Import Image</span>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])}
                />
              </label>

              {imagePreview && (
                <div className="relative group">
                  <img src={imagePreview} alt="Preview" className="w-full h-24 object-cover border border-[#262626]" />
                  <button 
                    onClick={() => { setBaseImage(null); setImagePreview(null); }}
                    className="absolute top-1 right-1 bg-black/80 p-1 text-[#606060] hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-[#606060]">Image Intensity</span>
                    <span className="font-mono text-[10px] text-[#c8a030]">{params.imageIntensity.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.01"
                    value={params.imageIntensity}
                    onChange={(e) => updateParam('imageIntensity', parseFloat(e.target.value))}
                    onDoubleClick={() => resetParam('imageIntensity')}
                    className="w-full h-0.5 bg-[#262626] appearance-none outline-none cursor-pointer accent-[#c8a030]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-[#606060]">Noise Intensity</span>
                    <span className="font-mono text-[10px] text-[#c8a030]">{params.noiseIntensity.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.01"
                    value={params.noiseIntensity}
                    onChange={(e) => updateParam('noiseIntensity', parseFloat(e.target.value))}
                    onDoubleClick={() => resetParam('noiseIntensity')}
                    className="w-full h-0.5 bg-[#262626] appearance-none outline-none cursor-pointer accent-[#c8a030]"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Parameters */}
          <section className="p-4 border-b border-[#1a1a1a]">
            <h3 className="font-mono text-[9px] tracking-[2px] uppercase text-[#7a5f18] mb-4 flex items-center gap-2">
              <Settings size={10} /> Noise Parameters
            </h3>
            
            {[
              { label: 'Scale', key: 'scale', min: 0, max: 6, step: 0.1, dec: 1 },
              { label: 'Octaves', key: 'octaves', min: 4, max: 12, step: 1, dec: 0 },
              { label: 'Persistence', key: 'persistence', min: 0.15, max: 0.95, step: 0.01, dec: 2 },
              { label: 'Lacunarity', key: 'lacunarity', min: 0, max: 4.0, step: 0.05, dec: 2 },
            ].map(ctrl => (
              <div key={ctrl.key} className="mb-4 last:mb-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-[#b8b8b8]">{ctrl.label}</span>
                  <span className="font-mono text-[10px] text-[#c8a030]">{(params as any)[ctrl.key].toFixed(ctrl.dec)}</span>
                </div>
                <input 
                  type="range" 
                  min={ctrl.min} 
                  max={ctrl.max} 
                  step={ctrl.step}
                  value={(params as any)[ctrl.key]}
                  onChange={(e) => updateParam(ctrl.key as any, parseFloat(e.target.value))}
                  onDoubleClick={() => resetParam(ctrl.key as any)}
                  className="w-full h-0.5 bg-[#262626] appearance-none outline-none cursor-pointer accent-[#c8a030]"
                />
              </div>
            ))}

            <div className="mt-4">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#b8b8b8] block mb-1">Seed</span>
              <input 
                type="number" 
                value={params.seed}
                onChange={(e) => updateParam('seed', parseInt(e.target.value) || 0)}
                className="w-full bg-[#141414] text-[#f0f0f0] border border-[#262626] p-1.5 font-mono text-xs outline-none focus:border-[#c8a030]"
              />
            </div>
          </section>

          {/* Island / Clustering */}
          <section className="p-4 border-b border-[#1a1a1a]">
            <h3 className="font-mono text-[9px] tracking-[2px] uppercase text-[#7a5f18] mb-4">Island / Clustering</h3>
            {[
              { label: 'Threshold', key: 'threshold', min: 0.0, max: 1.0, step: 0.01, dec: 2 },
              { label: 'Island Contrast', key: 'contrast', min: 0, max: 6, step: 0.1, dec: 1 },
              { label: 'Bias (B↔W)', key: 'bias', min: -0.45, max: 0.45, step: 0.01, dec: 2 },
              { label: 'Island Spread', key: 'spread', min: 0, max: 48, step: 1, dec: 0 },
            ].map(ctrl => (
              <div key={ctrl.key} className="mb-4 last:mb-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-[#b8b8b8]">{ctrl.label}</span>
                  <span className="font-mono text-[10px] text-[#c8a030]">{(params as any)[ctrl.key].toFixed(ctrl.dec)}</span>
                </div>
                <input 
                  type="range" 
                  min={ctrl.min} 
                  max={ctrl.max} 
                  step={ctrl.step}
                  value={(params as any)[ctrl.key]}
                  onChange={(e) => updateParam(ctrl.key as any, parseFloat(e.target.value))}
                  onDoubleClick={() => resetParam(ctrl.key as any)}
                  className="w-full h-0.5 bg-[#262626] appearance-none outline-none cursor-pointer accent-[#c8a030]"
                />
              </div>
            ))}
          </section>

          {/* Options */}
          <section className="p-4 border-b border-[#1a1a1a]">
            <h3 className="font-mono text-[9px] tracking-[2px] uppercase text-[#7a5f18] mb-3">Options</h3>
            {[
              { label: 'Seamless Tiling', key: 'seamless' },
              { label: 'Invert Colors', key: 'invert' },
            ].map(opt => (
              <div key={opt.key} className="flex items-center justify-between mb-2 last:mb-0">
                <span className="text-[11px] font-semibold tracking-wider uppercase">{opt.label}</span>
                <button 
                  onClick={() => updateParam(opt.key as any, !(params as any)[opt.key])}
                  className={`relative w-8 h-4 transition-colors duration-200 ${ (params as any)[opt.key] ? 'bg-[#7a5f18]' : 'bg-[#262626]' }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-[#606060] transition-transform duration-200 ${ (params as any)[opt.key] ? 'translate-x-4 bg-[#c8a030]' : '' }`} />
                </button>
              </div>
            ))}
          </section>

          {/* Batch Generation */}
          <section className="p-4 border-b border-[#1a1a1a]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-[9px] tracking-[2px] uppercase text-[#7a5f18] flex items-center gap-2">
                <LayoutGrid size={10} /> Batch Mode
              </h3>
              <button 
                onClick={() => updateBatchSetting('enabled', !batchSettings.enabled)}
                className={`relative w-8 h-4 transition-colors duration-200 ${ batchSettings.enabled ? 'bg-[#7a5f18]' : 'bg-[#262626]' }`}
              >
                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-[#606060] transition-transform duration-200 ${ batchSettings.enabled ? 'translate-x-4 bg-[#c8a030]' : '' }`} />
              </button>
            </div>

            {batchSettings.enabled && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="overflow-hidden space-y-3"
              >
                <div>
                  <span className="text-[10px] uppercase text-[#606060] block mb-1">Batch Size</span>
                  <div className="flex gap-1">
                    {[4, 8, 12, 16].map(n => (
                      <button 
                        key={n}
                        onClick={() => updateBatchSetting('count', n)}
                        className={`flex-1 py-1 font-mono text-[10px] border ${batchSettings.count === n ? 'border-[#c8a030] text-[#c8a030]' : 'border-[#262626] text-[#606060]'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase text-[#606060] block">Randomize Fields</span>
                  {[
                    { label: 'Seed', key: 'randomizeSeed' },
                    { label: 'Threshold', key: 'randomizeThreshold' },
                    { label: 'Contrast', key: 'randomizeContrast' },
                    { label: 'Bias', key: 'randomizeBias' },
                    { label: 'Spread', key: 'randomizeSpread' },
                  ].map(field => (
                    <label key={field.key} className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={(batchSettings as any)[field.key]}
                        onChange={(e) => updateBatchSetting(field.key as any, e.target.checked)}
                        className="hidden"
                      />
                      <div className={`w-3 h-3 border flex items-center justify-center transition-colors ${ (batchSettings as any)[field.key] ? 'border-[#c8a030] bg-[#c8a030]/10' : 'border-[#262626]' }`}>
                        { (batchSettings as any)[field.key] && <Check size={8} className="text-[#c8a030]" /> }
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider transition-colors ${ (batchSettings as any)[field.key] ? 'text-[#c8a030]' : 'text-[#606060] group-hover:text-[#b8b8b8]' }`}>
                        {field.label}
                      </span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}
          </section>

          {/* Action Buttons */}
          <section className="p-4 mt-auto flex flex-col gap-2">
            <button 
              onClick={() => generate()}
              className={`w-full py-2.5 font-bold text-xs tracking-[2px] uppercase transition-all flex items-center justify-center gap-2 ${
                isGenerating ? 'bg-[#4a2020] text-[#f0a0a0]' : 'bg-[#c8a030] text-black hover:bg-[#f0f0f0]'
              }`}
            >
              {isGenerating ? <><X size={14} /> Cancel</> : <><Play size={14} /> {batchSettings.enabled ? 'Generate Batch' : 'Full Render'}</>}
            </button>
            {batchSettings.enabled && batchResults.length > 0 ? (
              <button 
                onClick={downloadAllBatch}
                disabled={isGenerating}
                className="w-full py-2.5 font-bold text-xs tracking-[2px] uppercase border border-[#262626] text-[#b8b8b8] hover:border-[#c8a030] hover:text-[#c8a030] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Download size={14} /> Download All ({batchResults.length})
              </button>
            ) : (
              <button 
                onClick={() => downloadPNG()}
                disabled={!currentResult || isGenerating}
                className="w-full py-2.5 font-bold text-xs tracking-[2px] uppercase border border-[#262626] text-[#b8b8b8] hover:border-[#c8a030] hover:text-[#c8a030] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Download size={14} /> Download PNG
              </button>
            )}
            <div className="font-mono text-[10px] text-[#606060] text-center mt-1">
              {statText}
            </div>
          </section>
        </aside>

        {/* Preview Area */}
        <section className="flex-1 flex flex-col items-center justify-center relative overflow-hidden p-8">
          {/* Grid Background */}
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(#1a1a1a_1px,transparent_1px),linear-gradient(90deg,#1a1a1a_1px,transparent_1px)] bg-[size:40px_40px]" />
          
          {batchSettings.enabled && batchResults.length > 0 ? (
            <div className="w-full h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[#262626] scrollbar-track-transparent pr-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {batchResults.map((res, idx) => (
                  <div key={idx} className="relative group bg-[#0e0e0e] border border-[#262626] p-2 flex flex-col gap-2">
                    <div className="relative aspect-square overflow-hidden bg-black">
                      <img 
                        src={res.dataUrl}
                        alt={`Variation ${idx}`}
                        className="w-full h-full object-contain [image-rendering:pixelated]"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <button 
                          onClick={() => downloadPNG(res)}
                          className="px-3 py-1.5 bg-[#c8a030] text-black font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 hover:bg-white transition-colors"
                        >
                          <Download size={12} /> Save
                        </button>
                        <button 
                          onClick={() => {
                            setParams({ ...params, ...res.params });
                            setBatchSettings({ ...batchSettings, enabled: false });
                          }}
                          className="px-3 py-1.5 bg-[#1c1c1c] text-[#c8a030] border border-[#c8a030] font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 hover:bg-[#c8a030] hover:text-black transition-colors"
                        >
                          <Copy size={12} /> Apply
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center font-mono text-[9px] text-[#606060]">
                      <span>S: {res.params.seed}</span>
                      <span>T: {res.params.threshold.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative max-w-[calc(100%-60px)] max-h-[calc(100%-100px)] group">
              <canvas 
                ref={canvasRef}
                className="block max-w-full max-h-full border border-[#262626] shadow-[0_0_40px_rgba(0,0,0,0.8)] [image-rendering:pixelated]"
              />
              <div className="absolute -bottom-6 right-0 font-mono text-[10px] text-[#606060]">
                {previewInfo}
              </div>
            </div>
          )}

          {/* Overlays */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#080808]/85 border border-[#7a5f18] px-4 py-2 font-mono text-xs text-[#c8a030] tracking-[2px] uppercase z-10"
              >
                Generating...
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 h-0.5 bg-[#c8a030] transition-[width] duration-75 ease-linear z-30" style={{ width: `${progress * 100}%` }} />
        </section>
      </main>
    </div>
  );
}
