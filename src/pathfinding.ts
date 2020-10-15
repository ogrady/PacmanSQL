export class Pathfinding {
    private db: any;

    public constructor(db: any) {
        this.db = db;

         this.db.run(`
             CREATE TABLE node_list(
                entity_id INT,
                cell_id INT,
                start_x INT,
                start_y INT,
                destination_x INT,
                destination_y INT,
                position_x INT,
                position_y INT,
                traversal_cost DOUBLE PRECISION, 
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

         db.run(`CREATE INDEX node_list_entity_id ON node_list(entity_id)`);
         db.run(`CREATE INDEX node_list_open ON node_list(open)`);
    }

    private initNodelist(entity_id: number, start: [number, number], destination: [number, number]) {
        this.db.run(`DELETE FROM node_list WHERE entity_id = ${entity_id}`);
        this.db.run(`
            INSERT INTO node_list(entity_id, cell_id, position_x, position_y, start_x, start_y, destination_x, destination_y) 
            SELECT 
                ${entity_id},
                c.rowid
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

    public initSearch(entity_id: number, start: [number, number], destination: [number, number]) {
        this.initNodelist(entity_id, start, destination);
        this.db.run(`
            UPDATE 
                node_list AS nl 
            SET 
                g = 0.0,
                f = 0.0,
                open = TRUE
            WHERE 
                (nl.position, nl.position_y) = (${start[0]}, ${start[1]})
                AND nl.entity = ${entity_id}
            `);
    }

    public expand() {
        // idea: create intermediate table, put cheapest there, reuse twice
        this.db.run(`
            WITH 
            ordered(node_list_id, entity_id, cell_id, position_x, position_y, g, f_rank) AS (
                SELECT
                    rowid,
                    entity_id,
                    cell_id,
                    position_x,
                    position_y
                    g, 
                    ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY f ASC) AS f_rank
                FROM 
                    node_list AS nl 
                WHERE 
                    open
            ),
            cheapest(entity_id, cell_id, position_x, position_y, g) AS (
                SELECT 
                    entity_id,
                    cell_id,
                    position_x,
                    position_y,
                    g
                FROM 
                    node_list AS nl
                WHERE 
                    nl.rowid IN (SELECT node_list_id FROM ordered WHERE f_rank = 1) -- open filter was applied before
                UPDATE 
                    pathfinding.node_list AS nl 
                SET 
                    open = FALSE, 
                    closed = TRUE 
                WHERE 
                    node_list_id IN (SELECT node_list_id FROM ordered WHERE f_rank = 1) -- open filter was applied before
                RETURNING 
                    entity_id,
                    cell_id,
                    position_x,
                    position_y,
                    g
                --UPDATE 
                --    pathfinding.node_list AS nl 
                --SET 
                --    open = FALSE, 
                --    closed = TRUE 
                --WHERE 
                --    node_list_id IN (SELECT node_list_id FROM ordered WHERE f_rank = 1) -- open filter was applied before
                --RETURNING 
                --    entity_id,
                --    cell_id,
                --    position_x,
                --    position_y,
                --    g
            ),
            expand(entity_id, this_id, neighbour_id, neighbour_pos, open, tentative_g, g, destination_x, destination_y) AS (
                SELECT 
                    this.entity_id   AS entity_id,
                    this.cell_id     AS this_id,
                    ns.cell_id       AS neighbour_id,
                    ns.position      AS neighbour_pos,
                    ns.open          AS open,
                    this.g + 1       AS tentative_g,
                    ns.g             AS g,
                    ns.destination_x AS destination_x,
                    ns.destination_y AS destination_y
                FROM 
                    cheapest AS this
                    JOIN pathfinding.node_list AS ns 
                      ON this.entity_id = ns.entity_id
                    JOIN cell_neighbours AS cn 
                      ON this_cell_id = this.cell_id AND ns.cell_id = this.neighbour_id
                WHERE
                    NOT ns.closed
                    AND NOT (ns.open AND (this.g + 1) >= ns.g)
            )
            UPDATE pathfinding.node_list AS nl
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
}








/*


CREATE FUNCTION pathfinding.expand() RETURNS BOOLEAN AS $$
    WITH 
    ordered(node_list_id, entity_id, cell_id, position, g, f_rank) AS (
        SELECT
            node_list_id,
            entity_id,
            cell_id,
            position,
            g, 
            ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY f ASC) AS f_rank
        FROM 
            pathfinding.node_list AS nl 
        WHERE 
            open
    ),
    cheapest(entity_id, cell_id, position, g) AS (
        UPDATE 
            pathfinding.node_list AS nl 
        SET 
            open = FALSE, 
            closed = TRUE 
        WHERE 
            node_list_id IN (SELECT node_list_id FROM ordered WHERE f_rank = 1) -- open filter was applied before
        RETURNING 
            entity_id,
            cell_id,
            position,
            g
    ),
    expand(entity_id, this_id, neighbour_id, neighbour_pos, open, tentative_g, g, destination) AS (
        SELECT 
            this.entity_id         AS entity_id,
            this.cell_id          AS this_id,
            ns.cell_id            AS neighbour_id,
            ns.position           AS neighbour_pos,
            ns.open               AS open,
            this.g + ns.traversal_cost AS tentative_g,
            ns.g                  AS g,
            ns.destination        AS destination
        FROM 
            cheapest AS this
            JOIN pathfinding.node_list AS ns 
              --ON (ABS(ns.position[0] - this.position[0]), ABS(ns.position[1] - this.position[1])) IN ((0,1), (1,0), (1,1))
              ON ns.position <-> this.position IN (1, 1.4)
                 AND this.entity_id = ns.entity_id
        WHERE
            NOT ns.closed
            AND NOT (ns.open AND (this.g + ns.traversal_cost) >= ns.g)
    )
    UPDATE pathfinding.node_list AS nl
    SET 
        open = TRUE, -- we can safely put them all on true, since we filtered !open before
        g = e.tentative_g,
        f = e.tentative_g + pathfinding.h(e.neighbour_pos[0]::int, e.neighbour_pos[1]::int, e.destination[0]::int, e.destination[1]::int),-- pathfinding.h(e.this_pos[0]::int, e.this_pos[1]::int, e.neighbour_pos[0]::int, e.neighbour_pos[1]::int),
        predecessor = e.this_id
    FROM 
        expand AS e
    WHERE 
        nl.cell_id = e.neighbour_id 
        AND nl.entity_id = e.entity_id
   ;
   SELECT TRUE
;
$$ LANGUAGE sql;

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