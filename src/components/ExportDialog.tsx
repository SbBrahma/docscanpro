import React, { useState } from 'react';
import { Download, FileType, Settings2, Loader2, ChevronDown } from 'lucide-react';
import { Page } from '@/src/types';
import jsPDF from 'jspdf';

interface ExportDialogProps {
  pages: Page[];
  onClose: () => void;
}

export function ExportDialog({ pages, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'pdf' | 'jpg'>('pdf');
  const [exportMode, setExportMode] = useState<'size' | 'quality'>('size');
  const [targetSize, setTargetSize] = useState<string>('2');
  const [unit, setUnit] = useState<'MB' | 'KB'>('MB');
  const [qualityPreference, setQualityPreference] = useState<number>(0.8);
  const [isExporting, setIsExporting] = useState(false);

  const getTargetBytes = () => {
    const val = parseFloat(targetSize) || 0;
    return unit === 'MB' ? val * 1024 * 1024 : val * 1024;
  };

  const compressImage = async (
    base64: string, 
    mode: 'size' | 'quality',
    limitPerImage: number,
    fixedQuality: number
  ): Promise<{ data: string, quality: number }> => {
    const img = new Image();
    img.src = base64;
    await new Promise(resolve => img.onload = resolve);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { data: base64, quality: 1 };

    const getResizedData = (w: number, h: number, q: number) => {
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const data = canvas.toDataURL('image/jpeg', q);
      const size = Math.floor(data.length * 0.75);
      return { data, size };
    };

    if (mode === 'quality') {
      const result = getResizedData(img.width, img.height, fixedQuality);
      return { data: result.data, quality: fixedQuality };
    }

    // Mode: Size
    let currentWidth = img.width;
    let currentHeight = img.height;

    // Try at 100% quality first
    let result = getResizedData(currentWidth, currentHeight, 1.0);
    if (result.size <= limitPerImage) return { data: result.data, quality: 1.0 };

    // Binary search for quality (0.05 to 1.0)
    let minQ = 0.05;
    let maxQ = 1.0;
    let bestData = result.data;
    let bestQ = 1.0;

    for (let i = 0; i < 10; i++) {
      const midQ = (minQ + maxQ) / 2;
      result = getResizedData(currentWidth, currentHeight, midQ);
      if (result.size <= limitPerImage) {
        bestData = result.data;
        bestQ = midQ;
        minQ = midQ;
      } else {
        maxQ = midQ;
      }
    }

    // If still too big at 0.05 quality, start downscaling
    if (Math.floor(bestData.length * 0.75) > limitPerImage) {
      let scale = 0.9;
      while (scale > 0.1) {
        result = getResizedData(img.width * scale, img.height * scale, 0.1);
        if (result.size <= limitPerImage) return { data: result.data, quality: 0.1 };
        scale -= 0.1;
      }
    }
    
    return { data: bestData, quality: bestQ };
  };

  const handleExport = async () => {
    setIsExporting(true);
    const targetBytes = getTargetBytes();
    const pdfOverhead = (pages.length * 3072) + 15360; 
    const availableBytes = Math.max(targetBytes * 0.1, targetBytes - pdfOverhead);
    const limitPerImage = availableBytes / pages.length;

    try {
      if (format === 'pdf') {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        for (let i = 0; i < pages.length; i++) {
          if (i > 0) pdf.addPage();
          
          const { data } = await compressImage(pages[i].processedImage, exportMode, limitPerImage, qualityPreference);
          
          const imgRatio = pages[i].aspectRatio;
          const pageRatio = pageWidth / pageHeight;
          
          let drawW = pageWidth;
          let drawH = pageHeight;
          let x = 0;
          let y = 0;
          
          if (imgRatio > pageRatio) {
            drawH = pageWidth / imgRatio;
            y = (pageHeight - drawH) / 2;
          } else {
            drawW = pageHeight * imgRatio;
            x = (pageWidth - drawW) / 2;
          }
          
          pdf.addImage(data, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
        }
        pdf.save(`scanned_document_${Date.now()}.pdf`);
      } else {
        for (let i = 0; i < pages.length; i++) {
          const { data } = await compressImage(pages[i].processedImage, exportMode, limitPerImage, qualityPreference);
          const link = document.createElement('a');
          link.href = data;
          link.download = `page_${i + 1}_${Date.now()}.jpg`;
          link.click();
        }
      }
      onClose();
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-zinc-900">Export Settings</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <Settings2 size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">File Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  format === 'pdf' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                }`}
              >
                <FileType size={20} />
                <span className="font-bold">PDF</span>
              </button>
              <button
                onClick={() => setFormat('jpg')}
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  format === 'jpg' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                }`}
              >
                <FileType size={20} />
                <span className="font-bold">JPG</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Export Mode</label>
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button
                onClick={() => setExportMode('size')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                  exportMode === 'size' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                By Size
              </button>
              <button
                onClick={() => setExportMode('quality')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                  exportMode === 'quality' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                By Quality
              </button>
            </div>
          </div>

          {exportMode === 'size' ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Target File Size</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={targetSize}
                    onChange={(e) => setTargetSize(e.target.value)}
                    className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-xl focus:border-emerald-500 focus:outline-none transition-all font-bold text-lg"
                    placeholder="e.g. 2"
                  />
                </div>
                <div className="relative">
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as 'MB' | 'KB')}
                    className="appearance-none h-full bg-zinc-100 border-2 border-zinc-100 rounded-xl px-6 font-bold text-zinc-700 focus:outline-none focus:border-emerald-500 cursor-pointer pr-10"
                  >
                    <option value="MB">MB</option>
                    <option value="KB">KB</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" size={16} />
                </div>
              </div>
              <p className="text-xs text-zinc-400">The app will automatically adjust quality to stay under {targetSize} {unit}.</p>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Visual Quality</label>
                <span className="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-0.5 rounded-md">
                  {Math.round(qualityPreference * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={qualityPreference}
                onChange={(e) => setQualityPreference(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                <span>Small File</span>
                <span>Balanced</span>
                <span>Best Quality</span>
              </div>
              <p className="text-xs text-zinc-400">Images will be saved at exactly {Math.round(qualityPreference * 100)}% quality.</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-zinc-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 font-bold text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-[2] bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Download size={20} />
            )}
            {isExporting ? 'Processing...' : 'Export Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
