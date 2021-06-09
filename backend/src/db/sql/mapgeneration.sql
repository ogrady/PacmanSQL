-- note to self: you can use modifying statements in WR by encapsulating them in a UDF and SELECTing from them
DROP SCHEMA IF EXISTS mapgen CASCADE;
CREATE SCHEMA mapgen;

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
    CHECK (x IN (1,2,3)),
    CHECK (y IN (1,2,3))
);--


--CREATE TABLE mapgen.map(
--    x INT,
--    y INT
--);--

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
    SELECT x,y FROM (VALUES (1,0), (0,1), (-1,0), (0,-1)) AS xs(x,y)
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
            (null, 1, '↑', '↓', POINT(0, -1)), (null, 3, '↓', '↑', POINT(0, 1)),
            (1, null, '←', '→', POINT(-1, 0)), (3, null, '→', '←', POINT(1, 0))
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


CREATE VIEW mapgen.map AS (
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
        string_agg(t, '' ORDER BY x)
    FROM 
        tiles
    GROUP BY 
        y
);--


----- TESTING
INSERT INTO mapgen.tiles(value) (VALUES
    ('□'), ('■')
);

insert into mapgen.compatible_tiles(this_id, that_id, frequency) (values
    (1, 1, 1), -- □ - □
    (2, 2, 1)  -- ☒ - ☒
);

INSERT INTO mapgen.modules(id) (VALUES
    (1), (2), (3), (4), (5), (6), (7)
);

INSERT INTO mapgen.module_contents(module_id, x, y, tile_id) (VALUES 
    (1, 1, 1, 2), (1, 2, 1, 1), (1, 3, 1, 2), -- vertical corridor
    (1, 1, 2, 2), (1, 2, 2, 1), (1, 3, 2, 2),
    (1, 1, 3, 2), (1, 2, 3, 1), (1, 3, 3, 2),

    (2, 1, 1, 2), (2, 2, 1, 2), (2, 3, 1, 2), -- horizontal corridor
    (2, 1, 2, 1), (2, 2, 2, 1), (2, 3, 2, 1),
    (2, 1, 3, 2), (2, 2, 3, 2), (2, 3, 3, 2),

    (3, 1, 1, 2), (3, 2, 1, 2), (3, 3, 1, 2), -- corner ↱
    (3, 1, 2, 2), (3, 2, 2, 1), (3, 3, 2, 1),
    (3, 1, 3, 2), (3, 2, 3, 1), (3, 3, 3, 2),

    (4, 1, 1, 2), (4, 2, 1, 2), (4, 3, 1, 2), -- corner ↰
    (4, 1, 2, 1), (4, 2, 2, 1), (4, 3, 2, 2),
    (4, 1, 3, 2), (4, 2, 3, 1), (4, 3, 3, 2),

    (5, 1, 1, 2), (5, 2, 1, 1), (5, 3, 1, 2), -- corner ↳
    (5, 1, 2, 2), (5, 2, 2, 1), (5, 3, 2, 1),
    (5, 1, 3, 2), (5, 2, 3, 2), (5, 3, 3, 2),

    (6, 1, 1, 2), (6, 2, 1, 1), (6, 3, 1, 2), -- corner ↲
    (6, 1, 2, 1), (6, 2, 2, 1), (6, 3, 2, 2),
    (6, 1, 3, 2), (6, 2, 3, 2), (6, 3, 3, 2),

    (7, 1, 1, 2), (7, 2, 1, 1), (7, 3, 1, 2), -- crossing
    (7, 1, 2, 1), (7, 2, 2, 1), (7, 3, 2, 1),
    (7, 1, 3, 2), (7, 2, 3, 1), (7, 3, 3, 2)
);


insert into mapgen.module_map(x,y,module_id) (VALUES (0,0,3));
insert into mapgen.module_map(x,y,module_id) (VALUES (0,1,1));
insert into mapgen.module_map(x,y,module_id) (VALUES (1,0,7));

REFRESH MATERIALIZED VIEW mapgen.edge_compatibility;

----- FUNCTEST

CREATE FUNCTION mapgen.generate_module() 
RETURNS VOID AS $$
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
            neighbours_count = 2
        ORDER BY 
            POINT(fm.empty_x + 0.5, fm.empty_y + 0.5) <-> POINT(fm.neighbour_centroid[0] + me.offs[0]/2, fm.neighbour_centroid[1] + me.offs[1]/2)
        LIMIT 
            2
    ),
    candidates(empty_x, empty_y, module_id) AS (
        SELECT
            MAX(empty_x), -- THE
            MAX(empty_y), -- THE
            this_module_id
        FROM 
            gap AS p
            JOIN mapgen.edge_compatibility AS ec 
              ON (p.neighbour_module_id, p.neighbour_facing) = (ec.that_module_id, ec.that_facing)
        GROUP BY 
            this_module_id
        ORDER BY 
            COUNT(*) DESC, SUM(frequency) * RANDOM() -- module with most matching edges (whould be 2 for, say ▛, and 1 for ▌ et al.), and then among those randomly with weight towards higher frequencies
        LIMIT 
            1
    )
    SELECT * FROM candidates
    ;
$$ LANGUAGE sql;--


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
            neighbours_count = 2
        ORDER BY 
            POINT(fm.empty_x + 0.5, fm.empty_y + 0.5) <-> POINT(fm.neighbour_centroid[0] + me.offs[0]/2, fm.neighbour_centroid[1] + me.offs[1]/2)
        LIMIT 
            2
    ),
    candidates AS (
        SELECT
            MAX(empty_x) as empty_x, -- THE
            MAX(empty_y) as empty_y, -- THE
            this_module_id as module_id,
            count(*)
        FROM 
            gap AS p
            JOIN mapgen.edge_compatibility AS ec 
              ON (p.neighbour_module_id, p.neighbour_facing) = (ec.that_module_id, ec.that_facing)
        GROUP BY 
            this_module_id
        ORDER BY 
            COUNT(*) DESC, SUM(frequency) * RANDOM() -- module with most matching edges (whould be 2 for, say ▛, and 1 for ▌ et al.), and then among those randomly with weight towards higher frequencies
    )
    select * from candidates
;

select 'init';
select * from mapgen.module_map;
select 'now generating for first time';
select mapgen.generate_module();
select 'after first generation';
select * from mapgen.module_map;
select mapgen.generate_module();
select * from mapgen.module_map;




SELECT * FROM mapgen.map;