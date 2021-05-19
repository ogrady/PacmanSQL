function mulberry32(a: number): () => number {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const colrng = mulberry32(42);

export function hexToRgb(hex: string): [number,number,number] {
  var res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return res ? res.slice(1).map(c => parseInt(c, 16)) as [number,number,number] : [255,255,255];
}

export function rgbToHex([r,g,b]: [number, number, number]) {
    console.log(r,g,b);
    const hex = function(c: number): string {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
    return "#" + hex(r) + hex(g) + hex(b);
}

export function randomColour(): [number, number, number] {
    return [colrng(), colrng(), colrng()].map(c => Math.round(c * 255)) as [number, number, number];
}

export function gradToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}