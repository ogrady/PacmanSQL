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
exports.Pathfinding = void 0;
const db = __importStar(require("./database"));
class Pathfinding extends db.DBUnit {
    constructor(db) {
        super(db);
        this.run(`
             CREATE TABLE node_list(
                entity_id INT,
                cell_id INT,
                start_x INT,
                start_y INT,
                destination_x INT,
                destination_y INT,
                position_x INT,
                position_y INT,
                predecessor INT DEFAULT NULL,
                g REAL DEFAULT '+infinity',
                f REAL DEFAULT '+infinity',
                closed BOOLEAN DEFAULT FALSE,
                open BOOLEAN DEFAULT FALSE,
                FOREIGN KEY(entity_id) REFERENCES entities(rowid),
                FOREIGN KEY(cell_id) REFERENCES cells(rowid),
                FOREIGN KEY(predecessor) REFERENCES cells(rowid),
                UNIQUE(cell_id, entity_id)
            )`);
        this.run(`CREATE INDEX node_list_entity_id ON node_list(entity_id)`);
        this.run(`CREATE INDEX node_list_open ON node_list(open)`);
        // intermediate tables
        this.run(`CREATE TABLE cheapest(
            node_list_id INT,
            entity_id INT, 
            cell_id INT, 
            position_x INT, 
            position_y INT, 
            g REAL
        )`);
        this.run(`CREATE TABLE complete_paths(
            steps INT, 
            entity_id INT, 
            cell_id INT, 
            position_x INT, 
            position_y INT, 
            predecessor INT
        )`);
    }
    initNodelist(entity_id, start, destination) {
        this.run(`DELETE FROM node_list WHERE entity_id = ${entity_id}`);
        this.run(`
            INSERT INTO node_list(entity_id, cell_id, position_x, position_y, start_x, start_y, destination_x, destination_y) 
            SELECT 
                ${entity_id},
                c.rowid,
                c.x,
                c.y,
                ${start[0]},
                ${start[1]},
                ${destination[0]},
                ${destination[1]}
            FROM 
                cells AS c
            WHERE 
                c.passable
            `);
    }
    initSearch(entity_id, start, destination) {
        console.log(`initialising path search for entity ${entity_id}: (${start[0]},${start[1]}) → (${destination[0]}, ${destination[1]})`);
        this.initNodelist(entity_id, start, destination);
        this.run(`
            UPDATE 
                node_list AS nl 
            SET 
                g = 0.0,
                f = 0.0,
                open = TRUE
            WHERE 
                (nl.position_x, nl.position_y) = (${start[0]}, ${start[1]})
                AND nl.entity_id = ${entity_id}
            `);
    }
    expand() {
        this.run("DELETE FROM cheapest");
        this.run(`
            WITH 
            ordered(node_list_id, entity_id, cell_id, position_x, position_y, g, f_rank) AS (
                SELECT
                    nl.rowid,
                    nl.entity_id,
                    nl.cell_id,
                    nl.position_x,
                    nl.position_y,
                    nl.g, 
                    ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY f ASC) AS f_rank
                FROM 
                    node_list AS nl 
                WHERE 
                    open
            )
            INSERT INTO cheapest(node_list_id, entity_id, cell_id, position_x, position_y, g)
            SELECT 
                nl.rowid,
                nl.entity_id,
                nl.cell_id,
                nl.position_x,
                nl.position_y,
                nl.g
            FROM 
                node_list AS nl
            WHERE 
                nl.rowid IN (SELECT node_list_id FROM ordered WHERE f_rank = 1)
        `);
        this.run(`
            UPDATE 
                node_list AS nl 
            SET 
                open = FALSE, 
                closed = TRUE 
            WHERE 
                rowid IN (SELECT node_list_id FROM cheapest)
        `);
        this.run(`
            WITH
            expand(entity_id, this_id, neighbour_id, neighbour_pos_x, neighbour_pos_y, open, tentative_g, g, destination_x, destination_y) AS (
                SELECT 
                    this.entity_id   AS entity_id,
                    this.cell_id     AS this_id,
                    ns.cell_id       AS neighbour_id,
                    ns.position_x    AS neighbour_pos_x,
                    ns.position_y    AS neighbour_pos_y,
                    ns.open          AS open,
                    this.g + 1       AS tentative_g,
                    ns.g             AS g,
                    ns.destination_x AS destination_x,
                    ns.destination_y AS destination_y
                FROM 
                    cheapest AS this
                    JOIN node_list AS ns 
                      ON this.entity_id = ns.entity_id
                    JOIN cell_neighbours AS cn 
                      ON cn.this_id = this.cell_id AND ns.cell_id = cn.neighbour_id
                WHERE
                    NOT ns.closed
                    AND NOT (ns.open AND (this.g + 1) >= ns.g)
            )
            UPDATE node_list AS nl
            SET 
                open = TRUE, -- we can safely put them all on true, since we filtered !open before
                g = e.tentative_g,
                f = e.tentative_g + (ABS(e.destination_x - e.neighbour_pos_x) + ABS(e.destination_y - e.neighbour_pos_y)), -- this is h()
                predecessor = e.this_id
            FROM 
                expand AS e
            WHERE 
                nl.cell_id = e.neighbour_id 
                AND nl.entity_id = e.entity_id
       `);
    }
    resolvePaths() {
        this.exec("DELETE FROM complete_paths");
        // assuming that all path searches are valid, there will be no check for invalid paths
        this.exec(`
            WITH RECURSIVE 
            endpoints(entity_id, cell_id, destination_x, destination_y, position_x, position_y, predecessor) AS (
                SELECT 
                    entity_id,
                    cell_id,
                    destination_x,
                    destination_y,
                    position_x,
                    position_y,
                    predecessor
                FROM 
                    node_list
                WHERE 
                    (destination_x, destination_y) = (position_x, position_y)
                    AND predecessor IS NOT NULL
            ),
            paths(steps, entity_id, cell_id, position_x, position_y, predecessor) AS (
                SELECT 
                    0,
                    entity_id,
                    cell_id,
                    position_x,
                    position_y,
                    predecessor
                FROM 
                    endpoints
                UNION ALL 
                SELECT
                    p.steps + 1,
                    nl.entity_id,
                    nl.cell_id,
                    nl.position_x,
                    nl.position_y,
                    nl.predecessor
                FROM 
                    node_list AS nl 
                    JOIN paths AS p 
                      ON nl.cell_id = p.predecessor
                         AND nl.entity_id = p.entity_id
            )
            INSERT INTO complete_paths(steps, entity_id, cell_id, position_x, position_y, predecessor)
            SELECT * FROM paths
        `);
        this.run(`
            DELETE FROM 
                node_list AS nl 
            WHERE
                nl.entity_id IN (SELECT DISTINCT entity_id FROM complete_paths)
            `);
        return this.exec(`
            SELECT 
                p.steps,
                p.entity_id,
                p.cell_id,
                p.position_x,
                p.position_y
            FROM 
                complete_paths AS p 
            ORDER BY 
                p.steps DESC
            `);
    }
    tickPathsearch() {
        this.expand();
        return this.resolvePaths();
    }
}
exports.Pathfinding = Pathfinding;
/*


CREATE FUNCTION pathfinding.resolve_paths()
RETURNS TABLE(steps INT, entity_id INT, cell_id INT, coord POINT) AS $$ -- coord should have been "position", but that turned out to be a keyword (function)
    WITH RECURSIVE
    endpoints(entity_id, cell_id, destination, position, predecessor) AS (
        SELECT
            entity_id,
            cell_id,
            destination,
            position,
            predecessor
        FROM
            pathfinding.node_list
        WHERE
            destination ~= position
            AND predecessor IS NOT NULL
    ),
    complete_paths(steps, entity_id, cell_id, position, predecessor) AS (
        SELECT
            0,
            entity_id,
            cell_id,
            position,
            predecessor
        FROM
            endpoints
        UNION ALL
        SELECT
            p.steps + 1,
            nl.entity_id,
            nl.cell_id,
            nl.position,
            nl.predecessor
        FROM
            pathfinding.node_list AS nl
            JOIN complete_paths AS p
              ON nl.cell_id = p.predecessor
                 AND nl.entity_id = p.entity_id
    ),
    paths(steps, entity_id, cell_id, position, predecessor) AS (
        SELECT * FROM complete_paths
        UNION ALL (
            -- unavailable paths
            WITH
            pending(entity_id) AS (
                SELECT
                    entity_id
                FROM
                    pathfinding.node_list AS nl
                WHERE
                    position ~= destination
                    AND predecessor IS NULL
            ),
            empty(entity_id) AS (
            SELECT
                nl.entity_id
            FROM
                pathfinding.node_list AS nl
            GROUP BY
                nl.entity_id
            HAVING
                COUNT(open) FILTER (WHERE NOT open) = COUNT(nl.entity_id)
            )
            SELECT
                -1,
                p.entity_id,
                -1,
                POINT(-1,-1),
                -1
            FROM
                pending AS p JOIN empty AS e ON p.entity_id = e.entity_id
        )
    ),
    se_cleanup(entity_id) AS (
        DELETE FROM
            pathfinding.node_list AS nl
        WHERE
            nl.entity_id IN (SELECT DISTINCT entity_id FROM paths)
        RETURNING
            1
    )
    SELECT
        p.steps,
        p.entity_id,
        p.cell_id,
        p.position
    FROM
        paths AS p
    ;


$$ LANGUAGE sql;
*/ 
