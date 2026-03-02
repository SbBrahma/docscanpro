/**
 * Computes the homography matrix for perspective transformation.
 * Maps (0,0), (w,0), (w,h), (0,h) to the four given points.
 */
export function getPerspectiveTransform(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[]
) {
  const n = 4;
  const a = [];
  for (let i = 0; i < n; i++) {
    a.push([
      src[i].x, src[i].y, 1, 0, 0, 0, -dst[i].x * src[i].x, -dst[i].x * src[i].y
    ]);
    a.push([
      0, 0, 0, src[i].x, src[i].y, 1, -dst[i].y * src[i].x, -dst[i].y * src[i].y
    ]);
  }

  const b = [];
  for (let i = 0; i < n; i++) {
    b.push(dst[i].x);
    b.push(dst[i].y);
  }

  const h = solve(a, b);
  return h ? [...h, 1] : null;
}

/**
 * Simple Gaussian elimination to solve Ax = B
 */
function solve(A: number[][], b: number[]) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[j][i]) > Math.abs(A[max][i])) max = j;
    }
    [A[i], A[max]] = [A[max], A[i]];
    [b[i], b[max]] = [b[max], b[i]];

    for (let j = i + 1; j < n; j++) {
      const factor = A[j][i] / A[i][i];
      b[j] -= factor * b[i];
      for (let k = i; k < n; k++) {
        A[j][k] -= factor * A[i][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * x[j];
    }
    x[i] = (b[i] - sum) / A[i][i];
  }
  return x;
}

/**
 * Applies perspective transformation to an image on a canvas.
 */
export async function transformImage(
  imageSrc: string,
  corners: { x: number; y: number }[],
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // We use a simpler approach for the applet: 
      // Instead of manual pixel manipulation (slow in JS),
      // we'll use the CSS transform trick or a small helper if needed.
      // Actually, for a real "save as", we need the pixels.
      // Let's use a basic homography-based pixel mapping.
      
      const h = getPerspectiveTransform(
        [
          { x: 0, y: 0 },
          { x: targetWidth, y: 0 },
          { x: targetWidth, y: targetHeight },
          { x: 0, y: targetHeight },
        ],
        corners
      );

      if (!h) {
        resolve(imageSrc);
        return;
      }

      // For performance in JS without OpenCV, we can use a temporary canvas and drawImage with clipping,
      // but that doesn't do perspective. 
      // Let's implement a basic scanline perspective warp.
      
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const offCtx = offCanvas.getContext('2d');
      offCtx?.drawImage(img, 0, 0);
      const imgData = offCtx?.getImageData(0, 0, img.width, img.height);
      const outData = ctx.createImageData(targetWidth, targetHeight);

      if (!imgData) return;

      const data = imgData.data;
      const width = img.width;
      const height = img.height;

      for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
          const denominator = h[6] * x + h[7] * y + h[8];
          const srcX = (h[0] * x + h[1] * y + h[2]) / denominator;
          const srcY = (h[3] * x + h[4] * y + h[5]) / denominator;

          if (srcX >= 0 && srcX < width - 1 && srcY >= 0 && srcY < height - 1) {
            const x1 = Math.floor(srcX);
            const y1 = Math.floor(srcY);
            const x2 = x1 + 1;
            const y2 = y1 + 1;

            const dx = srcX - x1;
            const dy = srcY - y1;

            const idx11 = (y1 * width + x1) * 4;
            const idx12 = (y1 * width + x2) * 4;
            const idx21 = (y2 * width + x1) * 4;
            const idx22 = (y2 * width + x2) * 4;

            const outIdx = (y * targetWidth + x) * 4;

            for (let i = 0; i < 4; i++) {
              const val = 
                data[idx11 + i] * (1 - dx) * (1 - dy) +
                data[idx12 + i] * dx * (1 - dy) +
                data[idx21 + i] * (1 - dx) * dy +
                data[idx22 + i] * dx * dy;
              outData.data[outIdx + i] = val;
            }
          }
        }
      }

      ctx.putImageData(outData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 1.0));
    };
    img.src = imageSrc;
  });
}

/**
 * Rotates an image by a given angle (90, 180, 270).
 */
export async function rotateImage(imageSrc: string, degrees: number): Promise<string> {
  if (degrees === 0) return imageSrc;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (degrees === 90 || degrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL('image/jpeg', 1.0));
    };
    img.src = imageSrc;
  });
}
