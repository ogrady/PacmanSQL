import * as me from "melonjs";
import * as be from "./backend";

const Pellet = me.Renderable.extend({
    init : function(coordinate: be.Coordinate, 
                    colour: string = "#fff", 
                    radius: number = 7, 
                    z: number = 1000) 
    {
        const [x, y]: [number, number] = coordinate;
        this.coordinate = coordinate;
        this.colour = colour;
        this.radius = radius;           
        this._super(me.Renderable, "init", [x, y, radius, radius]);
        this.z = z;
        this.colour = colour;
    },

    update : () => false,

    draw : function (renderer: me.Renderer) {
        renderer.setColor(this.colour);
        renderer.fillEllipse(this.coordinate[0], this.coordinate[1], this.radius, this.radius);
    }
});

const Wall = me.Renderable.extend({
    init : function(points: be.Point[], 
                    colour: string = "#2a9adb", 
                    z: number = 100, 
                    lineWidth: number = 2) 
    {
        // position, width, height
        const xs: number[] = points.map(p => p[0]);
        const ys: number[] = points.map(p => p[1]);
        const x: number = Math.min(...xs);
        const y: number = Math.min(...ys);
        const w: number = Math.max(...xs) - x;
        const h: number = Math.max(...ys) - y;
        this._super(me.Renderable, "init", [x, y, w, h]);
        this.z = z;
        this.colour = colour;
        this.lineWidth = lineWidth;
        const vectors = [];
        for(const [x, y] of points) {
            vectors.push(new me.Vector2d(x, y));
        }
        const [ox, oy] = points[0];
        this.polygon = new me.Polygon(ox, oy, vectors);
    },

    update : () => false,

    draw : function (renderer: me.Renderer) {
        renderer.setColor(this.colour);
        renderer.setLineWidth(this.lineWidth);
        renderer.stroke(this.polygon);
    }
});