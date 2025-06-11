declare module 'ico-endec' {
  export function decode(buffer: Buffer): Array<{
    _width: number;
    _height: number;
    _imageType: string;
    _imageData: Buffer;
  }>;
  
  export function encode(icons: Array<{
    width: number;
    height: number;
    bpp: number;
    data: Buffer;
  }>): ArrayBuffer;
}

declare module 'colorsys' {
  export function rgb_to_hsv(color: { r: number; g: number; b: number }): { h: number; s: number; v: number };
  export function hsv_to_rgb(color: { h: number; s: number; v: number }): { r: number; g: number; b: number };
} 