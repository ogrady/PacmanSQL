import me from "./me";
import * as fp from "./functools";
import * as t from "./types";
import * as U from "./util";

export const BACKGROUND_COLOUR = "#00121c";

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

    protected straighten() {
        if(this.rotation != 0) {
            this.renderable.rotate(-this.rotation);
            this.rotation = 0;
        }
        return this.renderable;
    }

    protected absoluteRotation(degree: number) {
        if(this.rotation != degree) {
            this.straighten().rotate(degree);
            this.rotation = degree;
        }
    }

    public setPosition(x: number, y: number): void {
        if(x != this.pos.x || y != this.pos.y) {
            if(x < this.pos.x) {
                this.orientation = Orientation.LEFT;
                this.faceLeft();
            }
            else if (x > this.pos.x) {
                this.orientation = Orientation.RIGHT;
                this.faceRight();
            }
            else if (y < this.pos.y) {
                this.orientation = Orientation.UP;
                this.faceUp();
            }
            else if (y > this.pos.y) {
                this.orientation = Orientation.DOWN;
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
    private body: any;
    private eyes: any;

    public constructor(dbId: number, position: t.Coordinate, colour = "#ff0000") {
        super(dbId, position[0], position[1], {width: 46, height: 46});
        this.colour = colour;
        this.body = new me.Sprite(position[0], position[1], {
            image: "ghost_body",
            framewidth: 32,
            frameheight: 32,
        });
        this.eyes = new me.Sprite(position[0], position[1], {
            image: "ghost_eyes",
            framewidth: 32,
            frameheight: 32
        });

        this.body.addAnimation("walk", [0,1], 400);
        this.body.setCurrentAnimation("walk");
        this.body.tint.setColor(...U.hexToRgb(this.colour));

        this.eyes.addAnimation("down", [0]);
        this.eyes.addAnimation("up", [1]);
        this.eyes.addAnimation("right", [2]);
        this.eyes.addAnimation("left", [3]);
        this.eyes.setCurrentAnimation("down");
        this.faceDown();

        this.renderable = new me.Container();
        this.renderable.pos = this.pos;
        this.renderable.addChild(this.body);
        this.renderable.addChild(this.eyes);
    }

    protected faceLeft() {
        this.eyes.setCurrentAnimation("left");
    }

    protected faceRight() {
        this.eyes.setCurrentAnimation("right");
    }

    protected faceUp() {
        this.eyes.setCurrentAnimation("up");
    }

    protected faceDown() {
        this.eyes.setCurrentAnimation("down");
    }
}

enum Orientation {
    LEFT, UP, RIGHT, DOWN
}


export class Pacman extends DBEntity {
    private nextFrame = 1;
    private accu = 0;

    public constructor(dbId: number, position: t.Coordinate, colour = "#f5e642") {
        super(dbId, position[0], position[1], {width: 46, height: 46});

        this.renderable = new me.Sprite(position[0], position[1], {
            image: "pacman",
            framewidth: 32,
            frameheight: 32,
        });

        this.renderable.addAnimation("walk", [0,1,2,3,4,5], 100);
        this.renderable.addAnimation("stand", [3], 100);
        this.renderable.setCurrentAnimation("walk");
        this.renderable.tint.setColor(...U.hexToRgb(colour));
    }

    protected faceLeft() {
        this.straighten();
        this.renderable.flipX(true);
    }

    protected faceRight() {
        this.straighten();
        this.renderable.flipX(false);
    }

    protected faceUp() {
        this.absoluteRotation(U.gradToRad(-90));
    }

    protected faceDown() {
        this.absoluteRotation(U.gradToRad(90));
    }
}

export class Pellet extends me.Renderable {
    public constructor(coordinate: t.Coordinate,
                       colour: string = "#fff",
                       radius: number = 7)
    {
        super(coordinate[0], coordinate[1], radius, radius);
        this.colour = colour;
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
