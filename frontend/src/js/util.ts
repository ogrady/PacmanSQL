export function hexToRgb(hex: string): [number,number,number] {
  var res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return res ? res.slice(1).map(c => parseInt(c, 16)) as [number,number,number] : [255,255,255];
}

export function rgbToHex([r,g,b]: [number, number, number]) {
    const hex = (c: number): string => {
        var h = c.toString(16);
        return h.length == 1 ? "0" + h : h;
    }
    return "#" + hex(r) + hex(g) + hex(b);
}

export function gradToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}