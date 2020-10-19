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
const fp = __importStar(require("./functools"));
class Environment extends db.DBUnit {
    constructor(db) {
        super(db);
        this.tables = ["position_components", "movement_components", "cells", "entities"];
        console.log("creating environment tables");
        this.run(`CREATE TABLE cells(
                    x INT, 
                    y INT, 
                    passable BOOLEAN, 
                    UNIQUE(x, y)
                )`);
        // entities
        this.run(`CREATE TABLE entities(
                    type TEXT
                )`);
        // components
        this.run(`CREATE TABLE position_components(
                    entity_id INT, 
                    x         INT, 
                    y         INT,
                    FOREIGN KEY(entity_id) REFERENCES entities(rowid)                
                )`);
        this.run(`CREATE TABLE movement_components(
                    entity_id INT, 
                    ẟx        INT, 
                    ẟy        INT,
                    FOREIGN KEY(entity_id) REFERENCES entities(rowid)
                )`);
        console.log("creating environment views");
        // views
        this.run(`CREATE VIEW entity_components(entity_id, x, y, ẟx, ẟy) AS 
                SELECT 
                    e.rowid,
                    pc.x, 
                    pc.y,
                    mc.ẟx,
                    mc.ẟy
                FROM 
                    entities AS e 
                    LEFT JOIN position_components AS pc 
                      ON pc.entity_id = e.rowid
                    LEFT JOIN movement_components AS mc 
                      ON mc.entity_id = e.rowid
        `);
        this.run(`CREATE VIEW cell_neighbours(this_id, this_x, this_y, neighbour_id, neighbour_x, neighbour_y) AS 
                SELECT 
                    this.rowid,
                    this.x,
                    this.y,
                    that.rowid,
                    that.x,
                    that.y
                FROM 
                    cells AS this
                    JOIN cells AS that
                      ON (ABS(this.x - that.x), ABS(this.y - that.y)) IN (VALUES (1,0), (0,1))
        `);
    }
    createEntity(x, y, ẟx = 0, ẟy = 0) {
        console.log(`creating entity at (${x}, ${y}) with movement (${ẟx}, ${ẟy})`);
        this.run(`INSERT INTO entities(type) VALUES ('entity')`);
        const res = this.db.getLastId();
        this.run(`INSERT INTO position_components(entity_id, x, y) VALUES (${res}, ${x}, ${y})`);
        this.run(`INSERT INTO movement_components(entity_id, ẟx, ẟy) VALUES (${res}, ${ẟx}, ${ẟy})`);
        return this.db.getLastId();
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
    setMap(descriptor) {
        // yes, this may have been easier to read with two for-loops, but I am polishing my FP a bit.
        const lines = descriptor.split("\n");
        const blocked = lines
            .filter(row => row) // remove rows that are completely empty
            .map(row => fp.zip(row.split(""), fp.range(row.length))) // give each symbol their x-coordinate
            .map((row, y) => row.filter(char => char[0].trim()) // filter out all elements that are empty (= passable)
            .map(char => [char[1], y])) // attach y-coordinate and remove block symbol
            .reduce((acc, row) => acc.concat(row), []); // reduce 2d array into sequence
        const width = Math.max(...lines.map(line => line.length));
        const height = lines.length;
        this.createMap(width, height);
        for (const [x, y] of blocked) {
            this.run(`UPDATE cells SET passable = FALSE WHERE (x,y) = (${x},${y})`);
        }
    }
    updatePositions() {
        this.run(`
            WITH upd(entity_id, new_x, new_y) AS (
                SELECT 
                    ec.entity_id,
                    c.x,
                    c.y
                FROM
                    entity_components AS ec 
                    JOIN cells AS c 
                      ON ec.x + ec.ẟx = c.x AND 
                         ec.y + ec.ẟy = c.y
                WHERE 
                    c.passable
            )
            UPDATE 
                position_components AS pc
            SET 
                x = upd.new_x,
                y = upd.new_y
            FROM 
                upd
            WHERE 
                pc.entity_id = upd.entity_id
        `);
    }
}
exports.Environment = Environment;
