DROP SCHEMA IF EXISTS environment CASCADE;
CREATE SCHEMA environment;

---------------------------------------------------------------
-- TABLES
---------------------------------------------------------------
CREATE TABLE environment.item_types(
    id   SERIAL PRIMARY KEY,
    name TEXT
);--


INSERT INTO environment.item_types(name) (VALUES
    ('pellet'),
    ('power pellet'),
    ('cherry')
);--


CREATE TABLE environment.entity_types(
    id   SERIAL PRIMARY KEY,
    name TEXT
);--


INSERT INTO environment.entity_types(name) (VALUES
    ('pacman'),
    ('ghost')
);--


CREATE TABLE environment.game_state(
    id    SERIAL PRIMARY KEY,
    level INT,
    score INT
);--


CREATE TABLE environment.cells(
    id       SERIAL PRIMARY KEY,
    x        INT, 
    y        INT, 
    passable BOOLEAN, 
    content  INT DEFAULT 1, -- pellet
    UNIQUE(x, y),
    FOREIGN KEY(content) REFERENCES environment.item_types(id)
);--
        

-- entities
CREATE TABLE environment.entities(
    id   SERIAL PRIMARY KEY,
    type TEXT
);--


CREATE TABLE environment.type_components(
    id        SERIAL PRIMARY KEY,
    entity_id INT,
    type      INT,
    FOREIGN KEY(type) REFERENCES environment.entity_types(id)
);--


-- components
CREATE TABLE environment.position_components(
    id        SERIAL PRIMARY KEY,
    entity_id INT, 
    x         FLOAT, 
    y         FLOAT,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id)                
);--


CREATE TABLE environment.movement_components(
    id        SERIAL PRIMARY KEY,
    entity_id INT, 
    ẟx        FLOAT, 
    ẟy        FLOAT,
    speed     FLOAT,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id)
);--


CREATE TABLE environment.controller_components(
    id         SERIAL PRIMARY KEY,
    entity_id  INT, 
    controller TEXT,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id)
);--


---------------------------------------------------------------
-- VIEWS
---------------------------------------------------------------
CREATE VIEW environment.entity_components(entity_id, x, y, ẟx, ẟy, speed, type) AS (
        SELECT 
            e.id,
            pc.x, 
            pc.y,
            mc.ẟx,
            mc.ẟy,
            mc.speed,
            et.name
        FROM 
            environment.entities AS e 
            LEFT JOIN environment.position_components AS pc 
              ON pc.entity_id = e.id
            LEFT JOIN environment.movement_components AS mc 
              ON mc.entity_id = e.id
            LEFT JOIN environment.type_components AS tc 
              ON tc.entity_id = e.id
            LEFT JOIN environment.entity_types AS et 
              ON tc.type = et.id
);--


CREATE VIEW environment.cell_neighbours(this_id, this_x, this_y, neighbour_id, neighbour_x, neighbour_y) AS (
        SELECT 
            this.id,
            this.x,
            this.y,
            that.id,
            that.x,
            that.y
        FROM 
            environment.cells AS this
            JOIN environment.cells AS that
              ON (ABS(this.x - that.x), ABS(this.y - that.y)) IN (VALUES (1,0), (0,1))
);--


-- like cell_neighbours, but includes center cell
CREATE VIEW environment.cell_neighbourhoods(this_id, this_x, this_y, neighbour_id, neighbour_x, neighbour_y) AS (
        SELECT 
            this_id, 
            this_x, 
            this_y, 
            neighbour_id, 
            neighbour_x, 
            neighbour_y
        FROM 
            environment.cell_neighbours
        UNION ALL 
        SELECT 
            id,
            x,
            y,
            id,
            x,
            y
        FROM 
            environment.cells
);--


-- does not work yet, because at the time of writing sqlite3 did not 
-- support having aggregates or windows within recursive queries. 
-- General idea has been successfully tested in postgresql.
--CREATE VIEW environment.compound_walls(cell_id, x, y, component_id) AS (
--    WITH RECURSIVE comps(cell_id, component_id) AS (
--        SELECT 
--            id AS cell_id,
--            id AS component_id
--        FROM 
--            environment.cells
--        WHERE 
--            NOT passable
--        UNION 
--        SELECT 
--            comps.cell_id,
--            MAX(neighbour_id)
--        FROM 
--            comps
--            JOIN environment.cell_neighbourhoods AS cn 
--              ON comps.cell_id = cn.this_id
--        GROUP BY 
--            comps.cell_id
--    ) 
--    SELECT 
--        comps.cell_id,
--        MAX(c.x), -- THE 
--        MAX(c.y), -- THE 
--        MAX(comps.component_id)
--    FROM 
--        comps 
--        JOIN environment.cells AS c 
--          ON comps.cell_id = cells.id
--    GROUP BY 
--        comps.cell_id
--);--


-- this is basically a temporary table, but creating it in pg_temp keeps failing for some reason
CREATE TABLE environment.cleared_cells(
    cell_id INT,
    x INT,
    y INT
);--

---------------------------------------------------------------
-- FUNCTIONS
---------------------------------------------------------------
CREATE FUNCTION environment.update_positions()
RETURNS TABLE(eid INT, x INT, y INT) AS $$
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
    ;

    INSERT INTO environment.cleared_cells(cell_id, x ,y)
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
        JOIN obp
          ON (c.x, c.y) = (obp.x, obp.y)
    WHERE
        content IS NOT NULL
    ;

    UPDATE environment.cells SET 
        content = NULL 
    WHERE 
        id IN (SELECT cell_id FROM environment.cleared_cells)
    ;


    UPDATE environment.game_state SET 
        score = score + (SELECT COUNT(cell_id) FROM environment.cleared_cells)
    ;

    SELECT 
        cell_id, 
        x, 
        y 
    FROM 
        environment.cleared_cells
    ;
$$ LANGUAGE sql;--


CREATE FUNCTION environment.create_entity(_type TEXT, _x INT, _y INT, _ẟx INT, _ẟy INT, _speed DOUBLE PRECISION, _controller TEXT)
RETURNS INT AS $$
    WITH 
    new_entity(eid) AS (
        INSERT INTO environment.entities(type) VALUES ('entity') RETURNING id
    ),
    pc AS (
        INSERT INTO environment.position_components(entity_id, x, y) (VALUES ((SELECT eid FROM new_entity), _x, _y))
    ),
    mc AS (
        INSERT INTO environment.movement_components(entity_id, ẟx, ẟy, speed) (VALUES ((SELECT eid FROM new_entity), _ẟx, _ẟy, _speed))
    ),
    tc AS (
        INSERT INTO environment.type_components(entity_id, type) (VALUES ((SELECT eid FROM new_entity), (SELECT id FROM environment.entity_types WHERE name = _type)))
    ),
    cc AS (
        INSERT INTO environment.controller_components(entity_id, controller) (VALUES ((SELECT eid FROM new_entity), _controller))
    )
    SELECT eid FROM new_entity    
$$ LANGUAGE sql;--


CREATE FUNCTION environment.create_map(_w INT, _h INT)
RETURNS VOID AS $$
    DELETE FROM environment.cells;

    WITH RECURSIVE 
    xs(x) AS (
        SELECT 0
        UNION ALL
        SELECT x + 1 FROM xs WHERE x + 1 < _w
    ),
    ys(y) AS (
        SELECT 0
        UNION ALL
        SELECT y + 1 FROM ys WHERE y + 1 < _h
    )
    INSERT INTO environment.cells(x, y, passable) 
    SELECT 
        xs.x,
        ys.y,
        TRUE
    FROM 
        xs,
        ys
$$ LANGUAGE sql;--


CREATE FUNCTION environment.push(_eid INT, _x DOUBLE PRECISION, _y DOUBLE PRECISION)
RETURNS VOID AS $$
    UPDATE environment.movement_components SET
        ẟx = _x * speed,
        ẟy = _y * speed
    WHERE 
        entity_id = _eid
$$ LANGUAGE sql;--
