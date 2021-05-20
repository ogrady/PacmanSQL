import * as db from "./database";

export class Pathfinding extends db.DBUnit {
    public constructor(db: db.PostgresqlConnection) {
        super(db, "./src/db/sql/pathfinding.sql");
    }

    private async initNodelist(entity_id: number, start: [number, number], destination: [number, number]): Promise<void> {
        const [sx, sy] = start;
        const [dx, dy] = destination;
        await this.func("pathfinding.init_node_list", [entity_id, `POINT(${sx},${sy})`, `POINT(${dx},${dy})`]);
    }

    public async initSearch(entity_id: number, start: [number, number], destination: [number, number]): Promise<void> {
        const [sx, sy] = start;
        const [dx, dy] = destination;
        console.log(`initialising path search for entity ${entity_id}: (${sx},${sy}) → (${dx}, ${dy})`);
        await this.func("pathfinding.init_search", [entity_id, `POINT(${sx},${sy})`, `POINT(${dx},${dy})`]);
    }

    public async initGhostToPacmanSearch(ghost_id: number, pacman_id: number | null = null): Promise<void> {

    }

    public async expand(): Promise<void> {
        await this.func("pathfinding.expand");
    }

    public async resolvePaths(): Promise<void> {
        return this.func("pathfinding.resolve_paths");
    }

    public async tickPathsearch(): Promise<any> {
        await this.expand();
        return this.resolvePaths();
    }
}








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