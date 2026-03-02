import React, { useState, useCallback } from 'react';
import { 
  Camera, 
  Upload, 
  FilePlus, 
  Trash2, 
  Download, 
  Plus, 
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Scan,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Page, AppState } from './types';
import { Scanner } from './components/Scanner';
import { Cropper } from './components/Cropper';
import { ExportDialog } from './components/ExportDialog';
import { cn } from './lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path for PDF.js using Vite's URL constructor
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageIdx, setActivePageIdx] = useState<number | null>(null);
  const [currentOriginal, setCurrentOriginal] = useState<string | null>(null);

  const handleCapture = (base64: string) => {
    setCurrentOriginal(base64);
    setState('cropping');
  };

  const handleCropDone = (processed: string, corners: any, rotation: number, targetRatio: number) => {
    const newPage: Page = {
      id: Math.random().toString(36).substr(2, 9),
      originalImage: currentOriginal!,
      processedImage: processed,
      corners: corners,
      aspectRatio: targetRatio,
      rotation: rotation
    };
    setPages(prev => [...prev, newPage]);
    setState('idle');
    setCurrentOriginal(null);
  };

  const removePage = (id: string) => {
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async () => {
        const typedarray = new Uint8Array(reader.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ 
            canvasContext: context!, 
            viewport,
            // @ts-ignore - pdfjs types can be tricky
            canvas: canvas
          }).promise;
          const base64 = canvas.toDataURL('image/jpeg', 0.9);
          
          // For PDFs, we add them directly as processed pages for now, 
          // or we could send them to cropper. Let's send to cropper for the first one at least?
          // Actually, let's just add them.
          const newPage: Page = {
            id: Math.random().toString(36).substr(2, 9),
            originalImage: base64,
            processedImage: base64,
            corners: [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],
            aspectRatio: viewport.width / viewport.height,
            rotation: 0
          };
          setPages(prev => [...prev, newPage]);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        handleCapture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 px-4 py-4 md:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Scan className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 leading-none">DocScan Pro</h1>
              <p className="text-xs text-zinc-500 font-medium mt-1">Professional Document Scanner</p>
            </div>
          </div>
          
          {pages.length > 0 && (
            <button
              onClick={() => setState('exporting')}
              className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-zinc-200"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Export</span>
              <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                {pages.length}
              </span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {pages.length === 0 ? (
          <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-8">
            <div className="relative">
              <div className="absolute -inset-4 bg-emerald-100 rounded-full blur-2xl opacity-50 animate-pulse" />
              <div className="relative w-32 h-32 bg-white rounded-3xl shadow-xl flex items-center justify-center border border-zinc-100">
                <FileText size={64} className="text-emerald-500" />
              </div>
            </div>
            
            <div className="max-w-sm space-y-2">
              <h2 className="text-2xl font-bold text-zinc-900">No documents yet</h2>
              <p className="text-zinc-500">Scan your first document using your camera or upload an existing file.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
              <button
                onClick={() => setState('camera')}
                className="group flex flex-col items-center gap-4 p-8 bg-white rounded-3xl border-2 border-zinc-100 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-50 transition-all"
              >
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Camera size={28} />
                </div>
                <span className="font-bold text-zinc-700">Scan Camera</span>
              </button>

              <label className="group flex flex-col items-center gap-4 p-8 bg-white rounded-3xl border-2 border-zinc-100 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-50 transition-all cursor-pointer">
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Upload size={28} />
                </div>
                <span className="font-bold text-zinc-700">Upload File</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-end">
              <h2 className="text-2xl font-bold text-zinc-900">Pages ({pages.length})</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setState('camera')}
                  className="p-3 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:text-emerald-500 hover:border-emerald-500 transition-all shadow-sm"
                >
                  <Camera size={20} />
                </button>
                <label className="p-3 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:text-emerald-500 hover:border-emerald-500 transition-all shadow-sm cursor-pointer">
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                  <Plus size={20} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {pages.map((page, idx) => (
                  <motion.div
                    key={page.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-[1/1.414] bg-white rounded-2xl shadow-md border border-zinc-100 overflow-hidden"
                  >
                    <img 
                      src={page.processedImage} 
                      className="w-full h-full object-cover"
                      alt={`Page ${idx + 1}`}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                      <div className="flex justify-between">
                        <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full">
                          PAGE {idx + 1}
                        </span>
                        <button 
                          onClick={() => removePage(page.id)}
                          className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <button 
                        onClick={() => {
                          setCurrentOriginal(page.originalImage);
                          setState('cropping');
                          // This is a simplification, ideally we'd replace the page
                        }}
                        className="w-full py-2 bg-white/20 backdrop-blur-md text-white rounded-xl text-xs font-bold hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
                      >
                        <Maximize2 size={12} />
                        Re-adjust
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {state === 'camera' && (
          <Scanner 
            onCapture={handleCapture}
            onClose={() => setState('idle')}
          />
        )}
        {state === 'cropping' && currentOriginal && (
          <Cropper 
            imageSrc={currentOriginal}
            onDone={handleCropDone}
            onCancel={() => {
              setState('idle');
              setCurrentOriginal(null);
            }}
          />
        )}
        {state === 'exporting' && (
          <ExportDialog 
            pages={pages}
            onClose={() => setState('idle')}
          />
        )}
      </AnimatePresence>

      {/* Footer info for mobile */}
      <footer className="md:hidden p-4 text-center text-[10px] text-zinc-400 font-medium uppercase tracking-widest">
        Optimized for Mobile Scanning
      </footer>
    </div>
  );
}
