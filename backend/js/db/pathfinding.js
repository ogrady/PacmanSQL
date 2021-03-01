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
exports.Pathfinding = void 0;
const db = __importStar(require("./database"));
class Pathfinding extends db.DBUnit {
    constructor(db) {
        super(db, "./src/db/sql/pathfinding.sql");
    }
    async initNodelist(entity_id, start, destination) {
        const [sx, sy] = start;
        const [dx, dy] = destination;
        await this.func("pathfinding.init_node_list", [entity_id, `POINT(${sx},${sy})`, `POINT(${dx},${dy})`]);
    }
    async initSearch(entity_id, start, destination) {
        const [sx, sy] = start;
        const [dx, dy] = destination;
        console.log(`initialising path search for entity ${entity_id}: (${sx},${sy}) → (${dx}, ${dy})`);
        await this.func("pathfinding.init_search", [entity_id, `POINT(${sx},${sy})`, `POINT(${dx},${dy})`]);
    }
    async initGhostToPacmanSearch(ghost_id, pacman_id = null) {
    }
    async expand() {
        await this.func("pathfinding.expand");
    }
    async resolvePaths() {
        return this.func("pathfinding.resolve_paths");
    }
    async tickPathsearch() {
        await this.expand();
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
