import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, RefreshCw, Circle, Smartphone, SmartphoneNfc, Monitor, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface ScannerProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

export function Scanner({ onCapture, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsReady(true);
        }
      } catch (err) {
        console.error('Camera error:', err);
        setError('Could not access camera. Please ensure you have granted permissions.');
      }
    }
    setupCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      onCapture(canvas.toDataURL('image/jpeg', 0.9));
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
        <button 
          onClick={onClose}
          className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
        >
          <X size={24} />
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
            className="flex items-center gap-2 px-4 py-1 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors text-sm font-medium"
          >
            {orientation === 'portrait' ? <Smartphone size={16} /> : <Smartphone className="rotate-90" size={16} />}
            {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
          </button>
        </div>
        <div className="w-10" /> {/* spacer */}
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-white text-center p-6">
            <p className="mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white text-black rounded-lg font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Overlay Guide */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
          <motion.div 
            animate={{ aspectWith: orientation === 'portrait' ? '1/1.414' : '1.414/1' }}
            className={cn(
              "w-full border-2 border-white/50 rounded-lg relative transition-all duration-300",
              orientation === 'portrait' ? "aspect-[1/1.414] max-h-[80%]" : "aspect-[1.414/1] max-w-[90%]"
            )}
          >
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
          </motion.div>
        </div>
      </div>

      <div className="h-32 bg-black flex items-center justify-center px-8">
        <button
          onClick={capture}
          disabled={!isReady}
          className={cn(
            "w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-95",
            !isReady && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
            <Camera size={32} className="text-black" />
          </div>
        </button>
      </div>
    </div>
  );
}
