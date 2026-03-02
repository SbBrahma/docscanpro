export interface Point {
  x: number;
  y: number;
}

export interface Page {
  id: string;
  originalImage: string; // base64
  processedImage: string; // base64 (cropped/straightened)
  corners: Point[];
  aspectRatio: number;
  rotation: number; // degrees: 0, 90, 180, 270
}

export type AppState = 'idle' | 'camera' | 'cropping' | 'exporting';
