declare module "melonjs" {
    
    export const audio: any;
    export const debug: any;
    export const device: any;
    export const event: any;
    export const game: any;
    export const input: any;
    export const loader: any;
    export const plugin: any;
    export const pool: any;
    export const state: any;
    export const video: any;

    export class Stage {
    }

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