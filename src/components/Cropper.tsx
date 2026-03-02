import React, { useState, useRef, useEffect } from 'react';
import { Check, X, RotateCcw, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';
import { Point } from '@/src/types';
import { transformImage, rotateImage } from '@/src/lib/imageProcessing';
import { cn } from '@/src/lib/utils';

interface CropperProps {
  imageSrc: string;
  onDone: (processedImage: string, corners: Point[], rotation: number, targetRatio: number) => void;
  onCancel: () => void;
}

export function Cropper({ imageSrc, onDone, onCancel }: CropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [rotation, setRotation] = useState(0);
  const [corners, setCorners] = useState<Point[]>([
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.width, h: img.height });
      updateDisplaySize(img.width, img.height);
    };
    img.src = imageSrc;

    window.addEventListener('resize', () => {
      if (img.width) updateDisplaySize(img.width, img.height);
    });
  }, [imageSrc]);

  const updateDisplaySize = (w: number, h: number) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const padding = 40;
    const maxW = container.clientWidth - padding;
    const maxH = container.clientHeight - padding;
    
    let dw = w;
    let dh = h;
    const ratio = w / h;

    if (dw > maxW) {
      dw = maxW;
      dh = dw / ratio;
    }
    if (dh > maxH) {
      dh = maxH;
      dw = dh * ratio;
    }
    setDisplaySize({ w: dw, h: dh });
  };

  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    setDraggingIdx(idx);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = (rect.width - displaySize.w) / 2;
    const offsetY = (rect.height - displaySize.h) / 2;

    const x = (e.clientX - rect.left - offsetX) / displaySize.w;
    const y = (e.clientY - rect.top - offsetY) / displaySize.h;

    const newCorners = [...corners];
    newCorners[draggingIdx] = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
    setCorners(newCorners);
  };

  const handlePointerUp = () => {
    setDraggingIdx(null);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDone = async () => {
    // Calculate target aspect ratio based on corners using absolute pixel coordinates
    const p0 = { x: corners[0].x * imgSize.w, y: corners[0].y * imgSize.h };
    const p1 = { x: corners[1].x * imgSize.w, y: corners[1].y * imgSize.h };
    const p2 = { x: corners[2].x * imgSize.w, y: corners[2].y * imgSize.h };
    const p3 = { x: corners[3].x * imgSize.w, y: corners[3].y * imgSize.h };

    const w1 = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
    const w2 = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));
    const h1 = Math.sqrt(Math.pow(p3.y - p0.y, 2) + Math.pow(p3.x - p0.x, 2));
    const h2 = Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));
    
    const avgW = (w1 + w2) / 2;
    const avgH = (h1 + h2) / 2;
    const targetRatio = avgW / avgH;

    const targetWidth = 2400;
    const targetHeight = targetWidth / targetRatio;

    const absoluteCorners = [p0, p1, p2, p3];

    let processed = await transformImage(imageSrc, absoluteCorners, targetWidth, targetHeight);
    
    if (rotation !== 0) {
      processed = await rotateImage(processed, rotation);
    }

    onDone(processed, corners, rotation, targetRatio);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col">
      <div className="p-4 flex justify-between items-center bg-zinc-900 border-b border-zinc-800">
        <button onClick={onCancel} className="p-2 text-zinc-400 hover:text-white">
          <X size={24} />
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleRotate}
            className="p-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2 text-sm"
          >
            <RotateCw size={18} />
            Rotate
          </button>
          <span className="text-white font-medium hidden sm:inline">Adjust Corners</span>
        </div>
        <button 
          onClick={handleDone}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
        >
          <Check size={20} />
          Done
        </button>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <motion.div 
          animate={{ rotate: rotation }}
          className="relative shadow-2xl transition-transform duration-300"
          style={{ width: displaySize.w, height: displaySize.h }}
        >
          <img 
            src={imageSrc} 
            className="w-full h-full object-contain select-none pointer-events-none"
            alt="Crop target"
          />
          
          {/* Overlay SVG for lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <polygon
              points={corners.map(p => `${p.x * displaySize.w},${p.y * displaySize.h}`).join(' ')}
              fill="rgba(16, 185, 129, 0.1)"
              stroke="#10b981"
              strokeWidth="2"
            />
          </svg>

          {/* Draggable Corners */}
          {corners.map((p, i) => (
            <div
              key={i}
              onPointerDown={(e) => handlePointerDown(e, i)}
              className={cn(
                "absolute w-8 h-8 -ml-4 -mt-4 bg-white border-2 border-emerald-500 rounded-full shadow-lg cursor-move z-10 flex items-center justify-center",
                draggingIdx === i && "scale-125 bg-emerald-50"
              )}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            >
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            </div>
          ))}
        </motion.div>
      </div>

      <div className="p-6 bg-zinc-900 text-zinc-400 text-sm text-center">
        Drag the corners to align with the document edges. Use Rotate if needed.
      </div>
    </div>
  );
}
