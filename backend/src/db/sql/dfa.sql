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
CREATE FUNCTION dfa.setup_entity(_eid INT, _dfaid INT)
RETURNS VOID AS $$
    INSERT INTO dfa.entity_states(entity_id, dfa_id, state_id) VALUES(
        _eid,
        _dfaid,
        (SELECT initial_state FROM dfa.dfa WHERE id = _dfaid)
    );
$$ LANGUAGE sql;--


CREATE FUNCTION dfa.create_dfa()
RETURNS VOID AS $$
    SELECT 1;
    --INSERT INTO dfa.conditions(fname) (VALUES 
    --    ('cond_true'),
    --    ('cond_path_available'),   -- 2, still path left
    --    ('cond_idle')              -- 3, no path left
    --);
--
    --INSERT INTO dfa.effects(fname) (VALUES 
    --    ('eff_move_next_cell'),    -- 1
    --    ('eff_pathsearch_nearest') -- 2
    --);
--
    --INSERT INTO dfa.states(name) (VALUES 
    --    ('chasing'),   -- 1, following path
    --    ('searching'), -- 2, waiting for path search to complete
    --    ('thinking')   -- 3, starting path search to next target
    --);
--
    --INSERT INTO dfa.dfa(name, initial_state) (VALUES 
    --    ('stupid ghost', 1)     
    --);
--
    --INSERT INTO dfa.edges(
    --    dfa_id, current_state, condition_id, effect_id, next_state, weight) (VALUES
    --    (1,     3,             1,            2,         2,          10), -- in idle, initialise path search
    --    (1,     2,             2,            null,      1,          10), -- in searching state if path is ready, start chasing
    --    (1,     1,             3,            null,      3,          10), -- in chasing, if path is done go back to thinking
    --    (1,     1,             2,            1,         1,          10)  -- in chasing, if path is available, follow path
    --);    
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
        NOT (COALESCE (c.passable, TRUE))
    FROM 
        environment.entity_components AS ec
        JOIN environment.cells AS c
          ON ROUND(ec.x + ec.ẟx + 0.0) = c.x AND 
             ROUND(ec.y + ec.ẟy + 0.0) = c.y
    WHERE 
        ec.entity_id = _eid
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
    UPDATE environment.position_components 
    SET 
        x = new.position_x, 
        y = new.position_y
    FROM 
        (SELECT position_x, position_y FROM pathfinding.complete_paths WHERE entity_id = _eid ORDER BY steps ASC LIMIT 1) AS new
    WHERE
        entity_id = _eid
    ;

    DELETE FROM 
        pathfinding.complete_paths
    WHERE 
        id = (SELECT id FROM pathfinding.complete_paths WHERE entity_id = _eid ORDER BY steps ASC LIMIT 1)
    ;
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
