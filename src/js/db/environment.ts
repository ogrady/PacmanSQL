import * as db from "./database";
import * as fp from "../functools";
import * as t from "../types";

export type EntityState = [number, number, number, number, number];

export class Environment extends db.DBUnit {
    public constructor(db: any) {
        super(db);

        this.tables = ["position_components", "movement_components", "cells", "entities"];

        console.log("creating enums");

        // enums
        this.run(`CREATE TABLE item_types(
                    name TEXT
                )`);

        this.run(`INSERT INTO item_types(name) VALUES
                    ('pellet'),
                    ('power pellet'),
                    ('cherry')
                `);

        this.run(`CREATE TABLE entity_types(
                    name TEXT
                )`);

        this.run(`INSERT INTO entity_types(name) VALUES
                    ('pacman'),
                    ('ghost')
                `);

        console.log("creating environment tables");

        // tables
        this.run(`CREATE TABLE game_state(
                    level INT,
                    score INT
                )`);

        this.run(`CREATE TABLE cells(
                    x INT, 
                    y INT, 
                    passable BOOLEAN, 
                    content INT DEFAULT 1, -- pellet
                    UNIQUE(x, y),
                    FOREIGN KEY(content) REFERENCES item_types(rowid)
                )`);
        
        // entities
        this.run(`CREATE TABLE entities(
                    type TEXT
                )`);

        this.run(`CREATE TABLE type_components(
                    entity_id INT,
                    type      INT,
                    FOREIGN KEY(type) REFERENCES entity_types(rowid)
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
        this.run(`CREATE VIEW entity_components(entity_id, x, y, ẟx, ẟy, type) AS 
                SELECT 
                    e.rowid,
                    pc.x, 
                    pc.y,
                    mc.ẟx,
                    mc.ẟy,
                    et.name
                FROM 
                    entities AS e 
                    LEFT JOIN position_components AS pc 
                      ON pc.entity_id = e.rowid
                    LEFT JOIN movement_components AS mc 
                      ON mc.entity_id = e.rowid
                    LEFT JOIN type_components AS tc 
                      ON tc.entity_id = e.rowid
                    LEFT JOIN entity_types AS et 
                      ON tc.type = et.rowid
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

        // like cell_neighbours, but includes center cell, could probably be solved more elegantly
        this.run(`CREATE VIEW cell_neighbourhoods(this_id, this_x, this_y, neighbour_id, neighbour_x, neighbour_y) AS 
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
                      ON (ABS(this.x - that.x), ABS(this.y - that.y)) IN (VALUES (1,0), (0,1), (0,0))
        `);

        // does not work yet, because at the time of writing sqlite3 did not 
        // support having aggregates or windows within recursive queries. 
        // General idea has been successfully tested in postgresql.
        this.run(`CREATE VIEW compound_walls(cell_id, x, y, component_id) AS 
            WITH RECURSIVE comps(cell_id, component_id) AS (
                SELECT 
                    rowid AS cell_id,
                    rowid AS component_id
                FROM 
                    cells
                WHERE 
                    NOT passable
                UNION 
                SELECT 
                    comps.cell_id,
                    MAX(neighbour_id)
                FROM 
                    comps
                    JOIN cell_neighbourhoods AS cn 
                      ON comps.cell_id = cn.this_id
                GROUP BY 
                    comps.cell_id
            ) 
            SELECT 
                comps.cell_id,
                MAX(c.x), -- THE 
                MAX(c.y), -- THE 
                MAX(comps.component_id)
            FROM 
                comps 
                JOIN cells AS c 
                  ON comps.cell_id = cells.rowid
            GROUP BY 
                comps.cell_id
        `);
    }

    private createEntity(type: string, x: number, y: number, ẟx: number = 0, ẟy: number = 0): number {
        console.log(`creating entity of type ${type} at (${x}, ${y}) with movement (${ẟx}, ${ẟy})`);
        this.run(`INSERT INTO entities(type) VALUES ('entity')`);
        const eid: number = this.db.getLastId();
        this.run(`INSERT INTO position_components(entity_id, x, y) VALUES (${eid}, ${x}, ${y})`);
        this.run(`INSERT INTO movement_components(entity_id, ẟx, ẟy) VALUES (${eid}, ${ẟx}, ${ẟy})`);
        this.run(`INSERT INTO type_components(entity_id, type) VALUES (${eid}, (SELECT rowid FROM entity_types WHERE name = '${type}'))`);
        return eid;
    }

    public createPlayer(x: number, y: number, ẟx: number = 0, ẟy: number = 0): number {
        return this.createEntity("pacman", x, y, ẟx, ẟy);
    }

    public createGhost(x: number, y: number, ẟx: number = 0, ẟy: number = 0): number {
        return this.createEntity("ghost", x, y, ẟx, ẟy);
    }

    private createMap(w: number, h: number) {
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

    public getConnectedComponents() {
        return this.exec(`SELECT * FROM connected_components`);
    }

    public setMap(descriptor: string) {
        // yes, this may have been easier to read with two for-loops, but I am polishing my FP a bit.
        const lines = descriptor.split("\n").filter(row => row.trim().length > 0); // // remove rows that are completely empty
        const blocked: [number, number][] = lines
                                            .map(row => fp.zip(row.split(""), fp.range(row.length)))  // give each symbol their x-coordinate
                                            .map((row, y) => row.filter(char => char[0].trim())       // filter out all elements that are empty (= passable)
                                            .map(char => [char[1], y] as [number, number]))           // attach y-coordinate and remove block symbol
                                            .reduce((acc, row) => acc.concat(row), []);               // reduce 2d array into sequence

        const width = Math.max(...lines.map(line => line.length));
        const height = lines.length;
        this.createMap(width, height);
        for(const [x,y] of blocked) {
            this.run(`UPDATE cells SET passable = FALSE WHERE (x,y) = (${x},${y})`);
        }
    }

    public getBlockedAreas(): t.Coordinate[]  {
        return this.get(`SELECT x,y FROM cells WHERE NOT passable`);
    }

    public getWalkableAreas(): t.Coordinate[] {
         return this.get(`SELECT x,y FROM cells WHERE passable`);
    }

    public getDimensions(): t.Dimensions {
        return this.exec(`SELECT MAX(x) AS width, MAX(y) AS height FROM cells`)[0].values[0];
    }

    public setPlayerMovement(playerId: number, x: number, y: number): void {
        this.run(`
            UPDATE movement_components SET
                ẟx = ${x},
                ẟy = ${y}
            WHERE 
                entity_id = ${playerId}
            `);
    }

    public updatePositions(): [number, number, number][] {
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

        this.run(`CREATE TEMPORARY TABLE cleared_cells(
                cell_id INT,
                x INT,
                y INT
            )`);

        this.run(`
            INSERT INTO cleared_cells(cell_id, x ,y)
            WITH obp AS (
                SELECT 
                    entity_id,
                    x,
                    y
                FROM 
                    entity_components AS ec
                WHERE 
                    type = 'pacman'
            )
            SELECT 
                c.rowid,
                c.x,
                c.y
            FROM 
                cells AS c 
                JOIN obp
                  ON (c.x, c.y) = (obp.x, obp.y)
            WHERE
                content IS NOT NULL
            `);

        this.run(`
            UPDATE cells SET 
                content = NULL 
            WHERE 
                rowid IN (SELECT cell_id FROM cleared_cells)
            `);

        this.run(`
            UPDATE game_state SET 
                score = score + (SELECT COUNT(cell_id) FROM cleared_cells)
            `);

        const clearedCells: [number, number, number][] = this.get(`SELECT cell_id, x, y FROM cleared_cells`);

        this.run(`DROP TABLE cleared_cells`);

        return clearedCells;
    }

    public getStates(): EntityState[] {
        return this.get(`SELECT entity_id, x, y, ẟx, ẟy FROM entity_components`);
    }

}