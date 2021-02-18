"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wall = exports.Pellet = exports.Pacman = exports.Ghost = exports.DBRenderable = exports.BACKGROUND_COLOUR = void 0;
const me_1 = __importDefault(require("./me"));
const fp = __importStar(require("./functools"));
exports.BACKGROUND_COLOUR = "#00121c";
class DBRenderable extends me_1.default.Renderable {
    constructor(dbId, x, y, width, height, z = 1000) {
        super(x, y, width, height);
        this.dbId = dbId;
        this.z = z;
    }
    setPosition(x, y) {
        if (x != this.pos.x || y != this.pos.y) {
            if (x < this.pos.x)
                this.faceLeft();
            else if (x > this.pos.x)
                this.faceRight();
            else if (y < this.pos.y)
                this.faceUp();
            else if (y > this.pos.y)
                this.faceDown();
            this.pos.x = x;
            this.pos.y = y;
            this.isDirty = true;
        }
    }
}
exports.DBRenderable = DBRenderable;
class Ghost extends DBRenderable {
    constructor(dbId, position, radius, colour = "#f00") {
        super(dbId, position[0], position[1], radius, radius);
        this.colour = colour;
        this.eyeSize = 10;
        this.pupilSize = 4;
        this.eyeOffset = [0, 0];
        this.skirt = new me_1.default.Polygon(position[0], position[1], [[0, 10],
            [0.25 * radius, -10],
            [0.25 * radius, 10],
            [0.5 * radius, -10]
        ].map(([x, y]) => new me_1.default.Vector2d(x, y)));
        this.faceDown();
    }
    faceLeft() {
        this.eyeOffset = [-this.pupilSize, 0];
    }
    faceRight() {
        this.eyeOffset = [this.pupilSize, 0];
    }
    faceUp() {
        this.eyeOffset = [0, -this.pupilSize];
    }
    faceDown() {
        this.eyeOffset = [0, this.pupilSize];
    }
    drawEye(renderer, x, y) {
        const [xoff, yoff] = this.eyeOffset;
        renderer.setColor("#fff");
        renderer.fillEllipse(x, y - 3, this.eyeSize, this.eyeSize);
        renderer.setColor("#00f");
        renderer.fillEllipse(x + xoff, y + yoff, this.pupilSize, this.pupilSize);
    }
    drawEyes(renderer) {
        renderer.setColor("#fff");
        this.drawEye(renderer, this.pos.x - this.eyeSize, this.pos.y - 3);
        this.drawEye(renderer, this.pos.x + this.eyeSize, this.pos.y - 3);
        /*
        renderer.fillEllipse(this.pos.x - eyeSize, this.pos.y - 3, eyeSize, eyeSize);
        renderer.fillEllipse(this.pos.x + eyeSize, this.pos.y - 3, eyeSize, eyeSize);

        renderer.setColor("#00f")
        const [xoff, yoff] = this.eyeOffset;
        renderer.fillEllipse(this.pos.x - eyeSize + xoff, this.pos.y - 3 + yoff, pupilSize, pupilSize);
        renderer.fillEllipse(this.pos.x + eyeSize + xoff, this.pos.y - 3 + yoff, pupilSize, pupilSize);*/
    }
    draw(renderer) {
        renderer.setColor(this.colour);
        renderer.fillEllipse(this.pos.x, this.pos.y, 25, 25);
        renderer.setColor("#fff");
        this.drawEyes(renderer);
        //renderer.stroke(new me.Rectangle(this.pos.x, this.pos.y, 10, 10));
    }
}
exports.Ghost = Ghost;
class Pacman extends DBRenderable {
    constructor(dbId, position, radius) {
        super(dbId, position[0], position[1], radius, radius);
        const targetFrameCount = 12;
        const [minY, maxY] = [2, 10];
        this.mouths = [];
        const d = (maxY - minY) / targetFrameCount + minY;
        // bit of a dirty hack because I can not be arsed to properly use melonjs sprites with my DB backend... 
        // this creates a series of triangles of varying angle which have their cone point at Pacman's center. 
        // each triangle is longer than Pacman's width / 2, so drawing that triangle over the yellow body 
        // in the background colour will look like an open mouth.
        this.mouths = fp.range(targetFrameCount)
            .map(i => new me_1.default.Polygon(0, 0, [[0, 0], [radius / 3 + 2, -i * d], [radius / 3 + 2, i * d]].map(([x, y]) => new me_1.default.Vector2d(x, y))));
        this.mouthFrame = 0;
        this.mouthRotation = 0;
    }
    nextFrame() {
        this.mouthFrame = (this.mouthFrame + 1) % this.mouths.length;
        return this.mouths[this.mouthFrame].clone();
    }
    faceLeft() {
        this.mouthRotation = Math.PI; // 180°
    }
    faceRight() {
        this.mouthRotation = 0;
    }
    faceUp() {
        this.mouthRotation = 270 * Math.PI / 180; // 270°
    }
    faceDown() {
        this.mouthRotation = 90 * Math.PI / 180; // 90°
    }
    draw(renderer) {
        renderer.setColor("#fcba03");
        renderer.fillEllipse(this.pos.x, this.pos.y, 25, 25);
        renderer.setColor(exports.BACKGROUND_COLOUR);
        const mouth = this.nextFrame();
        mouth.points.map((v) => v.rotate(this.mouthRotation));
        mouth.pos.x = this.pos.x;
        mouth.pos.y = this.pos.y;
        renderer.fill(mouth);
    }
}
exports.Pacman = Pacman;
class Pellet extends me_1.default.Renderable {
    constructor(coordinate, colour = "#fff", radius = 7, z = 1000) {
        super(coordinate[0], coordinate[1], radius, radius);
        this.colour = colour;
        this.z = z;
    }
    draw(renderer) {
        renderer.setColor(this.colour);
        renderer.fillEllipse(this.pos.x, this.pos.y, this.width, this.width);
    }
}
exports.Pellet = Pellet;
class Wall extends me_1.default.Renderable {
    constructor(points, colour = "#2a9adb", z = 100, lineWidth = 2) {
        const xs = points.map(p => p[0]);
        const ys = points.map(p => p[1]);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const w = Math.max(...xs) - x;
        const h = Math.max(...ys) - y;
        super(x, y, w, h);
        this.z = z;
        this.colour = colour;
        this.lineWidth = lineWidth;
        const vectors = points.map(xy => new me_1.default.Vector2d(xy[0], xy[1]));
        this.polygon = new me_1.default.Polygon(x, y, vectors);
    }
    draw(renderer) {
        renderer.setColor(this.colour);
        renderer.setLineWidth(this.lineWidth);
        renderer.stroke(this.polygon);
    }
}
exports.Wall = Wall;
