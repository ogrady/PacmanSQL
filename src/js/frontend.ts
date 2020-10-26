import me from './me';
import * as be from "./backend";

export class Pacman extends me.Renderable {
    public constructor(position: be.Coordinate, z: number = 1000) {
        super(position[0], position[1]);
        this.z = z;
    }

    public setPosition(x: number, y: number): void {
        if(x != this.pos.x || y != this.pos.y) {
            this.pos.x = x;
            this.pos.y = y;
            this.isDirty = true;
        }
    }

    public draw(renderer: any) {
        console.log(this.pos);
        renderer.setColor("#fcba03");
        renderer.fillEllipse(this.pos.x, this.pos.y, 20, 20);
    }

}

export class Pellet extends me.Renderable {
    public constructor(coordinate: be.Coordinate, 
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
    public constructor(points: be.Point[], 
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