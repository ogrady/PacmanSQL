import me from "./me";
import * as fp from "./functools";
import * as t from "./types";

export const BACKGROUND_COLOUR = "#00121c";

function hexToRgb(hex: string): [number,number,number] {
  var res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return res ? res.slice(1).map(c => parseInt(c, 16)) as [number,number,number] : [255,255,255];
}

function gradToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

export abstract class DBEntity extends me.Entity {
    public readonly dbId: number;
    protected orientation: Orientation;
    protected rotation: number;

    public constructor(dbId: number, x: number, y: number, settings: object) {
        super(x, y, settings);
        this.dbId = dbId;
        this.orientation = Orientation.RIGHT;
        this.rotation = 0;
    }

    private straighten() {
        if(this.rotation != 0) {
            this.renderable.rotate(-this.rotation);
            this.rotation = 0;
        }
        return this.renderable;
    }

    private absoluteRotation(degree: number) {
        if(this.rotation != degree) {
            this.straighten().rotate(degree);
            this.rotation = degree;
        }
    }

    public setPosition(x: number, y: number): void {
        if(x != this.pos.x || y != this.pos.y) {
            if(x < this.pos.x) {
                this.orientation = Orientation.LEFT;
                this.straighten();
                this.renderable.flipX(true);
                this.faceLeft();
            }
            else if (x > this.pos.x) {
                this.orientation = Orientation.RIGHT;
                this.straighten();
                this.renderable.flipX(false);
                this.faceRight();
            }
            else if (y < this.pos.y) {
                this.orientation = Orientation.UP;
                this.absoluteRotation(gradToRad(-90));
                this.faceUp();
            }
            else if (y > this.pos.y) {
                this.orientation = Orientation.DOWN;
                this.absoluteRotation(gradToRad(90));
                this.faceDown();
            }
            this.pos.x = x;
            this.pos.y = y;

            this.isDirty = true;
            this.renderable.isDirty = true;
        }
    }

    protected faceLeft(){};
    protected faceRight(){};
    protected faceUp(){};
    protected faceDown(){};
}


export class Ghost extends DBEntity {
    private colour: string;

    public constructor(dbId: number, position: t.Coordinate, colour = "#ff0000") {
        super(dbId, position[0], position[1], {width: 46, height: 46});
        this.colour = colour;
        this.renderable = new me.Sprite(position[0], position[1], {
            image: "ghost_body",
            framewidth: 32,
            frameheight: 32,
        });

        this.renderable.resize(60,60);
        this.renderable.addAnimation("walk", [0,1], 400);
        this.renderable.setCurrentAnimation("walk");
        const rgb = hexToRgb(this.colour);
        this.renderable.tint.setColor(...hexToRgb(this.colour));

        this.faceDown();
    }

    protected faceLeft(){
    }

    protected faceRight(){
    }

    protected faceUp(){
    }

    protected faceDown(){
    }
}

enum Orientation {
    LEFT, UP, RIGHT, DOWN
}



export class Pacman extends DBEntity {
    private nextFrame = 1;
    private accu = 0;

    public constructor(dbId: number, position: t.Coordinate) {
        super(dbId, position[0], position[1], {width: 46, height: 46});

        this.renderable = new me.Sprite(position[0], position[1], {
            image: "pacman",
            framewidth: 32,
            frameheight: 32,
        });

        this.renderable.addAnimation("walk", [0,1,2,3,4,5], 100);
        this.renderable.addAnimation("stand", [3], 100);
        this.renderable.setCurrentAnimation("walk");
        this.renderable.tint.setColor(245, 230, 66)
         //me.game.viewport.follow(this.pos, me.game.viewport.AXIS.BOTH, 0.4);
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
                       lineWidth: number = 4)
    {
        if(points.length < 3) {
            throw new Error("Wall needs to consist of at least three points.");
        }
        const xs: number[] = points.map(p => p[0]);
        const ys: number[] = points.map(p => p[1]);
        const x: number = Math.min(...xs);
        const y: number = Math.min(...ys);
        const w: number = Math.max(...xs) - x;
        const h: number = Math.max(...ys) - y;
        const [sx, sy] = [0,0];
        super(sx, sy, w, h);
        this.z = z;
        this.colour = colour;
        this.lineWidth = lineWidth;
        this.anchorPoint = new me.Vector2d(0,0);
        const vectors = points.map(xy => new me.Vector2d(xy[0], xy[1]));
        this.polygon = new me.Polygon(sx, sy, vectors);
        //console.log(`Creating wall with points`, points);
    }

    public draw(renderer: any) {
        renderer.setColor(this.colour);
        renderer.setLineWidth(this.lineWidth);
        renderer.strokePolygon(this.polygon);
    }
}
