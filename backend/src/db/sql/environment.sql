DROP SCHEMA IF EXISTS environment CASCADE;
CREATE SCHEMA environment;

CREATE OR REPLACE FUNCTION the_func(acc anyelement, x anyelement) RETURNS anyelement AS $$
BEGIN
    IF acc <> x THEN 
        RAISE EXCEPTION 'THE used on an inconsistent list. Expected consistent %, but the list also contained %.', acc, x ;
    END IF;
    RETURN x;
END $$ LANGUAGE PLPGSQL STRICT;-- STRICT ignores null values


CREATE OR REPLACE AGGREGATE the(anyelement)
(
    sfunc = the_func,
    stype = anyelement
);--

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


-- used to determine neighbours in a consistent way,
-- ie gives us the means to (dis)allow diagonal neighbours.
CREATE VIEW environment.neighbour_offsets(x, y) AS (
    SELECT x,y FROM (VALUES (1,0), (0,1)) AS xs(x,y)
);--


-- no diagonals
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
              ON (ABS(this.x - that.x), ABS(this.y - that.y)) IN (SELECT x, y FROM environment.neighbour_offsets)
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

-- fixme: make into view again
-- finds connected pieces of walls.
--CREATE FUNCTION environment.compound_walls()
--RETURNS TABLE(cell_id INT, x INT, y INT, component_id INT) AS $$
-- make into materialized view and
-- keep in mind to call `REFRESH MATERIALIZED VIEW environment.compound_walls;` when generating more map
CREATE VIEW environment.compound_walls(cell_id, x, y, component_id) AS (
    WITH RECURSIVE 
    comps↺(iteration, cell_id, component_id) AS (
        SELECT 
            1  AS iteration,
            id AS cell_id,
            id AS component_id
        FROM 
            environment.cells
        WHERE 
            NOT passable
        UNION
        (
            WITH comps AS (TABLE comps↺) -- hack to work around restriction to not use aggregates in recursive term
            TABLE comps 
            UNION ALL
            SELECT
                MAX(comps.iteration + 1),
                cn.this_id,
                MAX(n_comps.component_id)
            FROM 
                comps
                JOIN environment.cell_neighbourhoods AS cn 
                  ON comps.cell_id = cn.this_id
                JOIN environment.cells AS c 
                  ON cn.neighbour_id = c.id 
                JOIN comps AS n_comps
                  ON cn.neighbour_id = n_comps.cell_id
            WHERE 
                NOT c.passable and comps.iteration < 100 -- emergency break for now, instead look how many updates happened in that generation and break at 0
            GROUP BY 
                cn.this_id
        )
    ) 
    SELECT 
        comps.cell_id,
        THE(c.x),
        THE(c.y),
        MAX(comps.component_id)
    FROM 
        comps↺ AS comps 
        JOIN environment.cells AS c 
          ON comps.cell_id = c.id
    GROUP BY 
        comps.cell_id
);--
--$$ LANGUAGE sql;

-- this is basically a temporary table, but creating it in pg_temp keeps failing for some reason
CREATE TABLE environment.cleared_cells(
    cell_id INT,
    x INT,
    y INT
);--


-- for debugging, visualises the map nicely
CREATE VIEW environment.visual_map(content) AS (
    SELECT 
        string_agg(CASE WHEN passable THEN '⬜' ELSE '⬛' END, '' ORDER BY x)
    FROM
        environment.cells
    GROUP BY 
        y
    ORDER BY 
        y
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

    INSERT INTO environment.cells(x, y, passable) 
    SELECT 
        xs.x,
        ys.y,
        TRUE
    FROM 
        generate_series(0, _w - 1) AS xs(x),
        generate_series(0, _h - 1) AS ys(y)
$$ LANGUAGE sql;--


CREATE FUNCTION environment.push(_eid INT, _x DOUBLE PRECISION, _y DOUBLE PRECISION)
RETURNS VOID AS $$
    UPDATE environment.movement_components SET
        ẟx = _x * speed,
        ẟy = _y * speed
    WHERE 
        entity_id = _eid
$$ LANGUAGE sql;--





SELECT environment.create_map(11, 10);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (1,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (2,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (4,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (6,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (8,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (9,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,0);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,1);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,1);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,1);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,2);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (2,2);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,2);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,2);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,2);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (8,2);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,2);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,3);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,3);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,3);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,3);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,3);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,4);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (1,4);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (9,4);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,4);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,5);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (1,5);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,5);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (4,5);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (6,5);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,5);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (9,5);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,5);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,6);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,6);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,7);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (2,7);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (4,7);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,7);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (6,7);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (8,7);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,7);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,8);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,8);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (1,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (2,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (4,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (6,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (8,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (9,9);-------------
UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,9);







-- https://de.wikipedia.org/wiki/Marching_Squares#Beispiel
-- □□     ■■     □□     ■■
-- □□ →   □□ →   ■■ ←   ■□ →
--    
-- □■     ■□     ■□     ■□
-- □□ →   □□ ↑   ■■ ↑   □■ ↑
--    
-- □□     □□     ■■     ■■
-- □■ ↓   ■□ ←   □■ ↓   ■■ ✕  

-- FIXME: add one cell to each side
-- FIXME: when two components are connected diagonally,
-- they are rightfully separated into two components,
-- but the MS algorithm will detect them as one component.
WITH RECURSIVE
moves(hash, x_off, y_off) AS (
    VALUES
    ('□□□□',  1,  0), ('■■□□',  1,  0), ('□□■■', -1,  0), ('■■■□', 1,  0),
    ('□■□□',  1,  0), ('■□□□',  0, -1), ('■□■■',  0, -1), ('■□□■', 0, -1),
    ('□□□■',  0,  1), ('□□■□', -1,  0), ('■■□■',  0,  1), ('■■■■', 0,  0)
),
-- complete grid with components marked down
grid(cell_id, x, y, passable, component_id) AS (
    SELECT 
        c.id,
        c.x,
        c.y,
        c.passable,
        cw.component_id
    FROM 
        environment.cells AS c 
        LEFT JOIN environment.compound_walls AS cw 
          ON c.id = cw.cell_id
),
-- one random coordinate per component
start_coordinates(cell_id, x, y, passable, component_id) AS (
    SELECT DISTINCT ON (component_id)
        cell_id, x, y, passable, component_id
    FROM
        grid
    WHERE 
        component_id IS NOT NULL
    ORDER BY 
        component_id, y, x -- most bottom-right cell
),
-- offsets to make a coordinate into a square
square_offsets(x, y) AS (
    SELECT 
        *
    FROM 
        generate_series(0,1) AS xs, 
        generate_series(0,1) AS ys
),
marching_squares↺(iteration, cell_id, x, y, passable, component_id, start) AS (
    SELECT 
        1,
        cell_id, 
        x, 
        y, 
        passable, 
        component_id, 
        (x, y) , (1,1), ''
    FROM 
        start_coordinates
    UNION ALL 
    (
    WITH
    squares(iteration, origin_id, origin_x, origin_y, cell_id, x, y, passable, component_id, start) AS (
        WITH coordinates(iteration, origin_id, origin_x, origin_y, neighbour_x, neighbour_y, start) AS (
            SELECT
                ms.iteration AS iteration,
                ms.cell_id   AS origin_id,
                ms.x         AS origin_x,
                ms.y         AS origin_y,
                ms.x - so.x  AS neighbour_x, -- using minus here is important to match the resulting squares with the hashes!
                ms.y - so.y  AS neighbour_y,
                ms.start     AS start
            FROM   
                marching_squares↺ AS ms,
                square_offsets    AS so
        )
        SELECT 
            c.iteration       AS iteration,
            c.origin_id       AS origin_id,
            c.origin_x        AS origin_x,
            c.origin_y        AS origin_y,
            grid.cell_id      AS cell_id, 
            grid.x            AS x,
            grid.y            AS y,
            grid.passable     AS passable,
            grid.component_id AS component_id,
            c.start           AS start
        FROM 
            coordinates AS c
            JOIN grid 
              ON (c.neighbour_x, c.neighbour_y) = (grid.x, grid.y)   
    ),
    hashes(iteration, origin_id, hash, start) AS (
        SELECT 
            iteration,
            origin_id,
            string_agg(CASE WHEN passable THEN '■' ELSE '□' END ,'' ORDER BY x,y),
            start
        FROM 
            squares
        GROUP BY 
            origin_id, start, iteration
    )
    SELECT 
        hashes.iteration + 1           AS iteration,
        new_grid.cell_id               AS cell_id,
        new_grid.x                     AS x,
        new_grid.y                     AS y,
        new_grid.passable              AS passable,
        origin_grid.component_id       AS component_id,
        (origin_grid.x, origin_grid.y) AS start,
        (moves.x_off, moves.y_off),
        hashes.hash
    FROM 
        hashes
        JOIN grid AS origin_grid
          ON hashes.origin_id = origin_grid.cell_id
        JOIN moves
          ON hashes.hash = moves.hash 
        JOIN grid AS new_grid
          ON (origin_grid.x + moves.x_off, origin_grid.y + moves.y_off) = (new_grid.x, new_grid.y)
    WHERE 
        iteration < 100
        or (new_grid.x, new_grid.y) <> hashes.start
    )

)
select * from marching_squares↺;
--SELECT 
--    x,y,iteration,component_id
--FROM 
--    marching_squares↺
--ORDER BY 
--    component_id,
--    iteration
--select 1;
