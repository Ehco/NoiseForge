/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Download, Play, X, Info, Layers, Maximize2, RefreshCw, Check, AlertCircle, Upload, Image as ImageIcon, Copy, LayoutGrid, Trash2, Plus, Minus, Edit3 } from 'lucide-react';
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

const SHAPE_TYPES = [
  { id: 'circle', name: 'Circle' },
  { id: 'square', name: 'Square' },
  { id: 'triangle', name: 'Triangle' },
  { id: 'hexagon', name: 'Hexagon' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'slash_f', name: 'Slash /' },
  { id: 'slash_b', name: 'Slash \\' },
  { id: 'knurling', name: 'Knurling' },
  { id: 'pegboard', name: 'Pegboard' },
  { id: 'custom', name: 'Custom' },
  { id: 'text', name: 'Text/Emoji' }
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

interface TextureShape {
  id: string;
  type: 'circle' | 'square' | 'triangle' | 'hexagon' | 'slash_f' | 'slash_b' | 'diamond' | 'knurling' | 'pegboard' | 'custom' | 'text';
  size: number;
  scaleX: number;
  scaleY: number;
  posX: number;
  posY: number;
  roundness: number;
  rotation: number;
  depth: number;
  text?: string;
  textData?: Uint8Array | null;
  isCollapsed?: boolean;
}

interface TextureSettings {
  shapes: TextureShape[];
  spacingX: number;
  spacingY: number;
  stagger: boolean;
  linkSizeSpacing: boolean;
  customShapeData: Uint8Array | null;
}

interface NoiseParams {
  width: number;
  height: number;
  linkResolution: boolean;
  layers: NoiseLayer[];
  threshold: number;
  contrast: number;
  bias: number;
  spread: number;
  seamless: boolean;
  invert: boolean;
  imageIntensity: number;
  activeTab: 'noise' | 'texture' | 'image';
  textureSettings: TextureSettings;
  applyPostToTexture: boolean;
}

const PREVIEW_LIMIT = 1024;

interface BatchSettings {
  enabled: boolean;
  count: number;
  randomizeSeed: boolean;
  randomizeThreshold: boolean;
  randomizeContrast: boolean;
  randomizeBias: boolean;
  randomizeSpread: boolean;
}

const DEFAULT_TEXTURE: TextureSettings = {
  shapes: [
    { 
      id: '1', 
      type: 'circle', 
      size: 128, 
      scaleX: 1,
      scaleY: 1,
      posX: 0.5, 
      posY: 0.5, 
      roundness: 0, 
      rotation: 0, 
      depth: 1.0,
      isCollapsed: false
    }
  ],
  spacingX: 512,
  spacingY: 512,
  stagger: false,
  linkSizeSpacing: false,
  customShapeData: null,
};

const DEFAULT_LAYER: NoiseLayer = {
  id: '1',
  noiseType: 'fbm',
  scale: 3.0,
  octaves: 24,
  persistence: 0.90,
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
  linkResolution: true,
  layers: [DEFAULT_LAYER],
  threshold: 0.50,
  contrast: 50.0,
  bias: 0.0,
  spread: 0,
  seamless: true,
  invert: false,
  imageIntensity: 1.0,
  activeTab: 'noise',
  textureSettings: DEFAULT_TEXTURE,
  applyPostToTexture: false,
};

// --- Components ---
const Slider = ({ label, value, min, max, step, onChange, onReset, defaultValue, tooltip, dec = 2 }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startVal = useRef(0);
  const dragThreshold = 5;
  const hasMoved = useRef(false);
  const clickTimer = useRef<any>(null);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    if (e.detail === 2) {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      onReset();
      return;
    }
    startX.current = e.clientX;
    startVal.current = value;
    hasMoved.current = false;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX.current;
      if (Math.abs(deltaX) > dragThreshold) {
        hasMoved.current = true;
        setIsDragging(true);
        document.body.style.cursor = 'ew-resize';
        const newValue = startVal.current + deltaX * step * 0.5;
        const clamped = Math.max(min, Math.min(max, newValue));
        onChange(clamped);
      }
    };
    
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = 'default';
      } else if (!hasMoved.current && e.detail === 1) {
        // Single click - wait a bit to ensure it's not a double click
        clickTimer.current = setTimeout(() => {
          setIsEditing(true);
        }, 200);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="space-y-1.5 group/slider select-none">
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
            className={`text-[10px] font-mono transition-colors ${isDragging ? 'text-white' : 'text-[#c8a030] hover:text-white'} cursor-ew-resize`}
            onMouseDown={handleMouseDown}
            onDoubleClick={onReset}
            title="Drag to scrub, Click to edit, Double-click to reset"
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
          onDoubleClick={onReset}
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
  const [tabStates, setTabStates] = useState<Record<string, NoiseParams>>({
    noise: { ...DEFAULT_PARAMS, activeTab: 'noise' },
    texture: { ...DEFAULT_PARAMS, activeTab: 'texture' },
    image: { ...DEFAULT_PARAMS, activeTab: 'image' },
  });
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

  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const updateParam = (key: keyof NoiseParams, value: any) => {
    if (key === 'activeTab') {
      const nextTab = value as 'noise' | 'texture' | 'image';
      setTabStates(prev => ({ ...prev, [params.activeTab]: params }));
      setParams(tabStates[nextTab]);
      return;
    }
    setParams(prev => {
      const next = { ...prev, [key]: value };
      if (prev.linkResolution) {
        if (key === 'width') next.height = value;
        if (key === 'height') next.width = value;
      }
      return next;
    });
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

  const updateTextureSetting = (key: keyof TextureSettings, value: any) => {
    setParams(prev => {
      const nextSettings = { ...prev.textureSettings, [key]: value };
      if (prev.textureSettings.linkSizeSpacing) {
        if (key === 'spacingX') {
          nextSettings.spacingY = value;
        } else if (key === 'spacingY') {
          nextSettings.spacingX = value;
        }
      }
      return {
        ...prev,
        textureSettings: nextSettings
      };
    });
  };

  const updateTextureShape = (id: string, key: keyof TextureShape, value: any) => {
    setParams(prev => {
      const nextShapes = prev.textureSettings.shapes.map(s => s.id === id ? { ...s, [key]: value } : s);
      return {
        ...prev,
        textureSettings: { ...prev.textureSettings, shapes: nextShapes }
      };
    });
  };

  const addTextureShape = () => {
    setParams(prev => {
      const newShape: TextureShape = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'circle',
        size: 128,
        scaleX: 1,
        scaleY: 1,
        posX: 0.5,
        posY: 0.5,
        roundness: 0,
        rotation: 0,
        depth: 1.0,
        isCollapsed: false
      };
      return {
        ...prev,
        textureSettings: { ...prev.textureSettings, shapes: [...prev.textureSettings.shapes, newShape] }
      };
    });
  };

  const removeTextureShape = (id: string) => {
    setParams(prev => {
      if (prev.textureSettings.shapes.length <= 1) return prev;
      return {
        ...prev,
        textureSettings: { ...prev.textureSettings, shapes: prev.textureSettings.shapes.filter(s => s.id !== id) }
      };
    });
  };

  const processCustomShape = async (file: File) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise(resolve => img.onload = resolve);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 64, 64);
    const imageData = ctx.getImageData(0, 0, 64, 64);
    const grayscale = new Uint8Array(64 * 64);
    for (let i = 0; i < imageData.data.length; i += 4) {
      grayscale[i / 4] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
    }
    updateTextureSetting('customShapeData', grayscale);
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

  useEffect(() => {
    if (imagePreview) {
      const img = new Image();
      img.src = imagePreview;
      img.onload = () => {
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
    }
  }, [params.width, params.height]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (params.activeTab !== 'texture') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Find closest shape
    let closestId: string | null = null;
    let minDistance = 0.1; // Selection radius
    
    params.textureSettings.shapes.forEach(shape => {
      const dx = x - shape.posX;
      const dy = y - shape.posY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestId = shape.id;
      }
    });
    
    if (closestId) {
      setSelectedShapeId(closestId);
      setIsDragging(true);
      // Expand the shape in the sidebar if it was collapsed
      updateTextureShape(closestId, 'isCollapsed', false);
    } else {
      setSelectedShapeId(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedShapeId || params.activeTab !== 'texture') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    updateTextureShape(selectedShapeId, 'posX', x);
    updateTextureShape(selectedShapeId, 'posY', y);
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
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
    
    // Performance Optimization: Downscale preview if resolution is too high
    let liveW = params.width;
    let liveH = params.height;
    
    if (liveW > PREVIEW_LIMIT || liveH > PREVIEW_LIMIT) {
      const ratio = Math.min(PREVIEW_LIMIT / liveW, PREVIEW_LIMIT / liveH);
      liveW = Math.floor(liveW * ratio);
      liveH = Math.floor(liveH * ratio);
    }

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
    params.activeTab,
    params.textureSettings,
    params.applyPostToTexture,
    params.width,
    params.height,
    baseImage
  ]);

  // Render text shapes to data
  useEffect(() => {
    params.textureSettings.shapes.forEach(shape => {
      if (shape.type === 'text' && shape.text) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, 128, 128);
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Fix text clipping: measure and scale to fit
          ctx.font = 'bold 80px sans-serif';
          const metrics = ctx.measureText(shape.text);
          const textWidth = metrics.width;
          if (textWidth > 110) {
            const scale = 110 / textWidth;
            ctx.font = `bold ${Math.floor(80 * scale)}px sans-serif`;
          }
          
          ctx.fillText(shape.text, 64, 64);
          const imageData = ctx.getImageData(0, 0, 128, 128);
          const grayscale = new Uint8Array(128 * 128);
          for (let i = 0; i < 128 * 128; i++) {
            grayscale[i] = imageData.data[i * 4];
          }
          
          // Only update if data is different to avoid loops
          const currentData = shape.textData;
          let isDifferent = !currentData || currentData.length !== grayscale.length;
          if (!isDifferent && currentData) {
            for (let i = 0; i < grayscale.length; i++) {
              if (currentData[i] !== grayscale[i]) {
                isDifferent = true;
                break;
              }
            }
          }

          if (isDifferent) {
            updateTextureShape(shape.id, 'textData', grayscale);
          }
        }
      }
    });
  }, [params.textureSettings.shapes]);

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

      {/* Tabs */}
      <div className="flex bg-[#0e0e0e] border-b border-[#262626] shrink-0">
        {[
          { id: 'noise', name: 'Noise Generator', icon: RefreshCw },
          { id: 'texture', name: 'Texture Generator', icon: LayoutGrid },
          { id: 'image', name: 'Image Heightmap', icon: ImageIcon },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => updateParam('activeTab', tab.id as any)}
            className={`flex-1 py-3 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[2px] transition-all border-b-2 ${
              params.activeTab === tab.id 
                ? 'text-[#c8a030] border-[#c8a030] bg-[#161616]' 
                : 'text-[#606060] border-transparent hover:text-[#b8b8b8] hover:bg-[#111]'
            }`}
          >
            <tab.icon size={12} />
            <span className="hidden sm:inline">{tab.name}</span>
          </button>
        ))}
      </div>

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
                  className={`block max-w-full max-h-full border border-[#262626] shadow-[0_0_40px_rgba(0,0,0,0.8)] [image-rendering:pixelated] ${params.activeTab === 'texture' ? 'cursor-crosshair' : ''}`}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
                
                {/* Single Preview Buttons (Bottom Left) */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 z-20">
                  <button 
                    onClick={() => downloadPNG()}
                    className="p-2 bg-[#0e0e0e]/80 backdrop-blur-md border border-[#262626] text-[#c8a030] hover:text-white hover:bg-[#c8a030] transition-all rounded shadow-xl"
                    title="Download PNG"
                  >
                    <Download size={16} />
                  </button>
                  {params.activeTab === 'noise' && (
                    <button 
                      onClick={() => copyParamsToClipboard(params)}
                      className="p-2 bg-[#0e0e0e]/80 backdrop-blur-md border border-[#262626] text-[#c8a030] hover:text-white hover:bg-[#c8a030] transition-all rounded shadow-xl"
                      title="Copy Parameters"
                    >
                      <Copy size={16} />
                    </button>
                  )}
                </div>

                <div className="absolute -bottom-6 right-0 font-mono text-[10px] text-[#606060]">
                  {`${params.width} × ${params.height}`}
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

        {/* Texture Shapes Sidebar (Left of Main Sidebar) */}
        {params.activeTab === 'texture' && (
          <aside className="w-[300px] bg-[#0a0a0a] border-l border-[#262626] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0e0e0e]">
              <div className="flex items-center gap-2">
                <LayoutGrid size={14} className="text-[#c8a030]" />
                <h3 className="font-mono text-[10px] tracking-[2px] uppercase text-[#c8a030]">Shapes</h3>
              </div>
              <button 
                onClick={addTextureShape}
                className="p-1.5 bg-[#c8a030]/10 text-[#c8a030] border border-[#c8a030]/20 hover:bg-[#c8a030] hover:text-black transition-all rounded"
                title="Add Shape"
              >
                <Plus size={14} />
              </button>
            </div>
            
            <div className="flex-1 p-4 space-y-4">
              {params.textureSettings.shapes.map((shape, index) => (
                <div key={shape.id} className="bg-[#111] border border-[#262626] overflow-hidden">
                  <div 
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#161616] transition-colors"
                    onClick={() => updateTextureShape(shape.id, 'isCollapsed', !shape.isCollapsed)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-[#606060]">{index + 1}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#b8b8b8]">
                        {SHAPE_TYPES.find(t => t.id === shape.type)?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeTextureShape(shape.id); }}
                        className="p-1 text-[#444] hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                      <motion.div animate={{ rotate: shape.isCollapsed ? -90 : 0 }}>
                        <Plus size={10} className="text-[#606060]" />
                      </motion.div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {!shape.isCollapsed && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 space-y-4 border-t border-[#1a1a1a]/50">
                          <div className="grid grid-cols-3 gap-1 py-3">
                            {SHAPE_TYPES.map(st => (
                              <button 
                                key={st.id}
                                onClick={() => updateTextureShape(shape.id, 'type', st.id)}
                                className={`p-1.5 border text-[8px] uppercase transition-all ${shape.type === st.id ? 'border-[#c8a030] text-[#c8a030] bg-[#c8a030]/10' : 'border-[#1a1a1a] text-[#444] hover:border-[#333]'}`}
                              >
                                {st.name}
                              </button>
                            ))}
                          </div>

                          {shape.type === 'text' && (
                            <div className="space-y-2">
                              <label className="text-[9px] uppercase tracking-wider text-[#606060]">Text / Emoji</label>
                              <input 
                                type="text"
                                value={shape.text || ''}
                                onChange={(e) => updateTextureShape(shape.id, 'text', e.target.value)}
                                className="w-full bg-[#050505] border border-[#262626] text-xs p-2 outline-none focus:border-[#c8a030] transition-colors text-white"
                                placeholder="Enter text..."
                              />
                            </div>
                          )}

                          <Slider 
                            label="Size" value={shape.size} min={1} max={params.width * 2} step={1} 
                            onChange={(v: number) => updateTextureShape(shape.id, 'size', v)}
                            onReset={() => updateTextureShape(shape.id, 'size', 128)}
                            defaultValue={128}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <Slider 
                              label="Width %" value={shape.scaleX * 100} min={1} max={500} step={1} 
                              onChange={(v: number) => updateTextureShape(shape.id, 'scaleX', v / 100)}
                              onReset={() => updateTextureShape(shape.id, 'scaleX', 1)}
                              defaultValue={100}
                            />
                            <Slider 
                              label="Height %" value={shape.scaleY * 100} min={1} max={500} step={1} 
                              onChange={(v: number) => updateTextureShape(shape.id, 'scaleY', v / 100)}
                              onReset={() => updateTextureShape(shape.id, 'scaleY', 1)}
                              defaultValue={100}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <Slider 
                              label="Pos X" value={shape.posX} min={0} max={1} step={0.01} 
                              onChange={(v: number) => updateTextureShape(shape.id, 'posX', v)}
                              onReset={() => updateTextureShape(shape.id, 'posX', 0.5)}
                              defaultValue={0.5}
                            />
                            <Slider 
                              label="Pos Y" value={shape.posY} min={0} max={1} step={0.01} 
                              onChange={(v: number) => updateTextureShape(shape.id, 'posY', v)}
                              onReset={() => updateTextureShape(shape.id, 'posY', 0.5)}
                              defaultValue={0.5}
                            />
                          </div>

                          <Slider 
                            label="Roundness" value={shape.roundness} min={0} max={100} step={1} 
                            onChange={(v: number) => updateTextureShape(shape.id, 'roundness', v)}
                            onReset={() => updateTextureShape(shape.id, 'roundness', 0)}
                            defaultValue={0}
                          />
                          <Slider 
                            label="Rotation" value={shape.rotation} min={0} max={360} step={1} 
                            onChange={(v: number) => updateTextureShape(shape.id, 'rotation', v)}
                            onReset={() => updateTextureShape(shape.id, 'rotation', 0)}
                            defaultValue={0}
                          />
                          <Slider 
                            label="Depth" value={shape.depth} min={0} max={1} step={0.01} 
                            onChange={(v: number) => updateTextureShape(shape.id, 'depth', v)}
                            onReset={() => updateTextureShape(shape.id, 'depth', 1.0)}
                            defaultValue={1.0}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Sidebar (Right) */}
        <aside className="w-[320px] bg-[#0e0e0e] border-l border-[#262626] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          {params.activeTab === 'noise' && (
            <>
              <CollapsibleSection 
                isOpen={!collapsedSections.presets} 
                onToggle={() => toggleSection('presets')}
                title="Presets" 
                icon={LayoutGrid}
              >
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(PRESETS).map((key) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key as any)}
                      className="p-2 bg-[#161616] border border-[#262626] hover:border-[#c8a030] hover:bg-[#1c1c1c] transition-all text-left group"
                    >
                      <div className="text-[9px] font-mono text-[#606060] group-hover:text-[#c8a030] uppercase tracking-wider">{key}</div>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection 
                isOpen={!collapsedSections.layers} 
                onToggle={() => toggleSection('layers')}
                title="Layers" 
                icon={Layers}
              >
                <div className="space-y-2">
                  {params.layers.map((layer, idx) => (
                    <div 
                      key={layer.id}
                      onClick={() => setActiveLayerId(layer.id)}
                      className={`p-3 border transition-all cursor-pointer flex items-center justify-between group ${
                        activeLayerId === layer.id 
                          ? 'bg-[#1c1c1c] border-[#c8a030]' 
                          : 'bg-[#161616] border-[#262626] hover:border-[#444]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-[10px] font-mono text-[#606060]">{idx + 1}</div>
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${activeLayerId === layer.id ? 'text-white' : 'text-[#b8b8b8]'}`}>
                            {NOISE_TYPES.find(t => t.id === layer.noiseType)?.name || 'Noise'}
                          </span>
                          <span className="text-[9px] text-[#606060] font-mono">S:{layer.seed} I:{layer.intensity.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, 'visible', !layer.visible); }}
                          className={`p-1.5 hover:bg-[#333] rounded transition-colors ${layer.visible ? 'text-[#c8a030]' : 'text-[#444]'}`}
                        >
                          <Maximize2 size={12} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                          className="p-1.5 hover:bg-[#333] text-[#606060] hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={addLayer}
                    className="w-full p-2 border border-dashed border-[#333] hover:border-[#c8a030] hover:bg-[#161616] text-[#606060] hover:text-[#c8a030] transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-[2px]"
                  >
                    <Plus size={12} /> Add Layer
                  </button>
                </div>
              </CollapsibleSection>

              <CollapsibleSection 
                isOpen={!collapsedSections.activeLayer} 
                onToggle={() => toggleSection('activeLayer')}
                title="Active Layer Settings" 
                icon={Settings}
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-[#606060]">Noise Type</label>
                    <select 
                      value={activeLayer.noiseType}
                      onChange={(e) => updateLayer(activeLayer.id, 'noiseType', e.target.value)}
                      className="w-full bg-[#161616] border border-[#262626] text-[10px] p-2 outline-none focus:border-[#c8a030] transition-colors font-mono uppercase"
                    >
                      {NOISE_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  <Slider 
                    label="Scale" value={activeLayer.scale} min={0.1} max={100} step={0.1} 
                    onChange={(v: number) => updateLayer(activeLayer.id, 'scale', v)}
                    onReset={() => resetLayerParam(activeLayer.id, 'scale')}
                    defaultValue={DEFAULT_LAYER.scale}
                    tooltip="Base frequency of the noise. Higher values = smaller features."
                  />
                  <Slider 
                    label="Octaves" value={activeLayer.octaves} min={1} max={24} step={1} 
                    onChange={(v: number) => updateLayer(activeLayer.id, 'octaves', v)}
                    onReset={() => resetLayerParam(activeLayer.id, 'octaves')}
                    defaultValue={DEFAULT_LAYER.octaves}
                    dec={0}
                    tooltip="Number of layers of noise combined. Higher = more detail."
                  />
                  <Slider 
                    label="Persistence" value={activeLayer.persistence} min={0} max={1} step={0.01} 
                    onChange={(v: number) => updateLayer(activeLayer.id, 'persistence', v)}
                    onReset={() => resetLayerParam(activeLayer.id, 'persistence')}
                    defaultValue={DEFAULT_LAYER.persistence}
                    tooltip="How much each octave contributes. Higher = rougher texture."
                  />
                  <Slider 
                    label="Lacunarity" value={activeLayer.lacunarity} min={1} max={4} step={0.01} 
                    onChange={(v: number) => updateLayer(activeLayer.id, 'lacunarity', v)}
                    onReset={() => resetLayerParam(activeLayer.id, 'lacunarity')}
                    defaultValue={DEFAULT_LAYER.lacunarity}
                    tooltip="Frequency multiplier for each octave."
                  />
                  <Slider 
                    label="Intensity" value={activeLayer.intensity} min={0} max={2} step={0.01} 
                    onChange={(v: number) => updateLayer(activeLayer.id, 'intensity', v)}
                    onReset={() => resetLayerParam(activeLayer.id, 'intensity')}
                    defaultValue={DEFAULT_LAYER.intensity}
                    tooltip="Overall strength of this layer."
                  />

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => randomizeSeed(activeLayer.id)}
                        className="p-2 bg-[#161616] border border-[#262626] hover:border-[#c8a030] text-[#606060] hover:text-[#c8a030] transition-all"
                        title="Randomize Seed"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider text-[#606060]">Seed</span>
                        <span className="text-[11px] font-mono text-white">{activeLayer.seed}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => updateLayer(activeLayer.id, 'invert', !activeLayer.invert)}
                        className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${activeLayer.invert ? 'text-[#c8a030]' : 'text-[#444] hover:text-[#606060]'}`}
                      >
                        Invert
                      </button>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </>
          )}

          {params.activeTab === 'texture' && (
            <CollapsibleSection 
              isOpen={!collapsedSections.texture} 
              onToggle={() => toggleSection('texture')}
              title="Texture Generator" 
              icon={LayoutGrid}
            >
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-[#606060]">Grid Settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Slider 
                      label="Spacing X" value={params.textureSettings.spacingX} min={1} max={params.width} step={1} 
                      onChange={(v: number) => updateTextureSetting('spacingX', v)}
                      onReset={() => updateTextureSetting('spacingX', params.width)}
                      defaultValue={params.width}
                    />
                    <Slider 
                      label="Spacing Y" value={params.textureSettings.spacingY} min={1} max={params.height} step={1} 
                      onChange={(v: number) => updateTextureSetting('spacingY', v)}
                      onReset={() => updateTextureSetting('spacingY', params.height)}
                      defaultValue={params.height}
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-[#606060]">Link Spacing</span>
                      <button 
                        onClick={() => updateTextureSetting('linkSizeSpacing', !params.textureSettings.linkSizeSpacing)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${params.textureSettings.linkSizeSpacing ? 'bg-[#c8a030]' : 'bg-[#262626]'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${params.textureSettings.linkSizeSpacing ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-[#606060]">Stagger Grid</span>
                      <button 
                        onClick={() => updateTextureSetting('stagger', !params.textureSettings.stagger)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${params.textureSettings.stagger ? 'bg-[#c8a030]' : 'bg-[#262626]'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${params.textureSettings.stagger ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-[#606060]">Apply Post-Process</span>
                      <button 
                        onClick={() => updateParam('applyPostToTexture', !params.applyPostToTexture)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${params.applyPostToTexture ? 'bg-[#c8a030]' : 'bg-[#262626]'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${params.applyPostToTexture ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {params.textureSettings.shapes.some(s => s.type === 'custom') && (
                  <div className="space-y-3 pt-4 border-t border-[#262626]">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-wider text-[#606060]">Custom Shape (64x64)</label>
                      <button 
                        onClick={() => {
                          const empty = new Uint8Array(64 * 64).fill(0);
                          updateTextureSetting('customShapeData', empty);
                        }}
                        className="text-[9px] text-red-500 hover:text-red-400 transition-colors uppercase"
                      >
                        Clear
                      </button>
                    </div>
                    
                    <div className="flex gap-2">
                      <div 
                        className="relative group border-2 border-dashed border-[#262626] hover:border-[#c8a030] transition-all p-4 flex-1 flex flex-col items-center justify-center gap-2 bg-[#0a0a0a] cursor-pointer"
                        onClick={() => document.getElementById('custom-shape-upload')?.click()}
                      >
                        <input 
                          id="custom-shape-upload"
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => e.target.files?.[0] && processCustomShape(e.target.files[0])}
                          className="hidden"
                        />
                        <div className="flex flex-col items-center gap-1 text-[#444] group-hover:text-[#c8a030]">
                          <Upload size={16} />
                          <span className="text-[9px] uppercase">Upload</span>
                        </div>
                      </div>
                      
                      <div className="w-16 h-16 bg-[#0a0a0a] border border-[#262626] relative overflow-hidden group/draw">
                        {params.textureSettings.customShapeData ? (
                          <canvas 
                            width={64} height={64}
                            ref={(el) => {
                              if (el && params.textureSettings.customShapeData) {
                                const ctx = el.getContext('2d');
                                if (ctx) {
                                  const imgData = ctx.createImageData(64, 64);
                                  for (let i = 0; i < 64 * 64; i++) {
                                    const v = params.textureSettings.customShapeData[i];
                                    imgData.data[i * 4] = v;
                                    imgData.data[i * 4 + 1] = v;
                                    imgData.data[i * 4 + 2] = v;
                                    imgData.data[i * 4 + 3] = 255;
                                  }
                                  ctx.putImageData(imgData, 0, 0);
                                }
                              }
                            }}
                            className="w-full h-full [image-rendering:pixelated]"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#262626]">
                            <Edit3 size={16} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {params.activeTab === 'image' && (
            <CollapsibleSection 
              isOpen={true} 
              onToggle={() => {}}
              title="Image Heightmap" 
              icon={ImageIcon}
            >
              <div className="space-y-4">
                <div 
                  className="relative group border-2 border-dashed border-[#262626] hover:border-[#c8a030] transition-all p-4 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) processImage(file);
                  }}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  {imagePreview ? (
                    <img src={imagePreview} className="w-full aspect-square object-cover rounded border border-[#262626]" alt="Preview" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#606060] group-hover:text-[#c8a030]">
                      <Upload size={24} />
                      <span className="text-[10px] uppercase tracking-[2px]">Drop or Click</span>
                    </div>
                  )}
                </div>
                {baseImage && (
                  <div className="space-y-4">
                    <Slider 
                      label="Image Intensity" value={params.imageIntensity} min={0} max={2} step={0.01} 
                      onChange={(v: number) => updateParam('imageIntensity', v)}
                      onReset={() => updateParam('imageIntensity', 1.0)}
                      defaultValue={1.0}
                      tooltip="How much the base image influences the final noise."
                    />
                    <button 
                      onClick={() => { setBaseImage(null); setImagePreview(null); }}
                      className="w-full p-2 bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40 transition-all text-[9px] uppercase tracking-[2px]"
                    >
                      Clear Image
                    </button>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection 
            isOpen={!collapsedSections.resolution} 
            onToggle={() => toggleSection('resolution')}
            title="Resolution" 
            icon={Maximize2}
          >
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTIONS.map(res => (
                <button 
                  key={res.id}
                  onClick={() => {
                    const size = parseInt(res.id);
                    setParams(prev => {
                      const next = { ...prev, width: size, height: size };
                      if (prev.activeTab === 'texture') {
                        next.textureSettings = {
                          ...prev.textureSettings,
                          spacingX: size,
                          spacingY: size
                        };
                      }
                      return next;
                    });
                  }}
                  className={`p-2 border text-[10px] font-mono transition-all ${
                    params.width === parseInt(res.id) && params.height === parseInt(res.id)
                      ? 'bg-[#c8a030] text-black border-[#c8a030]' 
                      : 'bg-[#161616] border-[#262626] text-[#606060] hover:border-[#444]'
                  }`}
                >
                  {res.name}
                </button>
              ))}
            </div>
            
            <div className="relative flex items-center gap-3 pt-4 border-t border-[#262626] mt-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider text-[#606060]">Width</label>
                <input 
                  type="number"
                  value={params.width}
                  onChange={(e) => updateParam('width', parseInt(e.target.value) || 0)}
                  className="w-full bg-[#161616] border border-[#262626] text-[11px] font-mono text-white p-2 outline-none focus:border-[#c8a030]"
                />
              </div>
              
              <button 
                onClick={() => setParams(prev => ({ ...prev, linkResolution: !prev.linkResolution }))}
                className={`mt-5 w-8 h-4 rounded-full relative transition-colors ${params.linkResolution ? 'bg-[#c8a030]' : 'bg-[#262626]'}`}
                title={params.linkResolution ? "Unlink Aspect Ratio" : "Link Aspect Ratio"}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${params.linkResolution ? 'left-4.5' : 'left-0.5'}`} />
              </button>

              <div className="flex-1 space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider text-[#606060]">Height</label>
                <input 
                  type="number"
                  value={params.height}
                  onChange={(e) => updateParam('height', parseInt(e.target.value) || 0)}
                  className="w-full bg-[#161616] border border-[#262626] text-[11px] font-mono text-white p-2 outline-none focus:border-[#c8a030]"
                />
              </div>
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
                onReset={() => updateParam('contrast', 50)}
                defaultValue={50}
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
