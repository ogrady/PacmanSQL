import me from "./me";
import * as fp from "./functools";
import * as t from "./types";

export const BACKGROUND_COLOUR = "#00121c";

class DBRenderable extends me.Renderable {
    public readonly dbId: number;

    public constructor(dbId: number, x: number, y: number, width: number, height: number) {
        super(x, y, width, height);
        this.dbId = dbId;
    }
}

export class Pacman extends DBRenderable {
    private mouths: any[]; // "cannot find namespace 'me'" my ass.
    private mouthFrame: number;
    private mouthRotation: number;

    public constructor(dbId: number, position: t.Coordinate, radius: number, z: number = 1000) {
        super(dbId, position[0], position[1], radius, radius);
        this.z = z;

        const targetFrameCount = 12;
        const [minY, maxY] = [2, 20];
        this.mouths = [];
        const d = (maxY - minY) / targetFrameCount + minY;
        // bit of a dirty hack because I can not be arsed to properly use melonjs sprites with my DB backend... 
        // this creates a series of triangles of varying angle which have their cone point at Pacman's center. 
        // each triangle is longer than Pacman's width / 2, so drawing that triangle over the yellow body 
        // in the background colour will look like an open mouth.
        this.mouths = fp.range(targetFrameCount)
                      .map(i => new me.Polygon(0,0, [[0,0],[radius/2, -i*d], [radius/2, i*d]].map(([x,y]) => new me.Vector2d(x, y))));
        this.mouthFrame = 0;
        this.mouthRotation = 0;
    }

    private nextFrame() {
        this.mouthFrame = (this.mouthFrame + 1) % this.mouths.length;
        return this.mouths[this.mouthFrame].clone();
    }

    public setPosition(x: number, y: number): void {
        if(x != this.pos.x || y != this.pos.y) {
            if(x < this.pos.x) this.mouthRotation = Math.PI; // 180°
            else if (x > this.pos.x) this.mouthRotation = 0;
            else if (y < this.pos.y) this.mouthRotation = 270 * Math.PI / 180; // 270°
            else if (y > this.pos.y) this.mouthRotation = 90 * Math.PI / 180; // 90°
            this.pos.x = x;
            this.pos.y = y;
            this.isDirty = true;
        }
    }

    public draw(renderer: any) {
        renderer.setColor("#fcba03");
        renderer.fillEllipse(this.pos.x, this.pos.y, 25, 25);
        renderer.setColor(BACKGROUND_COLOUR);
        //renderer.setColor("#ff0000");
        const mouth = this.nextFrame();
        mouth.points.map((v: any) => v.rotate(this.mouthRotation));
        mouth.pos.x = this.pos.x;
        mouth.pos.y = this.pos.y;
        renderer.fill(mouth);
    }
}

export class Pellet extends me.Renderable {
    public constructor(coordinate: t.Coordinate, 
                       colour: string = "#fff", 
                       radius: number = 7, 
                       z: number = 1000)
    {
        super(coordinate[0], coordinate[1], radius, radius);
        this.colour = colour;
        this.z = z;
    }

    public draw(renderer: any) {
        renderer.setColor(this.colour);
        renderer.fillEllipse(this.pos.x, this.pos.y, this.width, this.width);
    }
}

export class Wall extends me.Renderable {
    public constructor(points: t.Point[], 
                       colour: string = "#2a9adb", 
                       z: number = 100, 
                       lineWidth: number = 2) 
    {
        const xs: number[] = points.map(p => p[0]);
        const ys: number[] = points.map(p => p[1]);
        const x: number = Math.min(...xs);
        const y: number = Math.min(...ys);
        const w: number = Math.max(...xs) - x;
        const h: number = Math.max(...ys) - y;
        super(x, y, w, h);
        this.z = z;
        this.colour = colour;
        this.lineWidth = lineWidth;
        const vectors = points.map(xy => new me.Vector2d(xy[0], xy[1]))
        this.polygon = new me.Polygon(x, y, vectors);
    }

    public draw(renderer: any) {
        renderer.setColor(this.colour);
        renderer.setLineWidth(this.lineWidth);
        renderer.stroke(this.polygon);
    }
}