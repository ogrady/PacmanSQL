DROP SCHEMA IF EXISTS environment CASCADE;
CREATE SCHEMA environment;--

-- https://stackoverflow.com/a/1036010
CREATE OR REPLACE FUNCTION update_last_update_column()
RETURNS TRIGGER AS $$ BEGIN
   NEW.last_update = now(); 
   RETURN NEW;
END $$ LANGUAGE PLPGSQL;--

CREATE OR REPLACE FUNCTION the_func(acc anyelement, x anyelement) 
RETURNS anyelement AS $$ BEGIN
    IF acc <> x THEN 
        RAISE EXCEPTION 'THE used on an inconsistent list. Expected consistent %, but the list also contained %.', acc, x ;
    END IF;
    RETURN x;
-- STRICT ignores null values
END $$ LANGUAGE PLPGSQL;--
    

CREATE OR REPLACE AGGREGATE the(anyelement)
(
    sfunc = the_func,
    stype = anyelement
);--



---------------------------------------------------------------
-- DATA TYPES WITH METHODS
---------------------------------------------------------------
-- determines the length of _v.
CREATE FUNCTION environment.length(_v POINT) RETURNS DOUBLE PRECISION AS $$
    SELECT SQRT(_v[0] * _v[0] + _v[1] * _v[1]);
$$ LANGUAGE sql IMMUTABLE;

-- subtracts _v1 from _v2.
CREATE FUNCTION environment.sub(_v1 POINT, _v2 POINT) RETURNS POINT AS $$
    SELECT POINT(_v2[0] - _v1[0], _v2[1] - _v1[1]);
$$ LANGUAGE sql IMMUTABLE;

-- adds _v1 to _v2.
CREATE FUNCTION environment.add(_v1 POINT, _v2 POINT) RETURNS POINT AS $$
    SELECT POINT(_v2[0] + _v1[0], _v2[1] + _v1[1]);
$$ LANGUAGE sql IMMUTABLE;

-- multiplies _v and _x.
CREATE FUNCTION environment.mul(_v POINT, _x FLOAT) RETURNS POINT AS $$
    SELECT POINT(_x * _v[0], _x * _v[1]);
$$ LANGUAGE sql IMMUTABLE;

-- multiplies _v1 and _v2.
CREATE FUNCTION environment.mul(_v1 POINT, _v2 POINT) RETURNS POINT AS $$
    SELECT POINT(_v2[0] * _v1[0], _v2[1] * _v1[1]);
$$ LANGUAGE sql IMMUTABLE;

-- calculates the distance between _v1 and _v2.
CREATE FUNCTION environment.distance(_v1 POINT, _v2 POINT) RETURNS DOUBLE PRECISION AS $$
    SELECT SQRT((_v1[0] - _v2[0]) * (_v1[0] - _v2[0]) + (_v1[1] - _v2[1]) * (_v1[1] - _v2[1]));
$$ LANGUAGE sql IMMUTABLE;

-- normalises _v to length 1. Vectors of length 0 will result in (0 0).
CREATE FUNCTION environment.normalise(_v POINT) RETURNS POINT AS $$
    SELECT CASE WHEN environment.length(_v) = 0
                THEN POINT(0,0)
                ELSE POINT(
                    _v[0] / environment.length(_v),
                    _v[1] / environment.length(_v)
                )
            END;
$$ LANGUAGE sql IMMUTABLE;

-- scales length of _v to _x
CREATE FUNCTION environment.scale(_v POINT, _x FLOAT) RETURNS POINT AS $$
    SELECT environment.mul(environment.normalise(_v), _x);
$$ LANGUAGE sql IMMUTABLE;

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


CREATE TABLE environment.entity_categories(
    name TEXT PRIMARY KEY 
);--


INSERT INTO environment.entity_categories(name) (VALUES
    ('actor'),
    ('item')
);--


CREATE TABLE environment.entity_types(
    id       SERIAL PRIMARY KEY,
    name     TEXT,
    category TEXT REFERENCES environment.entity_categories
);--


INSERT INTO environment.entity_types(name, category) (VALUES
    ('pacman', 'actor'),
    ('ghost', 'actor'),
    ('pellet', 'item')
);--


CREATE TABLE environment.game_state(
    id    SERIAL PRIMARY KEY,
    level INT,
    checkpoint TIMESTAMP
);--

INSERT INTO environment.game_state(level, checkpoint) (VALUES (1, now()));--


CREATE TABLE environment.cells(
    id       SERIAL PRIMARY KEY,
    x        INT, 
    y        INT, 
    passable BOOLEAN, 
    UNIQUE(x, y)
);--
        

-- entities
CREATE TABLE environment.entities(
    id   SERIAL PRIMARY KEY,
    type TEXT
);--


CREATE TABLE environment.type_components(
    id          SERIAL PRIMARY KEY,
    entity_id   INT,
    type_id     INT,
    last_update TIMESTAMP,
    FOREIGN KEY(type_id) REFERENCES environment.entity_types(id) ON DELETE CASCADE
);--


-- components 
-- TRIGGERS ARE GENERATED AUTOMATICALLY!
-- Comment any column with "-- WATCHED" to generate a trigger that updates last_update
CREATE TABLE environment.extent_components(
    id          SERIAL PRIMARY KEY,
    entity_id   INT, 
    width       FLOAT,
    height      FLOAT,
    last_update TIMESTAMP,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id) ON DELETE CASCADE
);--

CREATE TABLE environment.colour_components(
    id          SERIAL PRIMARY KEY,
    entity_id   INT, 
    red         INT CHECK (red BETWEEN 0 AND 255),
    green       INT CHECK (green BETWEEN 0 AND 255),
    blue        INT CHECK (blue BETWEEN 0 AND 255),
    last_update TIMESTAMP,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id) ON DELETE CASCADE
);--

CREATE TABLE environment.position_components(
    id          SERIAL PRIMARY KEY,
    entity_id   INT, 
    x           FLOAT, -- WATCHED
    y           FLOAT, -- WATCHED
    z           FLOAT DEFAULT 1, 
    last_update TIMESTAMP,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id) ON DELETE CASCADE
);--

CREATE TABLE environment.movement_components(
    id          SERIAL PRIMARY KEY,
    entity_id   INT, 
    ẟx          FLOAT, -- WATCHED
    ẟy          FLOAT, -- WATCHED
    speed       FLOAT,
    last_update TIMESTAMP,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id) ON DELETE CASCADE
);--


CREATE TABLE environment.controller_components(
    id          SERIAL PRIMARY KEY,
    entity_id   INT, 
    controller  TEXT,
    last_update TIMESTAMP,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id) ON DELETE CASCADE
);--

CREATE TABLE environment.score_components(
    id          SERIAL PRIMARY KEY,
    entity_id   INT, 
    score       INT,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id) ON DELETE CASCADE
);--


---------------------------------------------------------------
-- VIEWS
---------------------------------------------------------------
CREATE VIEW environment.entity_components(entity_id, x, y, z, width, height, center_x, center_y, ẟx, ẟy, speed, type, category, red, green, blue, score, last_update) AS (
        SELECT 
            e.id,
            pc.x, 
            pc.y,
            pc.z,
            ext.width,
            ext.height,
            pc.x + ext.width/2  AS center_x,
            pc.y + ext.height/2 AS center_y,
            mc.ẟx,
            mc.ẟy,
            mc.speed,
            et.name,
            et.category,
            col.red,
            col.green,
            col.blue,
            score.score,
            GREATEST(pc.last_update, mc.last_update, tc.last_update, ext.last_update, col.last_update)
        FROM 
            environment.entities AS e 
            LEFT JOIN environment.position_components AS pc 
              ON pc.entity_id = e.id
            LEFT JOIN environment.movement_components AS mc 
              ON mc.entity_id = e.id
            LEFT JOIN environment.type_components AS tc 
              ON tc.entity_id = e.id
            LEFT JOIN environment.entity_types AS et 
              ON tc.type_id = et.id
            LEFT JOIN environment.extent_components AS ext
              ON ext.entity_id = e.id
            LEFT JOIN environment.colour_components AS col 
              ON col.entity_id = e.id
            LEFT JOIN environment.score_components AS score 
              ON score.entity_id = e.id
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

-- finds connected pieces of walls.
-- FIXME: make into materialized view and keep in mind to call `REFRESH MATERIALIZED VIEW environment.compound_walls;` when generating more map
CREATE VIEW environment.compound_walls(cell_id, x, y, component_id) AS (
    WITH RECURSIVE 
    comps↺(cell_id, component_id) AS (
        SELECT 
            id AS cell_id,
            id AS component_id
        FROM 
            environment.cells
        WHERE 
            NOT passable
        UNION
        (
            WITH comps AS (TABLE comps↺) -- hack to work around restriction to not use aggregates in recursive term
            SELECT
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
                NOT c.passable
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


-- https://de.wikipedia.org/wiki/Marching_Squares#Beispiel
-- □□     ■■     □□     ■■
-- □□ →   □□ →   ■■ ←   ■□ →
--    
-- □■     ■□     ■□     ■□
-- □□ →   □□ ↑   ■■ ↑   □■ ↑
--    
-- □■     ■□     □■     □■
-- □■ ↓   ■□ ↑   ■■ ←   ■□ ←  
--
-- □□     □□     ■■     ■■
-- □■ ↓   ■□ ←   □■ ↓   ■■ ✕  

-- FIXME: when two components are connected diagonally,
-- they are rightfully separated into two components,
-- but the MS algorithm will detect them as one component.
CREATE VIEW environment.wall_shapes(wall, coordinates) AS (
WITH RECURSIVE
moves(hash, x_off, y_off) AS (
    VALUES
    ('□□□□',  1,  0), ('■■□□',  1,  0), ('□□■■', -1,  0), ('■■■□', 1,  0),
    ('□■□□',  1,  0), ('■□□□',  0, -1), ('■□■■',  0, -1), ('■□□■', 0, -1),
    ('□■□■',  0,  1), ('■□■□',  0, -1), ('□■■■',  -1, 0), ('□■■□', -1, 0),
    ('□□□■',  0,  1), ('□□■□', -1,  0), ('■■□■',  0,  1) --, ('■■■■', 0,  0)
),
-- complete grid with components marked down
grid(x, y, passable, component_id) AS (
    -- for components that reach all the way to the border of the map, we need to add another cell
    -- in each direction, to make sure they can still form proper square.
    -- That extra space needs to be "walkable" to produce the proper hashes of a cell that is "not occupied by a wall"
    WITH fluffed(x, y) AS (
        SELECT x,y FROM environment.cells 
        UNION -- using UNION we do not get duplicate cells, but just the extra cells outside of the original map's borders
        SELECT 
            c.x + xs.x,
            c.y + ys.y
        FROM 
            environment.cells AS c,
            generate_series(-1,1) AS xs(x),
            generate_series(-1,1) AS ys(y)
    )
    SELECT 
        f.x,
        f.y,
        cw.component_id IS NULL,
        cw.component_id
    FROM 
        fluffed AS f 
        LEFT JOIN environment.compound_walls AS cw
          ON (cw.x, cw.y) = (f.x, f.y)
),
-- one coordinate per component
start_coordinates(x, y, component_id) AS (
    SELECT DISTINCT ON (component_id)
        x, 
        y, 
        component_id
    FROM
        grid
    WHERE 
        component_id IS NOT NULL
    ORDER BY 
        component_id, y DESC, x DESC -- most bottom-right cell. This is required, as using a cell of the upper-left part would go around the OUTSIDE of the outermost shape. We need it to go around the INSIDE.
),
-- offsets to make a coordinate into a square
square_offsets(x, y) AS (
    SELECT 
        xs.x, 
        ys.y
    FROM 
        generate_series(0,1) AS xs(x), 
        generate_series(0,1) AS ys(y)
),
marching_squares↺(iteration, x, y, component_id, start) AS (
    SELECT 
        1,
        x, 
        y, 
        component_id, 
        (x, y)
    FROM 
        start_coordinates
    UNION ALL 
    (
    WITH
    squares(iteration, origin_x, origin_y, x, y, passable, component_id, start) AS (
        WITH coordinates(iteration, component_id, origin_x, origin_y, neighbour_x, neighbour_y, start) AS (
            SELECT
                ms.iteration    AS iteration,
                ms.component_id AS component_id,
                ms.x            AS origin_x,
                ms.y            AS origin_y,
                ms.x - so.x     AS neighbour_x, -- using minus here is important to match the resulting squares with the hashes! (origin needs to be lower right coordinate of the square)
                ms.y - so.y     AS neighbour_y,
                ms.start        AS start
            FROM   
                marching_squares↺ AS ms,
                square_offsets    AS so
        )
        SELECT 
            c.iteration       AS iteration,
            c.origin_x        AS origin_x,
            c.origin_y        AS origin_y,
            grid.x            AS x,
            grid.y            AS y,
            grid.passable     AS passable,
            c.component_id    AS component_id,
            c.start           AS start
        FROM 
            coordinates AS c
            JOIN grid 
              ON (c.neighbour_x, c.neighbour_y) = (grid.x, grid.y)   
    ),
    hashes(iteration, origin_x, origin_y, component_id, hash, start) AS (
        SELECT 
            iteration,
            origin_x,
            origin_y,
            THE(component_id),
            string_agg(CASE WHEN passable THEN '□' ELSE '■' END ,'' ORDER BY y,x), -- yes, y,x is correct
            start
        FROM 
            squares
        GROUP BY 
            origin_x, origin_y, start, iteration
    )
    SELECT 
        hashes.iteration + 1        AS iteration,
        grid.x                      AS x,
        grid.y                      AS y,
        hashes.component_id         AS component_id,
        hashes.start                AS start
    FROM 
        hashes
        JOIN moves
          ON hashes.hash = moves.hash 
        JOIN grid
          ON (hashes.origin_x + moves.x_off, hashes.origin_y + moves.y_off) = (grid.x, grid.y)
    WHERE 
        (grid.x, grid.y) <> hashes.start
    )

),
-- add another line back to the origin of each shapes to close them
closed(component_id, iteration, x, y) AS (
    SELECT 
        component_id,
        iteration,
        x,
        y
    FROM 
        marching_squares↺ AS ms
    UNION ALL
    SELECT 
        component_id,
        (SELECT MAX(iteration) + 1 FROM marching_squares↺), -- this guarantees that the closing line will always come last in the following ordering
        x,
        y
    FROM 
        marching_squares↺ AS ms
    WHERE 
        iteration = 1
),
reduced(component_id, iteration, x, y, superfluous) AS (
    SELECT 
        component_id,
        iteration,
        x,
        y,
        COALESCE(
            LEAD(x) OVER(PARTITION BY component_id ORDER BY iteration) = x AND LAG(x) OVER(PARTITION BY component_id ORDER BY iteration) = x
            OR 
            LEAD(y) OVER(PARTITION BY component_id ORDER BY iteration) = y AND LAG(y) OVER(PARTITION BY component_id ORDER BY iteration) = y
        , FALSE) -- first and last piece will be NULL
          AS superfluous
    FROM 
        closed
)
SELECT 
    component_id,
    array_agg(array[x,y] ORDER BY iteration)
FROM 
    reduced
WHERE 
    NOT superfluous
GROUP BY 
    component_id

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


-- entity ids of colliding entities, where
-- eid1 is the entity with smaller typename (to make defining handler functions easier)
CREATE VIEW environment.collisions(eid1, eid2, type1, type2) AS (
    WITH bodies(entity_id, bounding_box, type_id, type_name) AS (
        SELECT
            pc.entity_id,
            BOX(POINT(pc.x, pc.y), POINT(pc.x + ec.width, pc.y + ec.height)),
            tc.type_id,
            et.name
        FROM
            environment.position_components AS pc
            JOIN environment.extent_components AS ec
              ON pc.entity_id = ec.entity_id
            JOIN environment.type_components AS tc
              ON pc.entity_id = tc.entity_id
            JOIN environment.entity_types AS et
              ON tc.type_id = et.id
    )
    SELECT 
    CASE WHEN this.type_name < that.type_name THEN this.entity_id ELSE that.entity_id END,
    CASE WHEN this.type_name < that.type_name THEN that.entity_id ELSE this.entity_id END,
    CASE WHEN this.type_name < that.type_name THEN this.type_name ELSE that.type_name END,
    CASE WHEN this.type_name < that.type_name THEN that.type_name ELSE this.type_name END
    FROM 
        bodies AS this
        JOIN bodies AS that 
          ON this.bounding_box && that.bounding_box
             AND this.entity_id < that.entity_id -- <> removes collisions with self, < removes duplicate collisions
);--

---------------------------------------------------------------
-- FUNCTIONS
---------------------------------------------------------------
CREATE FUNCTION environment.start_towards(_eid INT, _pos POINT)
RETURNS VOID AS $$
    WITH 
    scaled(v) AS (
        SELECT 
            environment.scale(environment.sub(POINT(pc.x, pc.y), _pos), LEAST(mc.speed, environment.length(environment.sub(POINT(pc.x, pc.y), _pos))))
        FROM 
            environment.position_components AS pc
            JOIN environment.movement_components AS mc
              ON pc.entity_id = mc.entity_id
        WHERE
            pc.entity_id = _eid
    )
    UPDATE environment.movement_components
    SET 
        ẟx = scaled.v[0],
        ẟy = scaled.v[1]
    FROM 
        scaled
    WHERE 
        entity_id = _eid
$$ LANGUAGE sql;--

CREATE FUNCTION environment.update_positions()
RETURNS VOID AS $$
    WITH upd(entity_id, new_x, new_y) AS (
        SELECT 
            pc.entity_id,
            ROUND((pc.x + mc.ẟx)::numeric, 2), -- https://stackoverflow.com/questions/13113096/how-to-round-an-average-to-2-decimal-places-in-postgresql/13113623#comment17829941_13113623
            ROUND((pc.y + mc.ẟy)::numeric, 2)
        FROM
            environment.position_components AS pc
            JOIN environment.movement_components AS mc
              ON pc.entity_id = mc.entity_id
            JOIN environment.cells AS c 
              ON ROUND(pc.x + mc.ẟx + 0) = c.x AND 
                 ROUND(pc.y + mc.ẟy + 0) = c.y
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
$$ LANGUAGE sql;--


CREATE FUNCTION environment.create_entity(_type TEXT, _x INT, _y INT, _z INT, _width FLOAT, _height FLOAT, _ẟx INT, _ẟy INT, _speed DOUBLE PRECISION, _controller TEXT, _red INT, _green INT, _blue INT)
RETURNS INT AS $$
    WITH 
    random_position(rand_x, rand_y) AS ( -- just in case! _x and _y might be specified
        SELECT 
            c.x,
            c.y
        FROM 
            environment.cells AS c 
            LEFT JOIN environment.entity_components AS pc 
              ON (c.x, c.y) = (FLOOR(pc.x), FLOOR(pc.y))
            -- CROSS JOIN environment.entity_components AS others
        WHERE
            --others.category != 'item'                          -- don't calculate distance to items
            c.passable                                     -- only passable cells
            AND (pc.entity_id IS NULL OR pc.category = 'item') -- look for a cell that is empty or only has an item in it
        --GROUP BY 
        --    c.x, c.y
        --ORDER BY 
        --    SUM(POINT(c.x, c.y) <-> POINT(others.x, others.y)) * RANDOM() DESC -- try to get a position that is far away from existing entities, but also factor in randomness
        ORDER BY 
            RANDOM()
        LIMIT 1
    ),
    new_entity(eid) AS (
        INSERT INTO environment.entities(type) VALUES ('entity') RETURNING id
    ),
    pc AS (
        INSERT INTO environment.position_components(entity_id, x, y, z) (VALUES ((SELECT eid FROM new_entity), (SELECT COALESCE(_x, rand_x) FROM random_position), (SELECT COALESCE(_y, rand_y) FROM random_position), _z))
    ),
    mc AS (
        INSERT INTO environment.movement_components(entity_id, ẟx, ẟy, speed) (VALUES ((SELECT eid FROM new_entity), _ẟx, _ẟy, _speed))
    ),
    tc AS (
        INSERT INTO environment.type_components(entity_id, type_id) (VALUES ((SELECT eid FROM new_entity), (SELECT id FROM environment.entity_types WHERE name = _type)))
    ),
    cc AS (
        INSERT INTO environment.controller_components(entity_id, controller) (VALUES ((SELECT eid FROM new_entity), _controller))
    ),
    ext AS (
        INSERT INTO environment.extent_components(entity_id, width, height) (VALUES ((SELECT eid FROM new_entity), _width, _height))
    ),
    col AS (
        INSERT INTO environment.colour_components(entity_id, red, green, blue) (VALUES ((SELECT eid FROM new_entity), _red, _green, _blue))
    ),
    score AS (
        INSERT INTO environment.score_components(entity_id, score) (VALUES ((SELECT eid FROM new_entity), 0))
    )
    SELECT eid FROM new_entity    
$$ LANGUAGE sql;--


CREATE FUNCTION environment.create_player(_x INT, _y INT, _controller TEXT)
RETURNS INT AS $$
    SELECT environment.create_entity('pacman', _x, _y, 1, 0.5, 0.5, 0, 0, 0.04, _controller, (random() * 255)::INT, (random() * 255)::INT, (random() * 255)::INT) AS id
$$ LANGUAGE sql;--


-- stub
-- CREATE SCHEMA IF NOT EXISTS dfa;
-- CREATE OR REPLACE FUNCTION dfa.setup_entity(_eid INT, _dfaname TEXT) RETURNS VOID AS $$ SELECT 1 $$ LANGUAGE sql;--

CREATE FUNCTION environment.create_ghost(_x INT, _y INT, _r INT, _g INT, _b INT, _dfa TEXT)
RETURNS INT AS $$
    WITH 
    entity(id) AS (SELECT environment.create_entity('ghost', _x, _y, 1, 0.5, 0.5, 0, 0, 0.03, 'ai', _r, _g, _b)),
    dfa_setup(id) AS (SELECT dfa.setup_entity(entity.id, _dfa) FROM entity)
    SELECT entity.id FROM entity CROSS JOIN dfa_setup
$$ LANGUAGE sql;--


CREATE FUNCTION environment.create_pellet(_x INT, _y INT)
RETURNS INT AS $$
    SELECT environment.create_entity('pellet', _x, _y, 0, 0.3, 0.3, 0, 0, 0.00, 'none', 255, 255, 255) AS id
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


CREATE TABLE environment.collision_handlers(
    id    SERIAL PRIMARY KEY,
    type1 INT,
    type2 INT,
    fname TEXT
);

CREATE FUNCTION environment.coll_ghost_pacman(_eid1 INT, _eid2 INT)
RETURNS VOID AS $$
    UPDATE environment.position_components SET 
        x = -42
    WHERE -- this one actually triggers
        entity_id = _eid2
$$ LANGUAGE sql;--

CREATE FUNCTION environment.coll_pacman_ghost(_eid1 INT, _eid2 INT)
RETURNS VOID AS $$
    UPDATE environment.position_components SET 
        x = -100,
        y = -100
    WHERE 
        entity_id = _eid1
$$ LANGUAGE sql;--

CREATE FUNCTION environment.coll_pacman_pacman(_eid1 INT, _eid2 INT)
RETURNS VOID AS $$
    UPDATE environment.movement_components SET 
        ẟx = ẟx * -1,
        ẟy = ẟy * -1
    WHERE 
        entity_id IN (_eid1, _eid2)
$$ LANGUAGE sql;--

CREATE FUNCTION environment.coll_pacman_pellet(_eid1 INT, _eid2 INT)
RETURNS VOID AS $$
    UPDATE environment.position_components SET 
        x = -10,
        y = -10
    WHERE 
        entity_id = _eid2
    ;
    UPDATE environment.score_components SET 
        score = score + 1 
    WHERE 
        entity_id = _eid1
$$ LANGUAGE sql;--

CREATE FUNCTION environment.dispatch_collision_handler(_eid1 INT, _type1 TEXT, _eid2 INT, _type2 TEXT)
RETURNS VOID AS $$
    SELECT
        -- eid1 and eid2 are lexicographically ordered on their type names.
        -- So dispatchers always need to have their name arranged in that way too.
        CASE _type1 || '_' || _type2
        WHEN 'ghost_pacman' THEN environment.coll_ghost_pacman(_eid1, _eid2)
        WHEN 'pacman_pacman' THEN environment.coll_pacman_pacman(_eid1, _eid2)
        WHEN 'pacman_pellet' THEN environment.coll_pacman_pellet(_eid1, _eid2)
        END
$$ LANGUAGE sql STABLE;--

-- this function conveniently handles all open collisions
CREATE FUNCTION environment.handle_collisions()
RETURNS VOID AS $$
    SELECT environment.dispatch_collision_handler(eid1, type1, eid2, type2) FROM environment.collisions
$$ LANGUAGE sql;--

;

-- SELECT environment.create_map(11, 10);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (1,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (2,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (4,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (6,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (8,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (9,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,0);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,1);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,1);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,1);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,2);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (2,2);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,2);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,2);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,2);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (8,2);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,2);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,3);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,3);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,3);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,3);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,3);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,4);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (1,4);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (9,4);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,4);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,5);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (1,5);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,5);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (4,5);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (6,5);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,5);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (9,5);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,5);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,6);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,6);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,7);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (2,7);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (4,7);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,7);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (6,7);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (8,7);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,7);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,8);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,8);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (0,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (1,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (2,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (3,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (4,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (5,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (6,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (7,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (8,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (9,9);-------------
-- UPDATE environment.cells SET passable = FALSE WHERE (x,y) = (10,9);-------------

-- SELECT * FROM environment.compound_walls order by component_id,x,y;

-- select * from environment.wall_shapes;