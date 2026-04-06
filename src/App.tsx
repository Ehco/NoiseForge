/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Download, Play, X, Info, Layers, Maximize2, RefreshCw, Check, AlertCircle, Upload, Image as ImageIcon, Copy, LayoutGrid, Trash2, Plus, Minus } from 'lucide-react';
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
  musgrave:  { noiseType: 'fbm', scale: 3, octaves: 24, persistence: 0.55, lacunarity: 2.0, threshold: 0.50, contrast: 3.0, bias: 0.0, spread: 0 },
  rocky:     { noiseType: 'ridged', scale: 4, octaves: 24, persistence: 0.60, lacunarity: 2.2, threshold: 0.45, contrast: 5.0, bias: 0.05, spread: 0 },
  islands:   { noiseType: 'fbm', scale: 2.5, octaves: 16, persistence: 0.65, lacunarity: 1.8, threshold: 0.50, contrast: 12.0, bias: 0.1, spread: 8 },
  cells:     { noiseType: 'worley_f1', scale: 6, octaves: 1, persistence: 0.5, lacunarity: 2.0, threshold: 0.40, contrast: 6.0, bias: 0.0, spread: 3 },
  swirls:    { noiseType: 'domain_warp', scale: 3, octaves: 24, persistence: 0.55, lacunarity: 2.0, threshold: 0.50, contrast: 4.0, bias: 0.0, spread: 0 },
  crater:    { noiseType: 'worley_f2f1', scale: 5, octaves: 1, persistence: 0.5, lacunarity: 2.0, threshold: 0.35, contrast: 8.0, bias: 0.05, spread: 5 },
  clouds:    { noiseType: 'billow', scale: 2.5, octaves: 24, persistence: 0.60, lacunarity: 2.0, threshold: 0.52, contrast: 2.5, bias: 0.0, spread: 0 },
  fine:      { noiseType: 'fbm', scale: 7, octaves: 24, persistence: 0.45, lacunarity: 2.5, threshold: 0.50, contrast: 2.0, bias: 0.0, spread: 0 },
  nebula:    { noiseType: 'swiss', scale: 1.5, octaves: 24, persistence: 0.7, lacunarity: 2.1, threshold: 0.48, contrast: 15, bias: 0.0, spread: 0 },
  topography:{ noiseType: 'ridged', scale: 0.8, octaves: 24, persistence: 0.5, lacunarity: 2.0, threshold: 0.5, contrast: 80, bias: 0.0, spread: 0 },
  plasma:    { noiseType: 'jordan', scale: 2.0, octaves: 24, persistence: 0.6, lacunarity: 2.0, threshold: 0.5, contrast: 10, bias: 0.0, spread: 0 },
  marble:    { noiseType: 'domain_warp', scale: 0.5, octaves: 24, persistence: 0.5, lacunarity: 2.0, threshold: 0.5, contrast: 25, bias: 0.0, spread: 0 },
  static:    { noiseType: 'perlin', scale: 50, octaves: 1, persistence: 0.5, lacunarity: 2.0, threshold: 0.5, contrast: 1, bias: 0.0, spread: 0 },
};

interface NoiseLayer {
  id: string;
  noiseType: string;
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  seed: number;
  intensity: number;
  blendMode: 'normal' | 'add' | 'subtract' | 'multiply' | 'screen' | 'overlay';
  invert: boolean;
  visible: boolean;
}

interface NoiseParams {
  width: number;
  height: number;
  layers: NoiseLayer[];
  threshold: number;
  contrast: number;
  bias: number;
  spread: number;
  seamless: boolean;
  invert: boolean;
  imageIntensity: number;
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

const DEFAULT_LAYER: NoiseLayer = {
  id: '1',
  noiseType: 'fbm',
  scale: 3.0,
  octaves: 24,
  persistence: 0.55,
  lacunarity: 2.0,
  seed: 42,
  intensity: 1.0,
  blendMode: 'normal',
  invert: false,
  visible: true,
};

const DEFAULT_PARAMS: NoiseParams = {
  width: 512,
  height: 512,
  layers: [DEFAULT_LAYER],
  threshold: 0.50,
  contrast: 3.0,
  bias: 0.0,
  spread: 0,
  seamless: true,
  invert: false,
  imageIntensity: 1.0,
};

// --- Components ---
const Slider = ({ label, value, min, max, step, onChange, onReset, defaultValue, tooltip, dec = 2 }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());

  useEffect(() => {
    if (!isEditing) setTempValue(value.toString());
  }, [value, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const val = parseFloat(tempValue);
    if (!isNaN(val)) onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setTempValue(value.toString());
    }
  };

  return (
    <div className="space-y-1.5 group/slider">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[#606060] group-hover/slider:text-[#b8b8b8] transition-colors">{label}</span>
          {tooltip && (
            <div className="relative group/tooltip">
              <Info size={10} className="text-[#333] group-hover/tooltip:text-[#606060] transition-colors cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#1a1a1a] border border-[#333] text-[9px] text-[#b8b8b8] rounded shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none leading-relaxed">
                {tooltip}
              </div>
            </div>
          )}
        </div>
        {isEditing ? (
          <input
            type="text"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="text-[10px] font-mono text-white bg-[#1a1a1a] border border-[#c8a030] w-16 text-right px-1 outline-none"
          />
        ) : (
          <span 
            className="text-[10px] font-mono text-[#c8a030] cursor-pointer hover:text-white transition-colors"
            onDoubleClick={onReset}
            onClick={() => setIsEditing(true)}
            title="Click to edit, Double-click to reset"
          >
            {value.toFixed(dec)}
          </span>
        )}
      </div>
      <div className="relative h-4 flex items-center">
        {defaultValue !== undefined && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 bg-[#333] pointer-events-none z-0"
            style={{ left: `${Math.max(0, Math.min(100, ((defaultValue - min) / (max - min)) * 100))}%` }}
          />
        )}
        <input 
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer accent-[#c8a030] hover:accent-[#f0f0f0] transition-all relative z-10"
        />
      </div>
    </div>
  );
};

const CollapsibleSection = ({ isOpen, onToggle, title, icon: Icon, children }: any) => {
  return (
    <div className="border-b border-[#1a1a1a]">
      <button 
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-[#111] transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Icon size={12} className={isOpen ? 'text-[#c8a030]' : 'text-[#606060]'} />
          <h3 className={`font-mono text-[9px] tracking-[2px] uppercase transition-colors ${isOpen ? 'text-[#c8a030]' : 'text-[#606060] group-hover:text-[#b8b8b8]'}`}>
            {title}
          </h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <Plus size={10} className={isOpen ? 'text-[#333]' : 'text-[#606060]'} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [params, setParams] = useState<NoiseParams>(DEFAULT_PARAMS);
  const [activeLayerId, setActiveLayerId] = useState<string>('1');
  const [defaultParams, setDefaultParams] = useState<NoiseParams>(DEFAULT_PARAMS);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const previewSectionRef = useRef<HTMLElement>(null);

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

  const [extremeSettings, setExtremeSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('READY — ADJUST PARAMS AND GENERATE');
  const [statText, setStatText] = useState('Configure and generate');
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [previewInfo, setPreviewInfo] = useState('512 × 512 PREVIEW');
  const [baseImage, setBaseImage] = useState<Uint8Array | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    presets: false,
    layers: false,
    activeLayer: false,
    resolution: false,
    heightmap: true,
    postProcess: false,
    batch: true,
  });

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const updateParam = (key: keyof NoiseParams, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const updateBatchSetting = (key: keyof BatchSettings, value: any) => {
    setBatchSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateLayer = (id: string, key: keyof NoiseLayer, value: any) => {
    setParams(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, [key]: value } : l)
    }));
  };

  const addLayer = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newLayer: NoiseLayer = { ...DEFAULT_LAYER, id: newId, seed: Math.floor(Math.random() * 1000000) };
    setParams(prev => ({ ...prev, layers: [...prev.layers, newLayer] }));
    setActiveLayerId(newId);
  };

  const removeLayer = (id: string) => {
    if (params.layers.length <= 1) return;
    setParams(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== id) }));
    if (activeLayerId === id) setActiveLayerId(params.layers[0].id);
  };

  const resetParam = (key: keyof NoiseParams) => {
    setParams(prev => ({ ...prev, [key]: defaultParams[key] }));
  };

  const resetLayerParam = (id: string, key: keyof NoiseLayer) => {
    const defaultLayer = defaultParams.layers.find(l => l.id === id) || DEFAULT_LAYER;
    updateLayer(id, key, (defaultLayer as any)[key]);
  };

  const randomizeAll = () => {
    const newLayers = params.layers.map(l => ({
      ...l,
      noiseType: NOISE_TYPES[Math.floor(Math.random() * NOISE_TYPES.length)].id,
      scale: 0.5 + Math.random() * 10,
      octaves: 1 + Math.floor(Math.random() * 31),
      persistence: 0.2 + Math.random() * 0.7,
      lacunarity: 1.5 + Math.random() * 2,
      seed: Math.floor(Math.random() * 1000000),
      intensity: 0.5 + Math.random() * 0.5,
    }));
    const newParams = {
      ...params,
      layers: newLayers,
      threshold: Math.random(),
      contrast: 1 + Math.random() * 20,
      bias: -0.2 + Math.random() * 0.4,
    };
    setParams(newParams);
    setDefaultParams(newParams); // Set as new default for reset
  };

  const randomizeSeed = (id: string) => {
    updateLayer(id, 'seed', Math.floor(Math.random() * 1000000));
  };

  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    const newLayer = { ...DEFAULT_LAYER, id: activeLayerId, ...preset };
    const newParams = { ...params, layers: params.layers.map(l => l.id === activeLayerId ? newLayer : l), threshold: preset.threshold, contrast: preset.contrast, bias: preset.bias, spread: preset.spread };
    setParams(newParams);
    setDefaultParams(newParams);
  };

  const activeLayer = params.layers.find(l => l.id === activeLayerId) || params.layers[0];

  const processImage = async (file: File) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    setImagePreview(img.src);
    await new Promise(resolve => img.onload = resolve);

    const canvas = document.createElement('canvas');
    canvas.width = params.width;
    canvas.height = params.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, params.width, params.height);
    const imageData = ctx.getImageData(0, 0, params.width, params.height);
    const grayscale = new Uint8Array(params.width * params.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
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
        variationParams.layers = params.layers.map(l => {
          const newLayer = { ...l };
          if (batchSettings.randomizeSeed) newLayer.seed = Math.floor(Math.random() * 1000000);
          return newLayer;
        });
        if (batchSettings.randomizeThreshold) variationParams.threshold = Math.random();
        if (batchSettings.randomizeContrast) variationParams.contrast = Math.random() * (extremeSettings ? 200 : 20);
        if (batchSettings.randomizeBias) variationParams.bias = -0.45 + Math.random() * 0.9;
        if (batchSettings.randomizeSpread) variationParams.spread = Math.floor(Math.random() * (extremeSettings ? 256 : 48));

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
    setStatus(`GENERATING ${w}×${h} // ${params.layers[0].noiseType.toUpperCase()}`);
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
  }, [params, baseImage, batchSettings]);

  const handleInvertToggle = () => {
    const newInvert = !params.invert;
    setParams(prev => ({ ...prev, invert: newInvert }));

    // Instant update for current result
    if (currentResult) {
      const newRgba = new Uint8ClampedArray(currentResult.rgba);
      for (let i = 0; i < newRgba.length; i += 4) {
        newRgba[i] = 255 - newRgba[i];
        newRgba[i+1] = 255 - newRgba[i+1];
        newRgba[i+2] = 255 - newRgba[i+2];
      }
      
      // Update canvas immediately
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const id = new ImageData(newRgba, currentResult.width, currentResult.height);
          const pw = Math.min(currentResult.width, 512);
          const ph = Math.min(currentResult.height, 512);
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = currentResult.width;
          tempCanvas.height = currentResult.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.putImageData(id, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0, pw, ph);
          }
        }
      }
      
      setCurrentResult({ ...currentResult, rgba: newRgba, params: { ...currentResult.params, invert: newInvert } });
    }

    // Instant update for batch results
    if (batchResults.length > 0) {
      const updatedBatch = batchResults.map(res => {
        const newRgba = new Uint8ClampedArray(res.rgba);
        for (let i = 0; i < newRgba.length; i += 4) {
          newRgba[i] = 255 - newRgba[i];
          newRgba[i+1] = 255 - newRgba[i+1];
          newRgba[i+2] = 255 - newRgba[i+2];
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = res.width;
        canvas.height = res.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const id = new ImageData(newRgba, res.width, res.height);
          ctx.putImageData(id, 0, 0);
          return { ...res, rgba: newRgba, dataUrl: canvas.toDataURL(), params: { ...res.params, invert: newInvert } };
        }
        return res;
      });
      setBatchResults(updatedBatch);
    }
  };

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
    params.layers, 
    params.threshold, 
    params.contrast, 
    params.bias, 
    params.spread, 
    params.seamless,
    params.imageIntensity,
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
      const seed = resParams?.layers?.[0]?.seed ?? params.layers[0].seed;
      const type = resParams?.layers?.[0]?.noiseType ?? params.layers[0].noiseType;
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

  const copyParamsToClipboard = (p: NoiseParams) => {
    navigator.clipboard.writeText(JSON.stringify(p, null, 2));
    setStatText('Parameters copied to clipboard');
    setTimeout(() => setStatText(currentResult ? `DONE // ${currentResult.width}×${currentResult.height}` : 'Configure and generate'), 2000);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomSpeed = 0.1;
      const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
      const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
      
      // Zoom towards cursor
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const zoomRatio = newZoom / zoom;
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * zoomRatio,
        y: mouseY - (mouseY - prev.y) * zoomRatio
      }));
      setZoom(newZoom);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === '+' || e.key === '=') {
        setZoom(prev => Math.min(5, prev + 0.1));
      } else if (e.key === '-' || e.key === '_') {
        setZoom(prev => Math.max(0.1, prev - 0.1));
      } else if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey && previewSectionRef.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => setIsPanning(false);

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
        {/* Preview Area */}
        <section 
          ref={previewSectionRef}
          className="flex-1 flex flex-col items-center justify-center relative overflow-hidden p-8 cursor-default bg-[#050505]"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid Background */}
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(#1a1a1a_1px,transparent_1px),linear-gradient(90deg,#1a1a1a_1px,transparent_1px)] bg-[size:40px_40px]" />
          
          <div 
            className="w-full h-full flex items-center justify-center transition-transform duration-200 ease-out origin-[0_0]"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {batchSettings.enabled && batchResults.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-6 p-12 max-w-full">
                {batchResults.map((res, idx) => (
                  <div key={idx} className="relative group bg-[#0e0e0e] border border-[#262626] p-3 flex flex-col gap-3 shadow-2xl transition-transform hover:scale-105 z-10">
                    <div className="relative w-[240px] aspect-square overflow-hidden bg-black border border-[#1a1a1a]">
                      <img 
                        src={res.dataUrl}
                        alt={`Variation ${idx}`}
                        className="w-full h-full object-contain [image-rendering:pixelated]"
                      />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 pointer-events-none group-hover:pointer-events-auto">
                        <button 
                          onClick={() => downloadPNG(res)}
                          className="px-4 py-2 bg-[#c8a030] text-black font-bold text-[10px] uppercase tracking-[2px] flex items-center gap-2 hover:bg-white transition-all"
                        >
                          <Download size={14} /> Save PNG
                        </button>
                        <button 
                          onClick={() => {
                            setParams({ ...params, ...res.params });
                            setBatchSettings({ ...batchSettings, enabled: false });
                          }}
                          className="px-4 py-2 bg-[#1c1c1c] text-[#c8a030] border border-[#c8a030] font-bold text-[10px] uppercase tracking-[2px] flex items-center gap-2 hover:bg-[#c8a030] hover:text-black transition-all"
                        >
                          <Copy size={14} /> Apply Settings
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 font-mono text-[10px] text-[#606060] border-t border-[#1a1a1a] pt-2">
                      <div className="flex justify-between">
                        <span className="text-[#c8a030]">SEED:</span>
                        <span>{res.params.seed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#c8a030]">THR:</span>
                        <span>{res.params.threshold.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#c8a030]">CTR:</span>
                        <span>{res.params.contrast.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative max-w-full max-h-full group">
                <canvas 
                  ref={canvasRef}
                  className="block max-w-full max-h-full border border-[#262626] shadow-[0_0_40px_rgba(0,0,0,0.8)] [image-rendering:pixelated]"
                />
                
                {/* Single Preview Hover Controls */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 pointer-events-none group-hover:pointer-events-auto">
                  <button 
                    onClick={() => downloadPNG()}
                    className="px-4 py-2 bg-[#c8a030] text-black font-bold text-xs uppercase tracking-[2px] flex items-center gap-2 hover:bg-white transition-all transform translate-y-2 group-hover:translate-y-0"
                  >
                    <Download size={14} /> Download PNG
                  </button>
                  <button 
                    onClick={() => copyParamsToClipboard(params)}
                    className="px-4 py-2 bg-[#1c1c1c] text-[#c8a030] border border-[#c8a030] font-bold text-xs uppercase tracking-[2px] flex items-center gap-2 hover:bg-[#c8a030] hover:text-black transition-all transform translate-y-2 group-hover:translate-y-0"
                  >
                    <Copy size={14} /> Copy Params
                  </button>
                </div>

                <div className="absolute -bottom-6 right-0 font-mono text-[10px] text-[#606060]">
                  {previewInfo}
                </div>
              </div>
            )}
          </div>

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

          {/* Zoom Controls Overlay */}
          <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-[#0e0e0e]/80 backdrop-blur-md border border-[#262626] p-1.5 rounded-lg shadow-2xl z-20">
            <button 
              onClick={() => setZoom(prev => Math.max(0.1, prev - 0.2))}
              className="p-2 text-[#606060] hover:text-[#c8a030] transition-colors"
              title="Zoom Out (Ctrl -)"
            >
              <Minus size={16} />
            </button>
            <div className="w-px h-4 bg-[#262626]" />
            <button 
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="px-3 py-1 text-[10px] font-mono text-[#b8b8b8] hover:text-[#c8a030] transition-colors"
              title="Reset View (Ctrl 0)"
            >
              1:1
            </button>
            <div className="w-px h-4 bg-[#262626]" />
            <button 
              onClick={() => setZoom(prev => Math.min(10, prev + 0.2))}
              className="p-2 text-[#606060] hover:text-[#c8a030] transition-colors"
              title="Zoom In (Ctrl +)"
            >
              <Plus size={16} />
            </button>
          </div>
        </section>

        {/* Sidebar (Right) */}
        <aside className="w-80 bg-[#0e0e0e] border-l border-[#262626] overflow-y-auto shrink-0 flex flex-col scrollbar-thin scrollbar-thumb-[#262626] scrollbar-track-transparent">
          
          <CollapsibleSection id="presets" title="Presets" icon={Settings} isOpen={!collapsedSections.presets} onToggle={() => toggleSection('presets')}>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PRESETS).map(([name, preset]) => (
                <button 
                  key={name}
                  type="button"
                  onClick={() => applyPreset(name as any)}
                  className="px-3 py-2 bg-[#141414] border border-[#262626] text-[10px] font-mono text-[#b8b8b8] uppercase tracking-wider hover:border-[#c8a030] hover:text-[#c8a030] transition-all text-left flex items-center justify-between group"
                >
                  {name}
                  <Play size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="layers" title="Layers" icon={Layers} isOpen={!collapsedSections.layers} onToggle={() => toggleSection('layers')}>
            <div className="flex justify-between items-center mb-3">
              <button 
                onClick={addLayer}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#c8a030]/10 border border-[#c8a030]/30 text-[#c8a030] font-mono text-[9px] uppercase hover:bg-[#c8a030]/20 transition-colors w-full justify-center"
              >
                <Plus size={10} /> Add New Layer
              </button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {params.layers.map((layer, idx) => (
                <div 
                  key={layer.id}
                  onClick={() => setActiveLayerId(layer.id)}
                  className={`flex items-center justify-between p-2 border ${activeLayerId === layer.id ? 'border-[#c8a030] bg-[#1c1c1c]' : 'border-[#262626] bg-[#141414]'} cursor-pointer hover:border-[#444] transition-colors`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-mono text-[9px] text-[#606060]">{idx + 1}</span>
                    <span className="font-mono text-[10px] text-[#b8b8b8] truncate">{NOISE_TYPES.find(t => t.id === layer.noiseType)?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, 'visible', !layer.visible); }}
                      className={`p-1 ${layer.visible ? 'text-[#c8a030]' : 'text-[#444]'}`}
                    >
                      <Check size={10} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                      className="p-1 text-[#606060] hover:text-red-500"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="activeLayer" title={`Layer ${params.layers.findIndex(l => l.id === activeLayerId) + 1} Settings`} icon={Settings} isOpen={!collapsedSections.activeLayer} onToggle={() => toggleSection('activeLayer')}>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase text-[#606060]">Noise Type</span>
                <button 
                  onClick={() => randomizeSeed(activeLayerId)}
                  className="p-1 text-[#606060] hover:text-[#c8a030]"
                  title="Randomize Seed"
                >
                  <RefreshCw size={10} />
                </button>
              </div>
              <select 
                value={activeLayer.noiseType}
                onChange={(e) => updateLayer(activeLayerId, 'noiseType', e.target.value)}
                className="w-full bg-[#141414] text-[#f0f0f0] border border-[#262626] p-2 font-mono text-xs outline-none focus:border-[#c8a030] cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%22http://www.w3.org/2000/svg%22_width=%2210%22_height=%226%22%3E%3Cpath_d=%22M0_0l5_6_5-6z%22_fill=%22%23606060%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_10px_center]"
              >
                {NOISE_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>

              {activeLayer.noiseType !== 'perlin' && (
                <div className="grid grid-cols-2 gap-4">
                  <Slider 
                    label="Octaves" value={activeLayer.octaves} min={1} max={12} step={1} dec={0}
                    onChange={(v) => updateLayer(activeLayerId, 'octaves', v)}
                    onReset={() => resetLayerParam(activeLayerId, 'octaves')}
                    defaultValue={DEFAULT_LAYER.octaves}
                    tooltip="Number of noise layers combined for detail."
                  />
                  <Slider 
                    label="Persistence" value={activeLayer.persistence} min={0.1} max={0.9} step={0.01}
                    onChange={(v) => updateLayer(activeLayerId, 'persistence', v)}
                    onReset={() => resetLayerParam(activeLayerId, 'persistence')}
                    defaultValue={DEFAULT_LAYER.persistence}
                    tooltip="How much each octave contributes to the final shape."
                  />
                </div>
              )}

              <Slider 
                label="Scale" value={activeLayer.scale} min={0.1} max={20} step={0.1} dec={1}
                onChange={(v) => updateLayer(activeLayerId, 'scale', v)}
                onReset={() => resetLayerParam(activeLayerId, 'scale')}
                defaultValue={DEFAULT_LAYER.scale}
                tooltip="Size of the noise features. Lower = larger blobs."
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] uppercase text-[#606060] block mb-1">Blend Mode</span>
                  <select 
                    value={activeLayer.blendMode}
                    onChange={(e) => updateLayer(activeLayerId, 'blendMode', e.target.value)}
                    className="w-full bg-[#141414] text-[#f0f0f0] border border-[#262626] p-1.5 font-mono text-[10px] outline-none focus:border-[#c8a030]"
                  >
                    <option value="normal">Normal</option>
                    <option value="add">Add</option>
                    <option value="subtract">Subtract</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                  </select>
                </div>
                <Slider 
                  label="Opacity" value={activeLayer.intensity} min={0} max={1} step={0.01}
                  onChange={(v) => updateLayer(activeLayerId, 'intensity', v)}
                  onReset={() => resetLayerParam(activeLayerId, 'intensity')}
                  defaultValue={1.0}
                />
              </div>

              <div>
                <span className="text-[9px] uppercase text-[#606060] block mb-1">Seed</span>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={activeLayer.seed}
                    onChange={(e) => updateLayer(activeLayerId, 'seed', parseInt(e.target.value) || 0)}
                    className="flex-1 bg-[#141414] text-[#f0f0f0] border border-[#262626] p-1.5 font-mono text-xs outline-none focus:border-[#c8a030]"
                  />
                  <button 
                    onClick={() => updateLayer(activeLayerId, 'invert', !activeLayer.invert)}
                    className={`px-2 py-1 font-mono text-[9px] border ${activeLayer.invert ? 'border-[#c8a030] text-[#c8a030]' : 'border-[#262626] text-[#606060]'} uppercase`}
                  >
                    Invert
                  </button>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="resolution" title="Resolution" icon={Maximize2} isOpen={!collapsedSections.resolution} onToggle={() => toggleSection('resolution')}>
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTIONS.map(res => (
                <button 
                  key={res.id}
                  onClick={() => {
                    const size = parseInt(res.id);
                    updateParam('width', size);
                    updateParam('height', size);
                  }}
                  className={`px-2 py-1.5 border font-mono text-[10px] uppercase transition-all ${params.width === parseInt(res.id) ? 'border-[#c8a030] text-[#c8a030] bg-[#c8a030]/5' : 'border-[#262626] text-[#606060] hover:border-[#444]'}`}
                >
                  {res.name}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="heightmap" title="Image Heightmap" icon={ImageIcon} isOpen={!collapsedSections.image} onToggle={() => toggleSection('image')}>
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed border-[#262626] hover:border-[#c8a030] transition-colors p-4 flex flex-col items-center justify-center gap-2 cursor-pointer relative group"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input 
                  id="file-upload"
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])}
                />
                {imagePreview ? (
                  <div className="relative group/img">
                    <img src={imagePreview} className="w-full h-32 object-contain opacity-50 group-hover:opacity-80 transition-opacity" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setBaseImage(null); setImagePreview(null); }}
                      className="absolute top-1 right-1 bg-black/80 p-1 text-[#606060] hover:text-white transition-colors opacity-0 group-hover/img:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={20} className="text-[#333]" />
                    <span className="text-[10px] uppercase text-[#444] text-center">Drop image to use as base heightmap</span>
                  </>
                )}
              </div>
              {baseImage && (
                <Slider 
                  label="Image Influence" value={params.imageIntensity} min={0} max={2} step={0.01}
                  onChange={(v) => updateParam('imageIntensity', v)}
                  onReset={() => updateParam('imageIntensity', 1.0)}
                  defaultValue={1.0}
                  tooltip="How strongly the uploaded image affects the noise."
                />
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="postProcess" title="Global Post-Process" icon={Settings} isOpen={!collapsedSections.postProcess} onToggle={() => toggleSection('postProcess')}>
            <div className="flex justify-between items-center mb-4">
              <button 
                type="button"
                onClick={randomizeAll}
                className="flex items-center gap-1 px-2 py-1 bg-[#c8a030]/10 border border-[#c8a030]/30 text-[#c8a030] font-mono text-[9px] uppercase hover:bg-[#c8a030]/20 transition-colors w-full justify-center"
              >
                <RefreshCw size={10} /> Randomize All
              </button>
            </div>
            
            <div className="space-y-4">
              <Slider 
                label="Threshold" value={params.threshold} min={0} max={1} step={0.01}
                onChange={(v) => updateParam('threshold', v)}
                onReset={() => resetParam('threshold')}
                defaultValue={defaultParams.threshold}
                tooltip="Controls the black/white split ratio."
              />
              <Slider 
                label="Island Contrast" value={params.contrast} min={0} max={extremeSettings ? 200 : 100} step={0.1} dec={1}
                onChange={(v) => updateParam('contrast', v)}
                onReset={() => updateParam('contrast', 20)}
                defaultValue={20}
                tooltip="Controls the sharpness of the island edges. Lower values create softer, more gradient-like transitions."
              />
              <Slider 
                label="Bias" value={params.bias} min={-0.5} max={0.5} step={0.01}
                onChange={(v) => updateParam('bias', v)}
                onReset={() => resetParam('bias')}
                defaultValue={defaultParams.bias}
                tooltip="Shifts values towards black or white before thresholding."
              />
              <Slider 
                label="Island Spread" value={params.spread} min={0} max={extremeSettings ? 256 : 48} step={1} dec={0}
                onChange={(v) => updateParam('spread', v)}
                onReset={() => resetParam('spread')}
                defaultValue={defaultParams.spread}
                tooltip="Dilates the white areas."
              />

              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-[#606060]">Seamless Tiling</span>
                  <button 
                    onClick={() => updateParam('seamless', !params.seamless)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${params.seamless ? 'bg-[#c8a030]' : 'bg-[#262626]'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${params.seamless ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-[#606060]">Invert Colors</span>
                  <button 
                    onClick={handleInvertToggle}
                    className={`w-8 h-4 rounded-full relative transition-colors ${params.invert ? 'bg-[#c8a030]' : 'bg-[#262626]'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${params.invert ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-[#f0a0a0]">Extreme Settings</span>
                  <button 
                    onClick={() => setExtremeSettings(!extremeSettings)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${extremeSettings ? 'bg-[#4a2020]' : 'bg-[#262626]'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${extremeSettings ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="batch" title="Batch Generation" icon={LayoutGrid} isOpen={!collapsedSections.batch} onToggle={() => toggleSection('batch')}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[#606060]">Enable Batch</span>
                <button 
                  onClick={() => updateBatchSetting('enabled', !batchSettings.enabled)}
                  className={`w-8 h-4 rounded-full relative transition-colors ${batchSettings.enabled ? 'bg-[#c8a030]' : 'bg-[#262626]'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${batchSettings.enabled ? 'left-4.5' : 'left-0.5'}`} />
                </button>
              </div>

              {batchSettings.enabled && (
                <div className="space-y-4 pt-2 border-t border-[#1a1a1a]">
                  <Slider 
                    label="Count" value={batchSettings.count} min={2} max={12} step={1} dec={0}
                    onChange={(v) => updateBatchSetting('count', v)}
                    defaultValue={4}
                  />

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase text-[#606060] block mb-1">Randomize Fields</span>
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
                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-colors ${ (batchSettings as any)[field.key] ? 'border-[#c8a030] bg-[#c8a030]/10' : 'border-[#262626]' }`}>
                          { (batchSettings as any)[field.key] && <Check size={10} className="text-[#c8a030]" /> }
                        </div>
                        <span className={`text-[10px] uppercase tracking-wider transition-colors ${ (batchSettings as any)[field.key] ? 'text-[#c8a030]' : 'text-[#606060] group-hover:text-[#b8b8b8]' }`}>
                          {field.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Action Buttons */}
          <section className="p-4 mt-auto flex flex-col gap-2 sticky bottom-0 bg-[#0e0e0e] border-t border-[#262626] z-10">
            <button 
              type="button"
              onClick={() => generate()}
              className={`w-full py-2.5 font-bold text-xs tracking-[2px] uppercase transition-all flex items-center justify-center gap-2 ${
                isGenerating ? 'bg-[#4a2020] text-[#f0a0a0]' : 'bg-[#c8a030] text-black hover:bg-[#f0f0f0]'
              }`}
            >
              {isGenerating ? <><X size={14} /> Cancel</> : <><Play size={14} /> {batchSettings.enabled ? 'Generate Batch' : 'Full Render'}</>}
            </button>
            {batchSettings.enabled && batchResults.length > 0 ? (
              <button 
                type="button"
                onClick={downloadAllBatch}
                disabled={isGenerating}
                className="w-full py-2.5 font-bold text-xs tracking-[2px] uppercase border border-[#262626] text-[#b8b8b8] hover:border-[#c8a030] hover:text-[#c8a030] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Download size={14} /> Download All ({batchResults.length})
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => downloadPNG()}
                disabled={!currentResult || isGenerating}
                className="w-full py-2.5 font-bold text-xs tracking-[2px] uppercase border border-[#262626] text-[#b8b8b8] hover:border-[#c8a030] hover:text-[#c8a030] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Download size={14} /> Download PNG
              </button>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
