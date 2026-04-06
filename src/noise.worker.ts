
// ---- 4D Simplex Noise (Stefan Gustavson) ----
class SimplexNoise4D {
  grad4: number[][];
  perm: Uint8Array;

  constructor(seed: number) {
    this.grad4 = [
      [0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],
      [0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],
      [1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],
      [-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],
      [1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],
      [-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],
      [1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],
      [-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]
    ];
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let r = (seed ^ 0x12345678) >>> 0;
    const rnd = () => { r = Math.imul(r, 1664525) + 1013904223 >>> 0; return r / 0x100000000; };
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  dot4(g: number[], x: number, y: number, z: number, w: number) { return g[0]*x + g[1]*y + g[2]*z + g[3]*w; }

  eval(x: number, y: number, z: number, w: number) {
    const F4 = (Math.sqrt(5)-1)/4, G4 = (5-Math.sqrt(5))/20;
    const s = (x+y+z+w)*F4;
    const i=Math.floor(x+s), j=Math.floor(y+s), k=Math.floor(z+s), l=Math.floor(w+s);
    const t0=(i+j+k+l)*G4;
    const x0=x-(i-t0), y0=y-(j-t0), z0=z-(k-t0), w0=w-(l-t0);
    let rx=0,ry=0,rz=0,rw=0;
    if(x0>y0)rx++;else ry++; if(x0>z0)rx++;else rz++; if(x0>w0)rx++;else rw++;
    if(y0>z0)ry++;else rz++; if(y0>w0)ry++;else rw++; if(z0>w0)rz++;else rw++;
    const i1=rx>=3?1:0,j1=ry>=3?1:0,k1=rz>=3?1:0,l1=rw>=3?1:0;
    const i2=rx>=2?1:0,j2=ry>=2?1:0,k2=rz>=2?1:0,l2=rw>=2?1:0;
    const i3=rx>=1?1:0,j3=ry>=1?1:0,k3=rz>=1?1:0,l3=rw>=1?1:0;
    const x1=x0-i1+G4,y1=y0-j1+G4,z1=z0-k1+G4,w1=w0-l1+G4;
    const x2=x0-i2+2*G4,y2=y0-j2+2*G4,z2=z0-k2+2*G4,w2=w0-l2+2*G4;
    const x3=x0-i3+3*G4,y3=y0-j3+3*G4,z3=z0-k3+3*G4,w3=w0-l3+3*G4;
    const x4=x0-1+4*G4,y4=y0-1+4*G4,z4=z0-1+4*G4,w4=w0-1+4*G4;
    const pm=this.perm;
    const gi0=pm[(i+pm[(j+pm[(k+pm[l&255])&255])&255])&255]%32;
    const gi1=pm[(i+i1+pm[(j+j1+pm[(k+k1+pm[(l+l1)&255])&255])&255])&255]%32;
    const gi2=pm[(i+i2+pm[(j+j2+pm[(k+k2+pm[(l+l2)&255])&255])&255])&255]%32;
    const gi3=pm[(i+i3+pm[(j+j3+pm[(k+k3+pm[(l+l3)&255])&255])&255])&255]%32;
    const gi4=pm[(i+1+pm[(j+1+pm[(k+1+pm[(l+1)&255])&255])&255])&255]%32;
    let n0=0,n1=0,n2=0,n3=0,n4=0;
    let t=0.6-x0*x0-y0*y0-z0*z0-w0*w0; if(t>0){t*=t;n0=t*t*this.dot4(this.grad4[gi0],x0,y0,z0,w0);}
    t=0.6-x1*x1-y1*y1-z1*z1-w1*w1; if(t>0){t*=t;n1=t*t*this.dot4(this.grad4[gi1],x1,y1,z1,w1);}
    t=0.6-x2*x2-y2*y2-z2*z2-w2*w2; if(t>0){t*=t;n2=t*t*this.dot4(this.grad4[gi2],x2,y2,z2,w2);}
    t=0.6-x3*x3-y3*y3-z3*z3-w3*w3; if(t>0){t*=t;n3=t*t*this.dot4(this.grad4[gi3],x3,y3,z3,w3);}
    t=0.6-x4*x4-y4*y4-z4*z4-w4*w4; if(t>0){t*=t;n4=t*t*this.dot4(this.grad4[gi4],x4,y4,z4,w4);}
    return 27*(n0+n1+n2+n3+n4);
  }
}

// Map (sx,sy) in [0,1]x[0,1] to a 4D torus for seamless tiling
function torus(sx: number, sy: number, sc: number) {
  const r = sc / (Math.PI * 2);
  return [
    r * Math.cos(sx * Math.PI * 2),
    r * Math.cos(sy * Math.PI * 2),
    r * Math.sin(sx * Math.PI * 2),
    r * Math.sin(sy * Math.PI * 2)
  ];
}

// ---- Noise Functions ----
function nSingle(sn: SimplexNoise4D, sx: number, sy: number, sc: number, seamless: boolean) {
  if (seamless) { const [a,b,c,d]=torus(sx,sy,sc); return sn.eval(a,b,c,d); }
  return sn.eval(sx*sc, sy*sc, 0, 0);
}

function nFbm(sn: SimplexNoise4D, sx: number, sy: number, sc: number, oct: number, per: number, lac: number, seamless: boolean) {
  let v=0, amp=1, freq=1, mx=0;
  for (let o=0; o<oct; o++) {
    const s = sc*freq;
    const n = seamless
      ? (([a,b,c,d])=>sn.eval(a,b,c,d))(torus(sx,sy,s))
      : sn.eval(sx*s, sy*s, 0, 0);
    v += n*amp; mx += amp; amp *= per; freq *= lac;
  }
  return v/mx;
}

function nRidged(sn: SimplexNoise4D, sx: number, sy: number, sc: number, oct: number, per: number, lac: number, seamless: boolean) {
  let v=0, amp=0.5, freq=1, prev=1;
  for (let o=0; o<oct; o++) {
    const s = sc*freq;
    let n = seamless
      ? (([a,b,c,d])=>sn.eval(a,b,c,d))(torus(sx,sy,s))
      : sn.eval(sx*s, sy*s, 0, 0);
    n = 1 - Math.abs(n);
    n = n*n*prev;
    v += n*amp; prev = n; amp *= per; freq *= lac;
  }
  return v*2-1;
}

function nBillow(sn: SimplexNoise4D, sx: number, sy: number, sc: number, oct: number, per: number, lac: number, seamless: boolean) {
  let v=0, amp=1, freq=1, mx=0;
  for (let o=0; o<oct; o++) {
    const s = sc*freq;
    const n = seamless
      ? (([a,b,c,d])=>sn.eval(a,b,c,d))(torus(sx,sy,s))
      : sn.eval(sx*s, sy*s, 0, 0);
    v += Math.abs(n)*amp; mx += amp; amp *= per; freq *= lac;
  }
  return (v/mx)*2-1;
}

function nDomainWarp(sn: SimplexNoise4D, sx: number, sy: number, sc: number, oct: number, per: number, lac: number, seamless: boolean) {
  const wx = nFbm(sn, sx+0.13, sy+0.17, sc, Math.min(oct,5), per, lac, seamless);
  const wy = nFbm(sn, sx+0.73, sy+0.59, sc, Math.min(oct,5), per, lac, seamless);
  const warpAmt = 0.6;
  return nFbm(sn, sx+warpAmt*wx, sy+warpAmt*wy, sc, oct, per, lac, seamless);
}

function nSwiss(sn: SimplexNoise4D, sx: number, sy: number, sc: number, oct: number, per: number, lac: number, seamless: boolean) {
  let v=0, amp=1, freq=1, mx=0;
  let dx=0, dy=0;
  for (let o=0; o<oct; o++) {
    const s=sc*freq;
    const ox=sx+0.2*dx, oy=sy+0.2*dy;
    const n = seamless
      ? (([a,b,c,d])=>sn.eval(a,b,c,d))(torus(ox,oy,s))
      : sn.eval(ox*s, oy*s, 0, 0);
    const r = 1-Math.abs(n);
    v += r*r*amp;
    // gradient approximation for warp
    const eps = 0.001;
    const gx = seamless
      ? (([a,b,c,d])=>sn.eval(a,b,c,d))(torus(ox+eps,oy,s))
      : sn.eval((ox+eps)*s, oy*s, 0, 0);
    dx += Math.abs(gx-n)/eps * amp;
    dy += Math.abs(n) * amp;
    mx += amp; amp *= per; freq *= lac;
  }
  return (v/mx)*2-1;
}

function nJordan(sn: SimplexNoise4D, sx: number, sy: number, sc: number, oct: number, per: number, lac: number, seamless: boolean) {
  const s0=sc;
  const n0 = seamless
    ? (([a,b,c,d])=>sn.eval(a,b,c,d))(torus(sx,sy,s0))
    : sn.eval(sx*s0, sy*s0, 0, 0);
  let v = n0*n0;
  let dAmp = per, freq=lac;
  let wAmp = 0.4;
  for (let o=1; o<oct; o++) {
    const s=sc*freq;
    const n = seamless
      ? (([a,b,c,d])=>sn.eval(a,b,c,d))(torus(sx,sy,s))
      : sn.eval(sx*s, sy*s, 0, 0);
    const w = n*n;
    v += dAmp*w*(1+wAmp*v);
    dAmp *= per; freq *= lac; wAmp *= per;
  }
  return Math.max(-1, Math.min(1, v - 0.5));
}

// Worley / Cellular — seamless via hash-wrapped grid
function nWorley(sx: number, sy: number, sc: number, seed: number, seamless: boolean, mode: string) {
  const gs = Math.max(2, Math.round(sc));
  const px = sx * gs, py = sy * gs;
  const ix = Math.floor(px), iy = Math.floor(py);

  const hashPt = (cx: number, cy: number) => {
    const wcx = ((cx % gs) + gs) % gs;
    const wcy = ((cy % gs) + gs) % gs;
    let h = (wcx * 7919 + wcy * 6271 + seed * 31337) | 0;
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b) | 0;
    const rx = (h >>> 0) / 0x100000000;
    h = Math.imul(h ^ (h >>> 17), 0x8da6b343) | 0;
    const ry = (h >>> 0) / 0x100000000;
    return [rx, ry];
  };

  let d1=Infinity, d2=Infinity;
  for (let dy=-2; dy<=2; dy++) {
    for (let dx=-2; dx<=2; dx++) {
      const cx=ix+dx, cy=iy+dy;
      const [rx, ry] = hashPt(cx, cy);
      let cpx = cx+rx, cpy = cy+ry;
      if (seamless) {
        // nearest periodic copy
        cpx += Math.round((px-cpx)/gs)*gs;
        cpy += Math.round((py-cpy)/gs)*gs;
      }
      const ddx=cpx-px, ddy=cpy-py;
      const dist=ddx*ddx+ddy*ddy;
      if (dist<d1){d2=d1;d1=dist;}else if(dist<d2){d2=dist;}
    }
  }
  d1=Math.sqrt(d1); d2=Math.sqrt(d2);
  const mx=0.707;
  if (mode==='f2f1') return Math.min((d2-d1)/mx,1)*2-1;
  return Math.min(d1/mx,1)*2-1;
}

// Sigmoid contrast centered at threshold
function applyContrast(v: number, thr: number, k: number) {
  if (k <= 0) return v > thr ? 255 : 0;
  // Map v to be centered at thr, then apply sigmoid
  const res = 1 / (1 + Math.exp(-k * (v - thr)));
  return Math.floor(res * 255);
}

// 2D prefix sum for fast dilation
function buildPrefixSum(bin: Uint8Array, W: number, H: number, pad: number) {
  const PW = W+2*pad, PH = H+2*pad;
  const ps = new Int32Array((PW+1)*(PH+1));
  for (let y=0; y<PH; y++) {
    const sy = ((y-pad)%H+H)%H;
    for (let x=0; x<PW; x++) {
      const sx = ((x-pad)%W+W)%W;
      // FIX: Use threshold to define "white" for dilation
      const v = bin[sy*W+sx] > 127 ? 1 : 0;
      ps[(y+1)*(PW+1)+(x+1)] = v
        + ps[y*(PW+1)+(x+1)]
        + ps[(y+1)*(PW+1)+x]
        - ps[y*(PW+1)+x];
    }
  }
  return {ps, PW, PH, pad};
}

function dilateQuery(psd: any, x: number, y: number, r: number) {
  const {ps, PW, pad} = psd;
  const px=x+pad, py=y+pad;
  const x0=Math.max(0,px-r), y0=Math.max(0,py-r);
  const x1=Math.min(PW-1,px+r), y1=Math.min(PW-1,py+r);
  const sum=ps[(y1+1)*(PW+1)+(x1+1)]-ps[y0*(PW+1)+(x1+1)]-ps[(y1+1)*(PW+1)+x0]+ps[y0*(PW+1)+x0];
  return sum>0?255:0;
}

// ---- Main generation ----
self.onmessage = function(e) {
  const p = e.data;
  const {width: W, height: H, layers, threshold, contrast, bias, spread, seamless,
         baseImage, imageIntensity = 1.0, invert} = p;

  const totalPixels = W*H;
  const combined = new Float32Array(totalPixels);

  // Initialize with base image if provided
  if (baseImage) {
    for (let i = 0; i < totalPixels; i++) {
      combined[i] = (baseImage[i] / 255.0) * imageIntensity;
    }
  }

  const blend = (b: number, f: number, mode: string, opacity: number) => {
    let res = f;
    if (mode === 'add') res = b + f;
    else if (mode === 'subtract') res = b - f;
    else if (mode === 'multiply') res = b * f;
    else if (mode === 'screen') res = 1 - (1 - b) * (1 - f);
    else if (mode === 'overlay') res = b < 0.5 ? 2 * b * f : 1 - 2 * (1 - b) * (1 - f);
    return b * (1 - opacity) + res * opacity;
  };

  layers.forEach((layer: any, lIdx: number) => {
    const sn = new SimplexNoise4D(layer.seed);
    for (let y = 0; y < H; y++) {
      const sy = y / H;
      for (let x = 0; x < W; x++) {
        const sx = x / W;
        let v;
        switch(layer.noiseType) {
          case 'perlin':     v=nSingle(sn,sx,sy,layer.scale,seamless); break;
          case 'fbm':        v=nFbm(sn,sx,sy,layer.scale,layer.octaves,layer.persistence,layer.lacunarity,seamless); break;
          case 'ridged':     v=nRidged(sn,sx,sy,layer.scale,layer.octaves,layer.persistence,layer.lacunarity,seamless); break;
          case 'billow':     v=nBillow(sn,sx,sy,layer.scale,layer.octaves,layer.persistence,layer.lacunarity,seamless); break;
          case 'domain_warp':v=nDomainWarp(sn,sx,sy,layer.scale,layer.octaves,layer.persistence,layer.lacunarity,seamless); break;
          case 'swiss':      v=nSwiss(sn,sx,sy,layer.scale,layer.octaves,layer.persistence,layer.lacunarity,seamless); break;
          case 'jordan':     v=nJordan(sn,sx,sy,layer.scale,layer.octaves,layer.persistence,layer.lacunarity,seamless); break;
          case 'worley_f1':  v=nWorley(sx,sy,layer.scale,layer.seed,seamless,'f1'); break;
          case 'worley_f2f1':v=nWorley(sx,sy,layer.scale,layer.seed,seamless,'f2f1'); break;
          default:           v=nFbm(sn,sx,sy,layer.scale,layer.octaves,layer.persistence,layer.lacunarity,seamless);
        }
        
        // Normalize to [0, 1]
        v = (v + 1) / 2;
        if (layer.invert) v = 1 - v;

        const idx = y * W + x;
        if (lIdx === 0 && !baseImage) {
          combined[idx] = v * layer.intensity;
        } else {
          combined[idx] = blend(combined[idx], v, layer.blendMode || 'normal', layer.intensity);
        }
      }
    }
    self.postMessage({type:'progress', progress: (lIdx + 1) / layers.length * 0.7});
  });

  // Normalize final combined result to [0,1]
  let mn=Infinity, mx=-Infinity;
  for (let i=0;i<totalPixels;i++){if(combined[i]<mn)mn=combined[i];if(combined[i]>mx)mx=combined[i];}
  const rng = mx-mn || 1;
  for (let i=0;i<totalPixels;i++) combined[i]=(combined[i]-mn)/rng;

  self.postMessage({type:'progress', progress: 0.75});

  // Apply bias + contrast + threshold
  const binary = new Uint8Array(totalPixels);
  for (let i=0;i<totalPixels;i++) {
    const v = Math.max(0, Math.min(1, combined[i]+bias));
    binary[i] = applyContrast(v, threshold, contrast);
  }

  self.postMessage({type:'progress', progress: 0.8});

  // Apply dilation (island spread)
  let final = binary;
  if (spread > 0) {
    const psd = buildPrefixSum(binary, W, H, spread);
    final = new Uint8Array(totalPixels);
    for (let y=0; y<H; y++) {
      for (let x=0; x<W; x++) {
        final[y*W+x] = dilateQuery(psd, x, y, spread);
      }
      if (y % 256 === 0) {
        self.postMessage({type:'progress', progress: 0.8 + 0.18*(y/H)});
      }
    }
  }

  // Build RGBA for canvas
  const rgba = new Uint8ClampedArray(W*H*4);
  for (let i=0;i<totalPixels;i++) {
    let v=final[i];
    if (invert) v = 255 - v;
    rgba[i*4]=v; rgba[i*4+1]=v; rgba[i*4+2]=v; rgba[i*4+3]=255;
  }

  self.postMessage({type:'progress', progress:1.0});
  self.postMessage({type:'done', rgba, width:W, height:H, final}, [rgba.buffer, final.buffer] as any);
};
