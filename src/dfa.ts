import { DB, DBUnit } from "./database";
import * as fp from "./functools";

export class DFA extends DBUnit {
    public constructor(db: DB) {
        super(db);

        this.tables = ["state_buffer", "ticks", "effects", "effect_closures", "condition_closures", "dfa", "states", "edges"];

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
            CREATE TABLE effect_closures(
                effect_closure_id SERIAL PRIMARY KEY,
                effect_id         INT,
                entity_id         INT,
                tick_id           INT,
                closure           JSON,
                FOREIGN KEY(entity_id) REFERENCES entities(rowid),
                FOREIGN KEY(effect_id) REFERENCES effect(rowid),
                FOREIGN KEY(tick_id)   REFERENCES tick(rowid)
            )`);

        this.run(`
            CREATE TABLE conditions(
                fname        TEXT
            )`);

        this.run(`
            CREATE TABLE condition_closures(
                condition_id          INT,
                entity_id             INT,
                closure               JSON,
                FOREIGN KEY(entity_id) REFERENCES entities(rowid),
                FOREIGN KEY(condition_id) REFERENCES condition(rowid),
            )`);

        this.run(`
            CREATE TABLE dfa(
                initial_state INT,
                name          TEXT,
                FOREIGN KEY(initial_state) REFERENCES states(rowid)
            )`);

        this.run(`
            CREATE TABLE states(
                name         TEXT,
                UNIQUE(name)
            )`);

        this.run(`
            CREATE TABLE edges(
                dfa_id        INT,
                current_state INT,
                condition_id  INT,
                effect_id     INT,
                next_state    INT,
                weight        INT,
                FOREIGN KEY dfa_id REFERENCES dfa(rowid),
                FOREIGN KEY current_state REFERENCES states(rowid),
                FOREIGN KEY condition_id REFERENCES conditions(rowid),
                FOREIGN KEY effect_id REFERENCES effects(rowid),
                FOREIGN KEY next_state REFERENCES states(rowid),
                UNIQUE(current_state, condition_id) -- no ndfa
            )`);

        this.createConditionUDFs();
        this.createEffectUDFs();
        this.createDispatchers();
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

    private createUDFs(funs: {[id: string]: (...params: any) => any}) {
        for(const fname in funs) {
            this.db.inner.create_function(fname, funs[fname]);
        }
    }

    // unfinished
    private createDispatchers(): void {
        const funs: {[id: string]: (...params: any) => void} = {
            "dispatch_effect": (fname: string, eid: number, closure: any) => this.db.inner.run(`
                SELECT CASE ${fname}
                    WHEN 'eff_move_towards_target' THEN eff_move_towards_target(${eid})
                    WHEN 'eff_target_closest'      THEN eff_target_closest(_actor_id)
                    WHEN 'eff_attack_target'       THEN eff_attack_target(_actor_id)
                END`),
            "dispatch_condition": (fname: string, eid: number, closure: any) => this.db.inner.run(`
                SELECT CASE ${fname}
                    WHEN 'cond_is_at'      THEN cond_is_at(${eid},??,??)
                    WHEN 'dfa.cond_target_in_range' THEN dfa.cond_target_in_range(_actor_id)
                    WHEN 'dfa.cond_has_target' THEN dfa.cond_has_target(_actor_id)
                    WHEN 'dfa.cond_true'       THEN dfa.cond_true()
                    WHEN 'not'                 THEN NOT(dispatch_condition((_closure->>'fname'), _actor_id, (_closure->>'closure')::JSON))
                    WHEN 'and'                 THEN dispatch_condition((_closure->>'fname1'), _actor_id, (_closure->>'closure1')::JSON) AND
                                                    dispatch_condition((_closure->>'fname2'), _actor_id, (_closure->>'closure2')::JSON)
                    WHEN 'or'                  THEN dispatch_condition((_closure->>'fname1'), _actor_id, (_closure->>'closure1')::JSON) OR
                                                    dispatch_condition((_closure->>'fname2'), _actor_id, (_closure->>'closure2')::JSON)`)
        };
        this.createUDFs(funs);
    }

    private createConditionUDFs() {
        const funs: {[id: string]: (...params: any) => boolean} = { 
            "cond_true": () => this.db.getSingleValue("SELECT TRUE"),
            "cond_is_at": (eid: number, x: number, y: number) => this.db.getSingleValue(`
                            SELECT 
                                (${x},${y}) = a.position 
                            FROM 
                                position_components AS pc 
                            WHERE 
                                pc.entity_id = ${eid})`)
        };
        this.createUDFs(funs);
    }

    private createEffectUDFs() {
        const funs: {[id: string]: (eid: number) => void} = { 
            "eff_move_next_cell": (eid: number) => {
                    this.db.inner.run(`
                        UPDATE position_components 
                        SET 
                            x = new.x, 
                            y = new.y
                        FROM 
                            (SELECT x,y FROM ??? WHERE entity_id = ${eid} ORDER BY step ASC LIMIT 1) AS new
                        WHERE`);
                    this.db.inner.run(`
                        DELETE FROM 
                            ??? 
                        WHERE 
                            rowid = (SELECT rowid FROM ??? WHERE entity_id = ${eid} ORDER BY step ASC LIMIT 1`)
            },
            "eff_pathsearch_simple": (eid: number) => this.db.inner.run(``);
        };
        this.createUDFs(funs);
    }
}