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
const me_1 = __importDefault(require("../me"));
const game_1 = __importDefault(require("../game"));
const env = __importStar(require("../db/environment"));
const pf = __importStar(require("../db/pathfinding"));
const dfa = __importStar(require("../db/dfa"));
const fe = __importStar(require("../frontend"));
const fp = __importStar(require("../functools"));
var Direction;
(function (Direction) {
    Direction[Direction["None"] = 0] = "None";
    Direction[Direction["Up"] = 1] = "Up";
    Direction[Direction["Down"] = 2] = "Down";
    Direction[Direction["Left"] = 3] = "Left";
    Direction[Direction["Right"] = 4] = "Right";
})(Direction || (Direction = {}));
class PlayScreen extends me_1.default.Stage {
    //private pathfinding: pf.Pathfinding | undefined;
    constructor(db) {
        super();
        this.playerId = 0;
        this.entities = {};
        this.pellets = {};
        this.blockSize = [0, 0];
        this.db = db;
    }
    hashCoordinate(x, y) {
        return `${x}|${y}`; // hurrr
    }
    onload() {
        //
        console.log("loading...");
    }
    doKeyBinds() {
        me_1.default.input.bindKey(me_1.default.input.KEY.W, Direction.Up);
        me_1.default.input.bindKey(me_1.default.input.KEY.S, Direction.Down);
        me_1.default.input.bindKey(me_1.default.input.KEY.A, Direction.Left);
        me_1.default.input.bindKey(me_1.default.input.KEY.D, Direction.Right);
    }
    spawnPellets(w, h, e) {
        for (const [x, y] of e.getWalkableAreas()) {
            const pellet = new fe.Pellet([x * w + 0.5 * w, y * h + 0.5 * h]);
            this.pellets[this.hashCoordinate(x, y)] = pellet;
            me_1.default.game.world.addChild(pellet);
        }
    }
    prepareMap(e, map) {
        e.setMap(map.shape);
        me_1.default.game.world.addChild(new me_1.default.ColorLayer("background", fe.BACKGROUND_COLOUR));
        const [resWidth, resHeight] = game_1.default.data.resolution;
        const [gridWidth, gridHeight] = e.getDimensions();
        const w = resWidth / (gridWidth + 1);
        const h = resHeight / (gridHeight + 1);
        const [spawnX, spawnY] = map.pspawn;
        for (const [x, y] of e.getBlockedAreas()) {
            const [ax, ay] = [x * 0.5 * w + 0.25 * w, y * 0.5 * h + 0.25 * h];
            me_1.default.game.world.addChild(new fe.Wall([
                [ax, ay],
                [ax + w, ay],
                [ax + w, ay + h],
                [ax, ay + h] // bottom left
            ]));
        }
        this.blockSize = [w, h];
        this.map = map;
    }
    spawnPlayer(e) {
        const [spawnX, spawnY] = this.map.pspawn;
        const [w, h] = this.blockSize;
        const playerId = e.createPlayer(spawnX, spawnY);
        this.pacman = new fe.Pacman(playerId, [spawnX * w + 0.5 * w,
            spawnY * h + 0.5 * h], w);
        this.entities[playerId] = this.pacman;
        me_1.default.game.world.addChild(this.pacman);
    }
    spawnGhosts(e, count) {
        const [w, h] = this.blockSize;
        for (let i = 0; i < count; i++) {
            const [spawnX, spawnY] = fp.choice(this.map.espawns);
            const ghostId = e.createGhost(spawnX, spawnY);
            console.log(ghostId);
            const ghost = new fe.Ghost(ghostId, [spawnX * w + 0.5 * w,
                spawnY * h + 0.5 * h], w);
            this.entities[ghostId] = ghost;
            me_1.default.game.world.addChild(ghost);
            //this.pathfinding?.initSearch(ghostId, [spawnX, spawnY], this.map.pspawn)
            //this.pathfinding?.initGhostToPacmanSearch(ghostId);
            this.ghostDFA?.setupEntity(ghostId, 1);
            /*for(let i = 0; i < 10; i++) {
                console.log(this.pathfinding?.tickPathsearch());
            }*/
        }
    }
    async onResetEvent() {
        //me.audio.play("bgm");
        console.log("Show play screen");
        this.environment = new env.Environment(this.db);
        this.pathfinding = new pf.Pathfinding(this.db);
        this.ghostDFA = new dfa.DFA(this.db, this.pathfinding);
        const e = this.environment;
        this.prepareMap(e, game_1.default.data.maps[0]);
        const [w, h] = this.blockSize;
        this.spawnPlayer(e);
        this.spawnPellets(w, h, e);
        this.spawnGhosts(e, 1);
        this.doKeyBinds();
    }
    update() {
        const res = super.update();
        if (this.environment === undefined)
            return res; // early bail if async DB init has not finished yet
        this.pathfinding?.tickPathsearch();
        this.ghostDFA?.tick();
        let x = 0;
        let y = 0;
        if (me_1.default.input.isKeyPressed(Direction.Left)) {
            x = -1;
        }
        else if (me_1.default.input.isKeyPressed(Direction.Right)) {
            x = 1;
        }
        else if (me_1.default.input.isKeyPressed(Direction.Up)) {
            y = -1;
        }
        else if (me_1.default.input.isKeyPressed(Direction.Down)) {
            y = 1;
        }
        if (x != 0 || y != 0) {
            this.environment?.setPlayerMovement(this.pacman?.dbId, x, y);
        }
        const clearedCells = this.environment?.updatePositions();
        const [blockWidth, blockHeight] = this.blockSize;
        for (const [eid, x, y, dx, dy] of this.environment?.getStates()) {
            const entity = this.entities[eid];
            if (entity !== undefined) {
                entity.setPosition(x * blockWidth + 1 * blockWidth, y * blockHeight + 1 * blockHeight);
            }
        }
        for (const [cid, x, y] of clearedCells) {
            try {
                me_1.default.game.world.removeChild(this.pellets[this.hashCoordinate(x, y)]);
                me_1.default.audio.play("pellet");
            }
            catch {
                console.error(`Tried to remove non-existing pellet at (${x}, ${y})`);
            }
        }
        return res;
    }
}
exports.default = PlayScreen;
