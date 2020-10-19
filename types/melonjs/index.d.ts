declare module "melonjs" {
    export class Renderable{
        public static extend(x: any): any;
    }

    export class Renderer {
        public setColor(c: any): void;
        public fillEllipse(x: number, y: number, w: number, h: number): void;
        public setLineWidth(w: number): void;
        public stroke(shape: any): void;
    }

    export class Vector2d {
        constructor(x: number, y: number);
    }

    export class Polygon {
        constructor(x: number, y: number, points: Vector2d[]);
    }
}