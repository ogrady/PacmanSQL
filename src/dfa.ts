import * as db from "./database";
import * as fp from "./functools";

export class DFA extends db.DBUnit {
    public constructor(db: any) {
        super(db);

        // this.tables = ["position_components", "movement_components", "cells", "entities"];

        this.run(`
            CREATE TABLE state_buffer(
                entity_id INT, 
                new_state INT
            )`);

        this.run(`
            CREATE TABLE ticks(
                tick_id SERIAL PRIMARY KEY
            )`);

        this.run(`
            CREATE TABLE effects(
                fname     TEXT   
            )`);

        this.run(`
            CREATE TABLE dfa.effect_closures(
                effect_closure_id SERIAL PRIMARY KEY,
                effect_id         INT REFERENCES dfa.effects(effect_id),
                entity_id         INT REFERENCES dfa.actors(actor_id),
                tick_id           INT REFERENCES dfa.ticks(tick_id),
                closure           JSON,
                FOREIGN KEY(entity_id) REFERENCES entities(rowid),
                FOREIGN KEY(effect_id) REFERENCES effect(rowid),
                FOREIGN KEY(tick_id)   REFERENCES tick(rowid)
            )`);

        this.run(`
            CREATE TABLE dfa.conditions(
                fname        TEXT
            )`);

        this.run(`
            CREATE TABLE dfa.condition_closures(
                condition_id         INT REFERENCES dfa.conditions(condition_id),
                entity_id             INT REFERENCES dfa.actors(actor_id),
                closure              JSON,
                FOREIGN KEY(entity_id) REFERENCES entities(rowid),
                FOREIGN KEY(condition_id) REFERENCES condition(rowid),
            )`);

        this.run(`
            CREATE TABLE states(
                name         TEXT,
                UNIQUE(name)
            )`);

        this.run(`
            CREATE TABLE dfa(
                initial_state INT,
                name          TEXT,
                FOREIGN KEY(initial_state) REFERENCES states(rowid)
            )`);

        this.run(`
            CREATE TABLE edges(
                dfa_id        INT,
                current_state INT,
                condition_id  INT,
                effect_id     INT,
                next_state    INT,
                weight        INT,
                FOREIGN KEY dfa_id REFERENCES dfa.dfa(dfa_id),
                FOREIGN KEY current_state REFERENCES dfa.states(state_id),
                FOREIGN KEY condition_id REFERENCES dfa.conditions(condition_id),
                FOREIGN KEY effect_id REFERENCES dfa.effects(effect_id),
                FOREIGN KEY next_state REFERENCES dfa.states(state_id),
                UNIQUE(current_state, condition_id) -- no ndfa
            )`);
    }

    public tick(): void {
        this.run(`TRUNCATE state_buffer`);
        this.run(`
            WITH new_states(entity_id, new_state, effect_result) AS (
                SELECT 
                    s.entity_id, 
                    e.next_state,
                    dfa.dispatch_effect(ef.fname, s.actor_id, '{}'::JSON)
                    ,ROW_NUMBER() OVER (PARTITION BY s.entity_id ORDER BY e.weight DESC)
                FROM 
                    dfa.actor_states AS s 
                    JOIN dfa.edges AS e
                      ON (s.dfa_id, s.state_id) = (e.dfa_id, e.current_state)
                    JOIN dfa.conditions AS c 
                      ON e.condition_id = c.condition_id
                    LEFT JOIN dfa.effects AS ef -- effects can be NULL!
                      ON e.effect_id = ef.effect_id
                WHERE 
                    dfa.dispatch_condition(c.fname, s.entity_id, '{}'::JSON)  
            )
            INSERT INTO state_buffer(entity, new_state) 
            SELECT entity, new_state FROM new_states;

            UPDATE actor_states AS current SET 
                state_id = ns.new_state
            FROM 
                pg_temp.state_buffer AS ns 
            WHERE 
                current.entity_id = ns.entity_id
        `);  
    }
}
        

/*

-------------------------------------------------------------------------------
--VIEWS
-------------------------------------------------------------------------------
CREATE VIEW dfa.latest_tick(tick_id) AS (
    SELECT t.tick_id FROM dfa.ticks AS t ORDER BY tick_id DESC LIMIT 1
);

-------------------------------------------------------------------------------
--FUNCTIONS
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dfa.cond_true() 
RETURNS BOOLEAN AS $$
    SELECT TRUE
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION dfa.cond_has_target(_actor_id INT)
RETURNS BOOLEAN AS $$
    SELECT 
        COALESCE(that.hitpoints > 0, FALSE)
    FROM 
        dfa.actor_states AS this,
        dfa.actor_states AS that 
    WHERE 
        this.actor_id = _actor_id 
        AND that.actor_id = this.target_id
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION dfa.cond_is_at(_actor_id_this INT, _x DOUBLE PRECISION, _y DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
    SELECT (_x,_y) = a.position FROM dfa.actor_states AS a WHERE a.actor_id = _actor_id_this
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION dfa.cond_target_in_range(_actor_id_this INT)
RETURNS BOOLEAN AS $$
    SELECT 
        dfa.vector_distance(this.position, that.position) < this.range 
    FROM 
        dfa.actor_states AS this
        JOIN dfa.actor_states AS that 
          ON this.target_id = that.actor_id
    WHERE 
        this.actor_id = _actor_id_this
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION dfa.eff_attack_target(_actor_id_this INT)
RETURNS VOID AS $$
    UPDATE dfa.actor_states AS that SET 
        hitpoints = that.hitpoints - this.damage
    FROM 
        dfa.actor_states AS this
    WHERE 
        that.actor_id = this.target_id
        AND this.actor_id = _actor_id_this
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION dfa.eff_target_closest(_actor_id_this INT)
RETURNS VOID AS $$
    WITH 
    this(actor_id, position) AS (
        SELECT s.actor_id, s.position FROM dfa.actor_states AS s WHERE s.actor_id = _actor_id_this
    ),
    target(actor_id) AS (
        SELECT 
            that.actor_id 
        FROM 
            this, 
            dfa.actor_states AS that 
        WHERE 
            that.actor_id <> _actor_id_this
        ORDER BY 
            dfa.vector_distance(this.position, that.position) DESC 
        LIMIT 1
    )
    UPDATE dfa.actor_states AS s SET 
        target_id = t.actor_id
    FROM 
        target AS t 
    WHERE 
        s.actor_id = _actor_id_this
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION dfa.eff_move_towards_target(_actor_id_this INT) 
RETURNS VOID AS $$
    WITH actors(this_v, that_v, this_speed, diff_v) AS (
        SELECT 
            this.position,
            that.position,
            this.speed,
            dfa.vector_substract(that.position, this.position)
        FROM 
            dfa.actor_states AS this
            JOIN dfa.actor_states AS that
              ON this.target_id = that.actor_id
        WHERE 
            this.actor_id = _actor_id_this
    )
    UPDATE dfa.actor_states AS s SET 
        position = dfa.vector_add(a.this_v, dfa.vector_scale(a.diff_v, LEAST(a.this_speed, dfa.vector_length(a.diff_v))))
    FROM 
        actors AS a 
    WHERE 
        s.actor_id = _actor_id_this
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION dfa.dispatch_condition(_fname TEXT, _actor_id INT, _closure JSON)
RETURNS BOOLEAN AS $$
    SELECT CASE _fname
        WHEN 'dfa.cond_is_at'      THEN dfa.cond_is_at(
            _actor_id,
            --(_closure->>'actor_id')::INT, 
            (_closure->>'x')::DOUBLE PRECISION, 
            (_closure->>'y')::DOUBLE PRECISION)
        WHEN 'dfa.cond_target_in_range' THEN dfa.cond_target_in_range(_actor_id)
        WHEN 'dfa.cond_has_target' THEN dfa.cond_has_target(_actor_id)
        WHEN 'dfa.cond_true'       THEN dfa.cond_true()
        WHEN 'not'                 THEN NOT(dfa.dispatch_condition((_closure->>'fname'), _actor_id, (_closure->>'closure')::JSON))
        WHEN 'and'                 THEN dfa.dispatch_condition((_closure->>'fname1'), _actor_id, (_closure->>'closure1')::JSON) AND
                                        dfa.dispatch_condition((_closure->>'fname2'), _actor_id, (_closure->>'closure2')::JSON)
        WHEN 'or'                  THEN dfa.dispatch_condition((_closure->>'fname1'), _actor_id, (_closure->>'closure1')::JSON) OR
                                        dfa.dispatch_condition((_closure->>'fname2'), _actor_id, (_closure->>'closure2')::JSON)
    END
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION dfa.dispatch_effect(_fname TEXT, _actor_id INT, _closure JSON)
RETURNS VOID AS $$
    SELECT CASE _fname
        WHEN 'dfa.eff_move_towards_target' THEN dfa.eff_move_towards_target(_actor_id)
        WHEN 'dfa.eff_target_closest'      THEN dfa.eff_target_closest(_actor_id)
        WHEN 'dfa.eff_attack_target'       THEN dfa.eff_attack_target(_actor_id)
    END
$$ LANGUAGE sql;



CREATE OR REPLACE FUNCTION dfa.tick(_tick INT = NULL) 
-- RETURNS TABLE(actor_id INT, tick INT, position dfa.VECTOR) AS $$
RETURNS BOOLEAN AS $$
    TRUNCATE pg_temp.state_buffer;
    WITH new_states(actor_id, new_state, effect_result) AS (
        SELECT 
            s.actor_id, 
            e.next_state,
            dfa.dispatch_effect(ef.fname, s.actor_id, '{}'::JSON)
            ,ROW_NUMBER() OVER (PARTITION BY s.actor_id ORDER BY e.weight DESC)
        FROM 
            dfa.actor_states AS s 
            JOIN dfa.edges AS e
              ON (s.dfa_id, s.state_id) = (e.dfa_id, e.current_state)
            JOIN dfa.conditions AS c 
              ON e.condition_id = c.condition_id
            LEFT JOIN dfa.effects AS ef -- effects can be NULL!
              ON e.effect_id = ef.effect_id
        WHERE 
            dfa.dispatch_condition(c.fname, s.actor_id, '{}'::JSON)  
    )
    INSERT INTO pg_temp.state_buffer(actor_id, new_state) 
    SELECT actor_id, new_state FROM new_states;

    UPDATE dfa.actor_states AS current SET 
        state_id = ns.new_state
    FROM 
        pg_temp.state_buffer AS ns 
    WHERE 
        current.actor_id = ns.actor_id
    ;
    SELECT TRUE
$$ LANGUAGE sql;
*/