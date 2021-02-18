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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
const db = __importStar(require("./database"));
const fp = __importStar(require("../functools"));
class Environment extends db.DBUnit {
    constructor(db) {
        super(db, "./src/db/sql/environment.sql");
    }
    createEntity(type, x, y, ẟx = 0, ẟy = 0, speed = 0.04, controller = "ai") {
        console.log(`creating entity of type ${type} at (${x}, ${y}) with movement (${ẟx}, ${ẟy}),speed ${speed} and controller ${controller}`);
        this.run(`INSERT INTO environment.entities(type) VALUES ('entity')`);
        const eid = this.db.getLastId();
        this.run(`INSERT INTO environment.position_components(entity_id, x, y) VALUES (${eid}, ${x}, ${y})`);
        this.run(`INSERT INTO environment.movement_components(entity_id, ẟx, ẟy, speed) VALUES (${eid}, ${ẟx}, ${ẟy}, ${speed})`);
        this.run(`INSERT INTO environment.type_components(entity_id, type) VALUES (${eid}, (SELECT id FROM environment.entity_types WHERE name = '${type}'))`);
        this.run(`INSERT INTO environment.controller_components(entity_id, controller) VALUES (${eid}, ${controller})`);
        return eid;
    }
    createPlayer(x, y, controller, ẟx = 0, ẟy = 0) {
        return this.createEntity("pacman", x, y, ẟx, ẟy, 0.04, controller);
    }
    createGhost(x, y, ẟx = 0, ẟy = 0) {
        return this.createEntity("ghost", x, y, ẟx, ẟy);
    }
    createMap(w, h) {
        console.log(`creating map of size ${w} x ${h}`);
        this.run(`
            WITH RECURSIVE 
            xs(x) AS (
                SELECT 0
                UNION ALL
                SELECT x + 1 FROM xs WHERE x + 1 < ${w}
            ),
            ys(y) AS (
                SELECT 0
                UNION ALL
                SELECT y + 1 FROM ys WHERE y + 1 < ${h}
            )
            INSERT INTO cells(x, y, passable) 
            SELECT 
                xs.x,
                ys.y,
                TRUE
            FROM 
                xs,
                ys
        `);
    }
    getConnectedComponents() {
        return this.exec(`SELECT * FROM environment.connected_components`);
    }
    setMap(descriptor) {
        // yes, this may have been easier to read with two for-loops, but I am polishing my FP a bit.
        const lines = descriptor.split("\n").filter(row => row.trim().length > 0); // // remove rows that are completely empty
        const blocked = lines
            .map(row => fp.zip(row.split(""), fp.range(row.length))) // give each symbol their x-coordinate
            .map((row, y) => row.filter(char => char[0].trim()) // filter out all elements that are empty (= passable)
            .map(char => [char[1], y])) // attach y-coordinate and remove block symbol
            .reduce((acc, row) => acc.concat(row), []); // reduce 2d array into sequence
        const width = Math.max(...lines.map(line => line.length));
        const height = lines.length;
        this.createMap(width, height);
        for (const [x, y] of blocked) {
            this.run(`UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (${x},${y})`);
        }
    }
    getBlockedAreas() {
        return this.get(`SELECT x,y FROM environment.cells WHERE NOT passable`);
    }
    getWalkableAreas() {
        return this.get(`SELECT x,y FROM environment.cells WHERE passable`);
    }
    getDimensions() {
        return this.exec(`SELECT MAX(x) AS width, MAX(y) AS height FROM environment.cells`)[0].values[0];
    }
    setPlayerMovement(playerId, x, y) {
        this.run(`
            UPDATE environment.movement_components SET
                ẟx = ${x} * speed,
                ẟy = ${y} * speed
            WHERE 
                entity_id = ${playerId}
            `);
    }
    updatePositions() {
        this.run(`
            WITH upd(entity_id, new_x, new_y) AS (
                SELECT 
                    ec.entity_id,
                    ec.x + ec.ẟx,
                    ec.y + ec.ẟy
                FROM
                    environment.entity_components AS ec 
                    JOIN environment.cells AS c 
                      ON ROUND(ec.x + ec.ẟx + 0.0) = c.x AND 
                         ROUND(ec.y + ec.ẟy + 0.0) = c.y
                WHERE 
                    c.passable
            )
            UPDATE 
                environment.position_components AS pc
            SET 
                x = upd.new_x,
                y = upd.new_y
            FROM 
                upd
            WHERE 
                pc.entity_id = upd.entity_id
        `);
        this.run(`CREATE TEMPORARY TABLE environment.cleared_cells(
                cell_id INT,
                x INT,
                y INT
            )`);
        this.run(`
            INSERT INTO cleared_cells(cell_id, x ,y)
            WITH obp(entity_id, x, y) AS (
                SELECT 
                    entity_id,
                    ROUND(x),
                    ROUND(y)
                FROM 
                    environment.entity_components AS ec
                WHERE 
                    type = 'pacman'
            )
            SELECT 
                c.id,
                c.x,
                c.y
            FROM 
                environment.cells AS c 
                JOIN environment.obp
                  ON (c.x, c.y) = (obp.x, obp.y)
            WHERE
                content IS NOT NULL
            `);
        this.run(`
            UPDATE environment.cells SET 
                content = NULL 
            WHERE 
                id IN (SELECT cell_id FROM environment.cleared_cells)
            `);
        this.run(`
            UPDATE environment.game_state SET 
                score = score + (SELECT COUNT(cell_id) FROM cleared_cells)
            `);
        const clearedCells = this.get(`SELECT cell_id, x, y FROM environment.cleared_cells`);
        this.run(`DROP TABLE environment.cleared_cells`);
        return clearedCells;
    }
    getStates() {
        return this.get(`SELECT entity_id, x, y, ẟx, ẟy FROM environment.entity_components`);
    }
}
exports.Environment = Environment;
