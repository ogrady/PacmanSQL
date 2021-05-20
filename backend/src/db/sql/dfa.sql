DROP SCHEMA IF EXISTS dfa CASCADE;
CREATE SCHEMA dfa;

---------------------------------------------------------------
-- TABLES
---------------------------------------------------------------        
CREATE TABLE dfa.state_buffer(
    entity_id INT, 
    new_state INT
);--


CREATE TABLE dfa.states(
    id           SERIAL PRIMARY KEY,
    name         TEXT,
    UNIQUE(name)
);--


CREATE TABLE dfa.dfa(
    id            SERIAL PRIMARY KEY,
    initial_state INT,
    name          TEXT,
    FOREIGN KEY(initial_state) REFERENCES dfa.states(id)
);--


CREATE TABLE dfa.entity_states(
    entity_id INT, 
    dfa_id INT,
    state_id INT,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id),
    FOREIGN KEY(dfa_id) REFERENCES dfa.dfa(id),
    FOREIGN KEY(state_id) REFERENCES dfa.states(id)
);--


CREATE TABLE dfa.effects(
    id    SERIAL PRIMARY KEY,
    fname TEXT UNIQUE
);--


CREATE TABLE dfa.effect_closures(
    effect_closure_id SERIAL PRIMARY KEY,
    effect_id         INT,
    entity_id         INT,
    tick_id           INT,
    closure           JSON,
    FOREIGN KEY(entity_id) REFERENCES environment.entities(id),
    FOREIGN KEY(effect_id) REFERENCES dfa.effects(id)
);--


CREATE TABLE dfa.conditions(
    id    SERIAL PRIMARY KEY,
    fname TEXT UNIQUE
);--


CREATE TABLE dfa.condition_closures(
    condition_id          INT,
    entity_id             INT,
    closure               JSON,
    FOREIGN KEY(entity_id)    REFERENCES environment.entities(id),
    FOREIGN KEY(condition_id) REFERENCES dfa.conditions(id)
);--


CREATE TABLE dfa.edges(
    id            SERIAL PRIMARY KEY,
    dfa_id        INT NOT NULL,
    current_state INT NOT NULL,
    condition_id  INT,
    effect_id     INT,
    next_state    INT NOT NULL,
    weight        INT NOT NULL DEFAULT 1,
    FOREIGN KEY(dfa_id) REFERENCES dfa.dfa(id),
    FOREIGN KEY(current_state) REFERENCES dfa.states(id),
    FOREIGN KEY(condition_id) REFERENCES dfa.conditions(id),
    FOREIGN KEY(effect_id) REFERENCES dfa.effects(id),
    FOREIGN KEY(next_state) REFERENCES dfa.states(id),
    UNIQUE(current_state, condition_id) -- no ndfa
);--

---------------------------------------------------------------
-- FUNCTIONS
---------------------------------------------------------------
CREATE VIEW dfa.overview AS (
    SELECT
        ec.*,
        es.dfa_id        AS dfa_id,
        start.name       AS current_state,
        destination.name AS next_state,
        c.fname          AS condition_function,
        eff.fname        AS effect_function ,
        e.weight         AS weight
    FROM 
        dfa.entity_states AS es
        JOIN environment.entity_components AS ec
          ON es.entity_id = ec.entity_id
        JOIN dfa.states AS start
          ON es.state_id = start.id
        JOIN dfa.edges AS e
          ON e.current_state = start.id
        JOIN dfa.states AS destination
          ON e.next_state = destination.id
        JOIN dfa.conditions AS c
          ON e.condition_id = c.id
        LEFT JOIN dfa.effects AS eff
          ON e.effect_id = eff.id
    ORDER BY 
        es.entity_id, weight DESC
);--

---------------------------------------------------------------
-- FUNCTIONS
---------------------------------------------------------------
CREATE FUNCTION dfa.setup_entity(_eid INT, _dfaname TEXT) --_dfaid INT)
RETURNS VOID AS $$
    INSERT INTO dfa.entity_states(entity_id, dfa_id, state_id) VALUES(
        _eid,
        (SELECT id FROM dfa.dfa AS dfa WHERE dfa.name = _dfaname),--_dfaid,
        (SELECT initial_state FROM dfa.dfa AS dfa WHERE dfa.name = _dfaname) --WHERE id = _dfaid)
    );
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.create_dfa()
RETURNS VOID AS $$
    SELECT 1; 
$$ LANGUAGE sql;--


-- conditions
CREATE FUNCTION dfa.cond_true(_eid INT)
RETURNS BOOLEAN AS $$
    SELECT TRUE;
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.cond_path_ready(_eid INT)
RETURNS BOOLEAN AS $$
    SELECT COUNT(*) > 0 FROM pathfinding.complete_paths WHERE entity_id = _eid
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.cond_has_no_path(_eid INT)
RETURNS BOOLEAN AS $$
    SELECT COUNT(*) = 0 FROM pathfinding.complete_paths WHERE entity_id = _eid
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.cond_movement_is_blocked(_eid INT)
RETURNS BOOLEAN AS $$
    SELECT
        COUNT(*) > 0
        --NOT (COALESCE (c.passable, TRUE))
    FROM 
        environment.entity_components AS ec
        JOIN environment.cells AS c
          --ON c.x BETWEEN ec.x AND ec.x + ec.width OR
          --   c.y BETWEEN ec.y AND ec.y + ec.height
          ON ROUND(ec.x + ec.ẟx + 0.0) = c.x AND 
             ROUND(ec.y + ec.ẟy + 0.0) = c.y
    WHERE 
        ec.entity_id = _eid
        AND NOT c.passable
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.cond_pacman_present(_eid INT)
RETURNS BOOLEAN AS $$
    SELECT COUNT(*) > 0 FROM environment.entity_components WHERE type = 'pacman'
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.dispatch_condition(_eid INT, _fname TEXT)
RETURNS BOOLEAN AS $$
    SELECT FALSE; -- stub. Is replaced through JavaScript code generation when importing the DFA from gviz
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.normalise(_ẟ FLOAT) 
RETURNS FLOAT AS $$
    SELECT CASE _ẟ 
        WHEN 0 THEN 0.0
        ELSE _ẟ / ABS(_ẟ)
    END
$$ LANGUAGE sql;--

-- effects
CREATE FUNCTION dfa.eff_turn_90_degrees_cw(_eid INT)
RETURNS VOID AS $$
    WITH turns(x, y, new_x, new_y) AS (
        (VALUES 
            ( 1, 0, 0, 1), -- → ↓
            ( 0, 1,-1, 0), -- ↓ ←
            (-1, 0, 0,-1), -- ← ^
            ( 0,-1, 1, 0)  -- ^ →
        )
    )
    UPDATE environment.movement_components AS upd
    SET 
        ẟx = turns.new_x * ABS(mc.ẟy), -- x and y are switched on purpose here
        ẟy = turns.new_y * ABS(mc.ẟx)  -- as the delta from one axis gets carried over to the other axis upon turning by 90°
    FROM 
        environment.movement_components AS mc 
        JOIN turns 
          ON mc.entity_id = _eid AND (dfa.normalise(mc.ẟx), dfa.normalise(mc.ẟy)) = (turns.x, turns.y)
    WHERE
        upd.entity_id = _eid
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.eff_follow_path(_eid INT)
RETURNS VOID AS $$
    SELECT environment.start_towards(_eid, (SELECT POINT(position_x, position_y) FROM pathfinding.complete_paths WHERE entity_id = _eid ORDER BY steps ASC LIMIT 1));
    --UPDATE environment.position_components 
    --SET 
    --    x = new.position_x, 
    --    y = new.position_y
    --FROM 
    --    (SELECT position_x, position_y FROM pathfinding.complete_paths WHERE entity_id = _eid ORDER BY steps ASC LIMIT 1) AS new
    --WHERE
    --    entity_id = _eid
    --;

    -- each entity will only pass each cell once per path (or it would not be the shortest path)
    -- that means, if an entity sits on a cell that is part of its path, that most be the topmost one (so we can drop `ORDER BY steps ASC LIMIT 1`)
    -- ergo, we can delete all such cells from all open paths, causing the entities to go for the next cell upon the next call of eff_follow_path.
    DELETE FROM 
        pathfinding.complete_paths AS cp
    USING 
        environment.position_components AS pc
    WHERE 
        (cp.entity_id, cp.position_x, cp.position_y) = (pc.entity_id, pc.x, pc.y)
        -- id = (SELECT id FROM pathfinding.complete_paths WHERE entity_id = _eid ORDER BY steps ASC LIMIT 1)
    ;
    -- idea: set deltas to next point. 
    -- DELETE FROM 
    --     pathfinding.complete_path
    -- WHERE 
    --     entity_id = _eid
    --     AND -- position is same
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.eff_pathsearch_nearest(_eid INT)
RETURNS VOID AS $$
    WITH nearest(entity_id) AS (
        SELECT
            them.entity_id
        FROM 
            environment.entity_components AS me,
            environment.entity_components AS them
        WHERE 
            me.entity_id = _eid
            AND them.type = 'pacman'
        ORDER BY 
            ABS(me.x - them.x) + ABS(me.y - them.y)
        LIMIT 1
    )
    SELECT pathfinding.init_entity_to_entity_search(
                _eid, 
                (SELECT entity_id FROM nearest)
                --(SELECT id FROM environment.entities WHERE id != _eid) -- FIXME: actually look for nearest pacman
    );
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.dispatch_effect(_eid INT, _fname TEXT)
RETURNS VOID AS $$
    SELECT 1; -- stub, replaced by JavaScript code generation when importing the DFA from gviz
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.tick()
RETURNS VOID AS $$
    WITH new_states(entity_id, new_state, effect_name) AS (
        SELECT DISTINCT ON (s.entity_id)
            s.entity_id, 
            e.next_state,
            dfa.dispatch_effect(s.entity_id, ef.fname)
        FROM 
            dfa.entity_states AS s 
            JOIN dfa.edges AS e
              ON (s.dfa_id, s.state_id) = (e.dfa_id, e.current_state)
            JOIN dfa.conditions AS c 
              ON e.condition_id = c.id
            LEFT JOIN dfa.effects AS ef -- effects can be NULL!
              ON e.effect_id = ef.id
        WHERE 
            dfa.dispatch_condition(s.entity_id, c.fname)
        ORDER BY 
            s.entity_id, e.weight DESC
    )
    --SELECT entity_id, new_state, effect_name FROM new_states
    INSERT INTO dfa.state_buffer(entity_id, new_state) 
        SELECT entity_id, new_state FROM new_states
    ;

    UPDATE dfa.entity_states AS current SET 
        state_id = buffer.new_state
    FROM 
        dfa.state_buffer AS buffer
    WHERE 
        current.entity_id = buffer.entity_id
    ;

    DELETE FROM dfa.state_buffer;
$$ LANGUAGE sql;--
