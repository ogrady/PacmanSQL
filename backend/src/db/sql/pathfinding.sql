DROP SCHEMA IF EXISTS pathfinding CASCADE;
CREATE SCHEMA pathfinding;

CREATE TABLE pathfinding.node_list(
    id SERIAL PRIMARY KEY,
    entity_id INT,
    cell_id INT,
    start_x INT,
    start_y INT,
    destination_x INT,
    destination_y INT,
    position_x INT,
    position_y INT,
    predecessor INT DEFAULT NULL,
    g REAL DEFAULT 'Infinity',
    f REAL DEFAULT 'Infinity',
    closed BOOLEAN DEFAULT FALSE,
    open BOOLEAN DEFAULT FALSE,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id),
    FOREIGN KEY(cell_id) REFERENCES environment.cells(id),
    FOREIGN KEY(predecessor) REFERENCES environment.cells(id),
    UNIQUE(cell_id, entity_id)
);--

CREATE INDEX --node_list_entity_id 
ON pathfinding.node_list(entity_id);
CREATE INDEX --node_list_open 
ON pathfinding.node_list(open);

-- intermediate tables
CREATE TABLE pathfinding.cheapest(
    id SERIAL PRIMARY KEY,
    node_list_id INT,
    entity_id INT, 
    cell_id INT, 
    position_x INT, 
    position_y INT, 
    g REAL
);--

CREATE TABLE pathfinding.complete_paths(
    id SERIAL PRIMARY KEY,
    steps INT, 
    entity_id INT, 
    cell_id INT, 
    position_x INT, 
    position_y INT, 
    predecessor INT
);--


---------------------------------------------------------------
-- FUNCTIONS
---------------------------------------------------------------
CREATE FUNCTION pathfinding.init_node_list(_eid INT, _start POINT, _dest POINT)
RETURNS VOID AS $$
    DELETE FROM pathfinding.node_list WHERE entity_id = _eid;

    INSERT INTO pathfinding.node_list(entity_id, cell_id, position_x, position_y, start_x, start_y, destination_x, destination_y) 
        SELECT 
            _eid,
            c.id,
            c.x,
            c.y,
            _start[0],
            _start[1],
            _dest[0],
            _dest[1]
        FROM 
            environment.cells AS c
        WHERE 
            c.passable
    ;
$$ LANGUAGE sql;--


CREATE FUNCTION pathfinding.init_search(_eid INT, _start POINT, _dest POINT)
RETURNS VOID AS $$
    DELETE FROM pathfinding.complete_paths WHERE entity_id = _eid;

    SELECT pathfinding.init_node_list(_eid, _start, _dest);

    UPDATE 
        pathfinding.node_list AS nl 
    SET 
        g = 0.0,
        f = 0.0,
        open = TRUE
    WHERE 
        (nl.position_x, nl.position_y) = (_start[0], _start[1])
        AND nl.entity_id = _eid
    ;
$$ LANGUAGE sql;--


CREATE FUNCTION pathfinding.init_entity_to_entity_search(_eid1 INT, _eid2 INT)
RETURNS VOID AS $$
    SELECT pathfinding.init_search(
        _eid1, 
        (SELECT POINT(FLOOR(x),FLOOR(y)) FROM environment.position_components WHERE entity_id = _eid1),
        (SELECT POINT(FLOOR(x),FLOOR(y)) FROM environment.position_components WHERE entity_id = _eid2)
    );
$$ LANGUAGE sql;--


CREATE FUNCTION pathfinding.expand()
RETURNS VOID AS $$
    DELETE FROM pathfinding.cheapest;
        
    WITH 
    ordered(node_list_id, entity_id, cell_id, position_x, position_y, g, f_rank) AS (
        SELECT
            nl.id,
            nl.entity_id,
            nl.cell_id,
            nl.position_x,
            nl.position_y,
            nl.g,
            ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY f ASC) AS f_rank
        FROM 
            pathfinding.node_list AS nl 
        WHERE 
            open
    )
    INSERT INTO pathfinding.cheapest(node_list_id, entity_id, cell_id, position_x, position_y, g)
    SELECT 
        nl.id,
        nl.entity_id,
        nl.cell_id,
        nl.position_x,
        nl.position_y,
        nl.g
    FROM 
        pathfinding.node_list AS nl
    WHERE 
        nl.id IN (SELECT node_list_id FROM ordered WHERE f_rank = 1)
    ;

        
    UPDATE 
        pathfinding.node_list AS nl 
    SET 
        open = FALSE, 
        closed = TRUE 
    WHERE 
        id IN (SELECT node_list_id FROM pathfinding.cheapest)
    ;

        
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
            pathfinding.cheapest AS this
            JOIN pathfinding.node_list AS ns 
              ON this.entity_id = ns.entity_id
            JOIN environment.cell_neighbours AS cn 
              ON cn.this_id = this.cell_id AND ns.cell_id = cn.neighbour_id
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
$$ LANGUAGE sql;--


CREATE FUNCTION pathfinding.resolve_paths()
RETURNS TABLE(steps INT, entity_id INT, cell_id INT, position_x INT, position_y INT) AS $$
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
            pathfinding.node_list
        WHERE 
            (destination_x, destination_y) = (position_x, position_y)
            AND predecessor IS NOT NULL
    ),
    paths↺(steps, entity_id, cell_id, position_x, position_y, predecessor) AS (
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
            pathfinding.node_list AS nl 
            JOIN paths↺ AS p 
              ON nl.cell_id = p.predecessor
                 AND nl.entity_id = p.entity_id
    )
    INSERT INTO pathfinding.complete_paths(steps, entity_id, cell_id, position_x, position_y, predecessor)
        SELECT * FROM paths↺
    ;

    DELETE FROM 
        pathfinding.node_list AS nl 
    WHERE
        nl.entity_id IN (SELECT DISTINCT entity_id FROM pathfinding.complete_paths)
    ;

    -- this is basically debugging. Complete paths are stored in complete_path
    SELECT 
        p.steps,
        p.entity_id,
        p.cell_id,
        p.position_x,
        p.position_y
    FROM 
        pathfinding.complete_paths AS p 
    ORDER BY 
        p.steps DESC
    ;
$$ LANGUAGE sql;--