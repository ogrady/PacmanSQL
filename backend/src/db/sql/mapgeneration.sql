-- note to self: you can use modifying statements in WR by encapsulating them in a UDF and SELECTing from them
DROP SCHEMA IF EXISTS mapgen CASCADE;
CREATE SCHEMA mapgen;


CREATE OR REPLACE FUNCTION the_func(acc anyelement, x anyelement) RETURNS anyelement AS $$
BEGIN
    IF acc <> x THEN 
        RAISE EXCEPTION 'THE used on an inconsistent list. Expected consistent %, but the list also contained %.', acc, x ;
    END IF;
    RETURN x;
    -- STRICT ignores null values
END $$ LANGUAGE PLPGSQL STRICT;-- 

CREATE OR REPLACE AGGREGATE the(anyelement)
(
    sfunc = the_func,
    stype = anyelement
);--


CREATE TABLE mapgen.tiles(
    id    SERIAL PRIMARY KEY,
    value TEXT
);--


CREATE TABLE mapgen.compatible_tiles(
    id SERIAL PRIMARY KEY,
    this_id INT,
    that_id INT,
    frequency INT DEFAULT 1,
    FOREIGN KEY(this_id) REFERENCES mapgen.tiles(id),
    FOREIGN KEY(that_id) REFERENCES mapgen.tiles(id)
);--


CREATE TABLE mapgen.modules(
    id SERIAL PRIMARY KEY
);--


CREATE TABLE mapgen.module_contents(
    id        SERIAL PRIMARY KEY,
    module_id INT,
    x         INT,
    y         INT,
    tile_id   INT,
    FOREIGN KEY(module_id) REFERENCES mapgen.modules(id),
    FOREIGN KEY(tile_id) REFERENCES mapgen.tiles(id),
    UNIQUE(module_id,x,y),
    CHECK (x IN (0,1,2)),
    CHECK (y IN (0,1,2))
);--


CREATE TABLE mapgen.map(
    x INT,
    y INT,
    tile_id INT,
    FOREIGN KEY(tile_id) REFERENCES mapgen.tiles(id)
);--

CREATE TABLE mapgen.module_map(
    id SERIAL PRIMARY KEY,
    x INT,
    y INT,
    centroid POINT GENERATED ALWAYS AS (POINT(x + 0.5, y + 0.5)) STORED,
    module_id INT,
    FOREIGN KEY(module_id) REFERENCES mapgen.modules(id),
    UNIQUE(x,y)
);--


CREATE VIEW mapgen.neighbour_offsets(x, y) AS (
    SELECT x,y FROM (VALUES (1,0), (0,1), (-1,0), (0,-1)) AS xs(x,y) -- this had ", (-1,0), (0,-1)"" before as well, but since we are only expanding downwards and right, they are not needed and, in fact, caused bugs with neighbours that were counted twice, due to the negative offset
);--


CREATE VIEW mapgen.neighbour_modules(this_id, this_x, this_y, neighbour_id, neighbour_x, neighbour_y) AS (
    SELECT 
        this.id,
        this.x,
        this.y,
        that.id,
        that.x,
        that.y
    FROM 
        mapgen.module_map AS this 
        JOIN mapgen.module_map AS that
          ON (ABS(this.x - that.x), ABS(this.y - that.y)) IN (SELECT x, y FROM mapgen.neighbour_offsets)
);--


-- coordinates in the module-grid that are empty (empty_x, empty_y) that border directly with 
-- at least one existing module (Van Neumann neighbourhood)
CREATE VIEW mapgen.free_modules(empty_x, empty_y, neighbour_module_id, neighbour_x, neighbour_y, neighbour_centroid, neighbours_count) AS (
    SELECT 
        this.x + off.x,
        this.y + off.y,
        this.module_id,
        this.x,
        this.y,
        this.centroid,
        COUNT(*) OVER (PARTITION BY (this.x + off.x, this.y + off.y))
    FROM 
        mapgen.neighbour_offsets AS off
        CROSS JOIN mapgen.module_map AS this
        LEFT JOIN mapgen.module_map AS that
          ON (this.x + off.x, this.y + off.y) = (that.x, that.y)
    WHERE
        that.id IS NULL
);--

CREATE VIEW mapgen.module_edges AS (
    WITH contents AS (
        SELECT
            mc.*,
            t.value
        FROM 
            mapgen.modules AS mod
            JOIN mapgen.module_contents AS mc 
              ON mod.id = mc.module_id
            JOIN mapgen.tiles AS t 
              ON mc.tile_id = t.id
    ),
    horizontal(module_id, x, y, edge_ids, edge) AS (
        SELECT
            contents.module_id, 
            contents.x,
            null::int,
            array_agg(contents.tile_id),
            array_agg(contents.value)
        FROM 
            contents
        GROUP BY 
            contents.module_id, contents.x
    ),
    vertical(module_id, x, y, edge_ids, edge) AS (
        SELECT
            contents.module_id, 
            null::int,
            contents.y,
            array_agg(contents.tile_id),
            array_agg(contents.value)
        FROM 
            contents
        GROUP BY 
            contents.module_id, contents.y
    ),
    directions(x, y, facing, required, offs) AS ( 
        (VALUES
            (null, 0, '↑', '↓', POINT(0, -1)), (null, 2, '↓', '↑', POINT(0, 1)),
            (0, null, '←', '→', POINT(-1, 0)), (2, null, '→', '←', POINT(1, 0))
        )
    ),
    edges AS (
        SELECT * FROM horizontal UNION ALL SELECT * FROM vertical
    )
    SELECT 
        e.module_id,
        e.edge_ids,
        e.edge,
        d.facing,
        d.required,
        d.offs
    FROM 
        edges AS e
        JOIN directions AS d
          ON e.x = d.x OR e.y = d.y -- remove the center "edges"
    ORDER BY e.module_id, e.x, e.y
);--


CREATE MATERIALIZED VIEW mapgen.edge_compatibility(this_module_id, this_edge_ids, this_edge, this_facing, this_required, this_offs, that_module_id, that_edge_ids, that_edge, that_facing, that_required, that_offs, frequency) AS (
    WITH 
    compatible_edges(this_edge_ids, that_edge_ids, frequency) AS (
        SELECT
            ARRAY[t1.this_id, t2.this_id, t3.this_id] AS this_edge_ids,
            ARRAY[t1.that_id, t2.that_id, t3.that_id] AS that_edge_ids,
            t1.frequency + t2.frequency + t3.frequency AS frequency
        FROM 
            mapgen.compatible_tiles AS t1 
            CROSS JOIN mapgen.compatible_tiles AS t2 
            CROSS JOIN mapgen.compatible_tiles AS t3 
    ),
    bidrectional(this_edge_ids, that_edge_ids, frequency) AS (
        SELECT
            this_edge_ids,
            that_edge_ids,
            frequency
        FROM 
            compatible_edges
        UNION
        SELECT
            that_edge_ids,
            this_edge_ids,
            frequency
        FROM 
            compatible_edges
    )
    SELECT DISTINCT ON (this_module_id, this_facing, that_module_id, that_facing)
        this_edges.module_id AS this_module_id,
        ce.this_edge_ids     AS this_edge_ids,
        this_edges.edge      AS this_edge,
        this_edges.facing    AS this_facing,
        this_edges.required  AS this_required,
        this_edges.offs      AS this_offs,

        that_edges.module_id AS that_module_id,
        ce.that_edge_ids     AS that_edge_ids,
        that_edges.edge      AS that_edge,       
        that_edges.facing    AS that_facing,
        that_edges.required  AS that_required,
        that_edges.offs      AS that_offs,
        ce.frequency         AS frequency
    FROM 
        bidrectional AS ce
        JOIN mapgen.module_edges AS this_edges
          ON ce.this_edge_ids = this_edges.edge_ids
        JOIN mapgen.module_edges AS that_edges
          ON ce.that_edge_ids = that_edges.edge_ids
    WHERE
        this_edges.facing = that_edges.required
);--


CREATE VIEW mapgen.module_map_pretty AS (
    WITH tiles(x, y, t) AS (
        SELECT
            mm.x * 3 + mc.x,
            mm.y * 3 + mc.y,
            t.value
        FROM 
            mapgen.module_map AS mm 
            JOIN mapgen.module_contents AS mc 
              ON mm.module_id = mc.module_id 
            JOIN mapgen.tiles AS t 
              ON mc.tile_id = t.id
    )
    SELECT 
        string_agg(t, ' ' ORDER BY x)
    FROM 
        tiles
    GROUP BY 
        y
);--

CREATE VIEW mapgen.map_pretty AS (
    WITH tiles(x, y, t) AS (
        SELECT
            m.x,
            m.y,
            t.value
        FROM 
            mapgen.map AS m 
            JOIN mapgen.tiles AS t 
              ON m.tile_id = t.id
    )
    SELECT 
        string_agg(t, ' ' ORDER BY x)
    FROM 
        tiles
    GROUP BY 
        y
);--

-- generates one module. 
-- If _pos is specified, a module will be generated at that position. 
-- If _pos is NULL, a position with two neighbours will be selected to generate a module at.
CREATE FUNCTION mapgen.generate_module(_pos POINT) 
RETURNS INT AS $$
    INSERT INTO mapgen.module_map(x, y, module_id) 
    WITH 
    gap(empty_x, empty_y, neighbour_module_id, neighbour_edge, neighbour_facing, neighbour_required) AS (
        SELECT 
            fm.empty_x,
            fm.empty_y,
            fm.neighbour_module_id,
            me.edge,
            me.facing,
            me.required
        FROM 
            mapgen.free_modules AS fm
            LEFT JOIN mapgen.module_edges AS me 
              ON fm.neighbour_module_id = me.module_id
        WHERE
            (_pos IS NOT NULL AND _pos ~= POINT(fm.empty_x, fm.empty_y)) -- ~= is the "same as" operator that is defined on geometric types
            OR neighbours_count = 2
        ORDER BY 
            POINT(fm.empty_x + 0.5, fm.empty_y + 0.5) <-> POINT(fm.neighbour_centroid[0] + me.offs[0]/2, fm.neighbour_centroid[1] + me.offs[1]/2)
        LIMIT 
            2
    ),
    candidates(empty_x, empty_y, module_id) AS (
        SELECT
            p.empty_x,
            p.empty_y,
            ec.this_module_id
        FROM 
            gap AS p
            JOIN mapgen.edge_compatibility AS ec 
              ON (p.neighbour_module_id, p.neighbour_facing) = (ec.that_module_id, ec.that_facing)
        GROUP BY 
            empty_x, empty_y, this_module_id
        ORDER BY 
            COUNT(*) DESC, SUM(frequency) * RANDOM() -- module with most matching edges (whould be 2 for, say ▛, and 1 for ▌ et al.), and then among those randomly with weight towards higher frequencies
        LIMIT 
            1
    )
    SELECT * FROM candidates RETURNING module_id
$$ LANGUAGE sql;--


-- expands the map by one row and one column of modules
CREATE FUNCTION mapgen.expand_map() 
RETURNS INT AS $$
    WITH modules(mid) AS (
        SELECT mapgen.generate_module(POINT(MAX(x) + 1, 0)) FROM mapgen.module_map AS mm -- expand to the right...
        UNION ALL
        SELECT mapgen.generate_module(POINT(0, MAX(y) + 1)) FROM mapgen.module_map AS mm -- ...and down
        UNION ALL
        (
            WITH RECURSIVE generate AS (
                SELECT mapgen.generate_module(NULL)
                UNION -- RETURNING apparently produces empty rows (???) instead of no result when nothing is inserted, so we need UNION instead of UNION ALL to stop when TWO empty rows have been returned...
                SELECT mapgen.generate_module(NULL) FROM generate
            )
            SELECT * FROM generate
        )
    ) SELECT COUNT(*) FROM modules
$$ LANGUAGE sql;--

-- creates a quadractic map of size _size x _size (counted in modules, not tiles)
CREATE FUNCTION mapgen.generate_module_map(_size INT) 
RETURNS TABLE(mid INT, r INT) AS $$
    WITH RECURSIVE progress(mid, remaining) AS (
        SELECT mapgen.expand_map(), _size 
        UNION ALL
        SELECT mapgen.expand_map(), progress.remaining - 1 FROM progress WHERE progress.remaining > 0
    )
    SELECT mid, remaining FROM progress
$$ LANGUAGE sql;--

-- generates an actual map that consists of triples of (x,y,t) where t is the ID of a tile
CREATE FUNCTION mapgen.generate_map(_size INT)
RETURNS VOID AS $$
    DELETE FROM mapgen.module_map;
    --INSERT INTO mapgen.module_map(x,y,module_id) (VALUES (0,0,3)); -- SEED
    INSERT INTO mapgen.module_map(x,y,module_id) (VALUES (0,0,(SELECT id FROM mapgen.modules ORDER BY RANDOM() LIMIT 1))); -- SEED
    SELECT mapgen.generate_module_map(_size);

    INSERT INTO mapgen.map(x, y, tile_id)
    WITH tiles(x, y, tile_id, priority) AS (
        SELECT 
            mm.x * 3 + mc.x + 1 AS x,
            mm.y * 3 + mc.y + 1 AS y,
            mc.tile_id,
            1
        FROM 
            mapgen.module_map AS mm 
            JOIN mapgen.module_contents AS mc
                ON mc.module_id = mm.module_id
        UNION ALL
        SELECT 
            w.x,
            h.y,
            3,
            2 -- priority. Whatever is already taken up by the actual tiles has high priority (1), map borders are only considered if nothing else takes up that space
        FROM 
            generate_series(0, (SELECT MAX(x) * 3 + 4 FROM mapgen.module_map)) AS w(x),
            generate_series(0, (SELECT MAX(y) * 3 + 4 FROM mapgen.module_map)) AS h(y)
    )
    SELECT DISTINCT ON (x,y) 
        x, y, tile_id
    FROM 
        tiles
    ORDER BY 
        x,y,priority
    ;
$$ LANGUAGE sql;--

-- generates a map that is used for playing Pacman where tiles don't
-- have a tile id but are either passable or unpassable
CREATE FUNCTION mapgen.generate_pacman_map(_size INT)
RETURNS VOID AS $$
    SELECT mapgen.generate_map(_size);
    DELETE FROM environment.cells;
    INSERT INTO environment.cells(x, y, passable)
        SELECT 
            x,
            y,
            tile_id = 1
        FROM 
            mapgen.map
    ;
    SELECT environment.populate_with_pellets();
    -- 


$$ LANGUAGE sql;--

----- TESTING
INSERT INTO mapgen.tiles(value) (VALUES
    ('□'), ('■'), ('■')
);

insert into mapgen.compatible_tiles(this_id, that_id, frequency) (values
    (1, 1, 1), -- □ - □
    (2, 2, 1)  -- ☒ - ☒
);

-- INSERT INTO mapgen.modules(id) SELECT x FROM generate_series(1, 16) AS xs(x);
-- 
-- INSERT INTO mapgen.module_contents(module_id, x, y, tile_id) (VALUES 
--     ( 1, 0, 0, 2), ( 1, 1, 0, 1), ( 1, 2, 0, 2), -- vertical corridor
--     ( 1, 0, 1, 2), ( 1, 1, 1, 1), ( 1, 2, 1, 2),
--     ( 1, 0, 2, 2), ( 1, 1, 2, 1), ( 1, 2, 2, 2),
--     ( 2, 0, 0, 2), ( 2, 1, 0, 2), ( 2, 2, 0, 2), -- horizontal corridor
--     ( 2, 0, 1, 1), ( 2, 1, 1, 1), ( 2, 2, 1, 1),
--     ( 2, 0, 2, 2), ( 2, 1, 2, 2), ( 2, 2, 2, 2),
--     ( 3, 0, 0, 2), ( 3, 1, 0, 2), ( 3, 2, 0, 2), -- corner ↱
--     ( 3, 0, 1, 2), ( 3, 1, 1, 1), ( 3, 2, 1, 1),
--     ( 3, 0, 2, 2), ( 3, 1, 2, 1), ( 3, 2, 2, 2),
--     ( 4, 0, 0, 2), ( 4, 1, 0, 2), ( 4, 2, 0, 2), -- corner ↰
--     ( 4, 0, 1, 1), ( 4, 1, 1, 1), ( 4, 2, 1, 2),
--     ( 4, 0, 2, 2), ( 4, 1, 2, 1), ( 4, 2, 2, 2),
--     ( 5, 0, 0, 2), ( 5, 1, 0, 1), ( 5, 2, 0, 2), -- corner ↳
--     ( 5, 0, 1, 2), ( 5, 1, 1, 1), ( 5, 2, 1, 1),
--     ( 5, 0, 2, 2), ( 5, 1, 2, 2), ( 5, 2, 2, 2),
--     ( 6, 0, 0, 2), ( 6, 1, 0, 1), ( 6, 2, 0, 2), -- corner ↲
--     ( 6, 0, 1, 1), ( 6, 1, 1, 1), ( 6, 2, 1, 2),
--     ( 6, 0, 2, 2), ( 6, 1, 2, 2), ( 6, 2, 2, 2),
--     ( 7, 0, 0, 2), ( 7, 1, 0, 1), ( 7, 2, 0, 2), -- crossing
--     ( 7, 0, 1, 1), ( 7, 1, 1, 1), ( 7, 2, 1, 1),
--     ( 7, 0, 2, 2), ( 7, 1, 2, 1), ( 7, 2, 2, 2),
--     ( 8, 0, 0, 2), ( 8, 1, 0, 1), ( 8, 2, 0, 2), -- crossing, again
--     ( 8, 0, 1, 1), ( 8, 1, 1, 1), ( 8, 2, 1, 1),
--     ( 8, 0, 2, 2), ( 8, 1, 2, 1), ( 8, 2, 2, 2),
--     ( 9, 0, 0, 2), ( 9, 1, 0, 2), ( 9, 2, 0, 2), -- T
--     ( 9, 0, 1, 1), ( 9, 1, 1, 1), ( 9, 2, 1, 1),
--     ( 9, 0, 2, 2), ( 9, 1, 2, 1), ( 9, 2, 2, 2),
--     (10, 0, 0, 2), (10, 1, 0, 1), (10, 2, 0, 2), -- T up
--     (10, 0, 1, 1), (10, 1, 1, 1), (10, 2, 1, 1),
--     (10, 0, 2, 2), (10, 1, 2, 2), (10, 2, 2, 2),
--     (11, 0, 0, 2), (11, 1, 0, 1), (11, 2, 0, 2), -- T right
--     (11, 0, 1, 2), (11, 1, 1, 1), (11, 2, 1, 1),
--     (11, 0, 2, 2), (11, 1, 2, 1), (11, 2, 2, 2),
--     (12, 0, 0, 2), (12, 1, 0, 1), (12, 2, 0, 2), -- T left
--     (12, 0, 1, 1), (12, 1, 1, 1), (12, 2, 1, 2),
--     (12, 0, 2, 2), (12, 1, 2, 1), (12, 2, 2, 2),
-- 
--     (13, 0, 0, 1), (13, 1, 0, 1), (13, 2, 0, 1), -- ▖ lower left
--     (13, 0, 1, 1), (13, 1, 1, 1), (13, 2, 1, 1),
--     (13, 0, 2, 2), (13, 1, 2, 1), (13, 2, 2, 1),
-- 
--     (14, 0, 0, 1), (14, 1, 0, 1), (14, 2, 0, 2), -- ▝ upper right
--     (14, 0, 1, 1), (14, 1, 1, 1), (14, 2, 1, 1),
--     (14, 0, 2, 1), (14, 1, 2, 1), (14, 2, 2, 1),
-- 
--     (15, 0, 0, 1), (15, 1, 0, 1), (15, 2, 0, 2), -- ▘ upper left
--     (15, 0, 1, 1), (15, 1, 1, 1), (15, 2, 1, 1),
--     (15, 0, 2, 1), (15, 1, 2, 1), (15, 2, 2, 1),
-- 
--     (16, 0, 0, 1), (16, 1, 0, 1), (16, 2, 0, 1), -- ▗ lower right
--     (16, 0, 1, 1), (16, 1, 1, 1), (16, 2, 1, 1),
--     (16, 0, 2, 1), (16, 1, 2, 1), (16, 2, 2, 2)
-- 
-- 
-- );

REFRESH MATERIALIZED VIEW mapgen.edge_compatibility;


--insert into mapgen.module_map(x,y,module_id) (VALUES (0,0,3));
--insert into mapgen.module_map(x,y,module_id) (VALUES (0,1,1));
--insert into mapgen.module_map(x,y,module_id) (VALUES (0,2,5));
--insert into mapgen.module_map(x,y,module_id) (VALUES (1,0,7));



----- FUNCTEST

--select setseed(0.6);

--SELECT mapgen.generate_map(10);
--select * from mapgen.map_pretty;

--select * from mapgen.map_pretty;
--SELECT mapgen.expand_map();
--SELECT * FROM mapgen.map_pretty;
--SELECT mapgen.expand_map();
--SELECT * FROM mapgen.map_pretty;
--SELECT mapgen.expand_map();
--SELECT * FROM mapgen.map_pretty;
--SELECT mapgen.expand_map();
--SELECT * FROM mapgen.map_pretty;
--SELECT mapgen.expand_map();
--SELECT * FROM mapgen.map_pretty;
--SELECT mapgen.expand_map();
--SELECT * FROM mapgen.map_pretty;
--SELECT mapgen.expand_map();
--SELECT * FROM mapgen.map_pretty;

--    select 'right', POINT(MAX(x) + 1, 0) FROM mapgen.module_map;
--   SELECT mapgen.generate_module(POINT(MAX(x) + 1, 0)) FROM mapgen.module_map AS mm; -- expand to the right...
--   select * from mapgen.module_map;
--
--    SELECT * FROM mapgen.map_pretty;   
--    select 'down', POINT(0, MAX(y) + 1) FROM mapgen.module_map ;
--   SELECT mapgen.generate_module(POINT(0, MAX(y) + 1)) FROM mapgen.module_map AS mm; -- ...and down
--   select * from mapgen.module_map;
--
--   SELECT * FROM mapgen.map_pretty;
--   ;
   --     
   -- SELECT mapgen.generate_module(NULL);
   -- SELECT mapgen.generate_module(NULL);



