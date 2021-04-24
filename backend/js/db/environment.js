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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
const db = __importStar(require("./database"));
const fp = __importStar(require("../util/functools"));
class Environment extends db.DBUnit {
    constructor(db) {
        super(db, "./src/db/sql/environment.sql");
    }
    async createEntity(type, x, y, ẟx = 0, ẟy = 0, speed = 0.04, controller = "ai") {
        console.log(`creating entity of type ${type} at (${x}, ${y}) with movement (${ẟx}, ${ẟy}),speed ${speed} and controller ${controller}`);
        return this.func("environment.create_entity", [type, x, y, ẟx, ẟy, speed, db.str(controller)]);
    }
    createPlayer(x, y, controller, ẟx = 0, ẟy = 0) {
        return this.createEntity(db.str("pacman"), x, y, ẟx, ẟy, 0.04, controller);
    }
    createGhost(x, y, ẟx = 0, ẟy = 0) {
        return this.createEntity(db.str("ghost"), x, y, ẟx, ẟy);
    }
    createMap(w, h) {
        console.log(`creating map of size ${w} x ${h}`);
        return this.func("environment.create_map", [w, h]);
    }
    getConnectedComponents() {
        return this.exec(`SELECT * FROM environment.connected_components`);
    }
    getWallShapes() {
        return this.get(`SELECT * FROM environment.wall_shapes`);
    }
    async getMapDimensions() {
        return (await this.get(`SELECT MAX(x) + 1 AS width, MAX(y) + 1 AS height FROM environment.cells`))[0]; // +1 to compensate for 0-based coordinates
    }
    async setMap(descriptor) {
        // yes, this may have been easier to read with two for-loops, but I am polishing my FP a bit.
        const lines = descriptor.split("\n").filter(row => row.trim().length > 0); // // remove rows that are completely empty
        const blocked = lines
            .map(row => fp.zip(row.split(""), fp.range(row.length))) // give each symbol their x-coordinate
            .map((row, y) => row.filter(char => char[0].trim()) // filter out all elements that are empty (= passable)
            .map(char => [char[1], y])) // attach y-coordinate and remove block symbol
            .reduce((acc, row) => acc.concat(row), []); // reduce 2d array into sequence
        const width = Math.max(...lines.map(line => line.length));
        const height = lines.length;
        console.log(width, height);
        if (width < 1 || height < 1) {
            throw new Error("either width or height of passed map is 0.");
        }
        await this.createMap(width, height);
        for (const [x, y] of blocked) {
            this.run(`UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (${x},${y})`);
        }
    }
    async getBlockedAreas() {
        return this.get(`SELECT x,y FROM environment.cells WHERE NOT passable`);
    }
    async getWalkableAreas() {
        return this.get(`SELECT x,y FROM environment.cells WHERE passable`);
    }
    async getDimensions() {
        return this.exec(`SELECT MAX(x) AS width, MAX(y) AS height FROM environment.cells`)[0].values[0];
    }
    setPlayerMovement(playerId, x, y) {
        return this.func("push", [playerId, x, y]);
    }
    updatePositions() {
        return this.func("environment.update_positions", []);
    }
    async getStates() {
        return this.get(`SELECT entity_id, x, y, ẟx, ẟy FROM environment.entity_components`);
    }
}
exports.Environment = Environment;
