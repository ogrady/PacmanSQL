import { DB, DBUnit } from "./database";
import * as fp from "../functools";
import * as pf from "./pathfinding";

export class DFA extends DBUnit {
    private pathfinding: pf.Pathfinding; // FIXME: this needs to go into a subclass that is disconnected from creating the general DFA stuff

    public constructor(db: DB, pathfinding: pf.Pathfinding) {
        super(db);

        this.pathfinding = pathfinding;

        this.tables = ["state_buffer", "ticks", "effects", "effect_closures", "condition_closures", "dfa", "states", "edges"];

        this.run(`
            CREATE TABLE state_buffer(
                entity_id INT, 
                new_state INT
            )`);

        this.run(`
            CREATE TABLE entity_states(
                entity_id INT, 
                dfa_id INT,
                state_id INT,
                FOREIGN KEY(entity_id) REFERENCES entites(rowid),
                FOREIGN KEY(dfa_id) REFERENCES dfa(rowid),
                FOREIGN KEY(state_id) REFERENCES states(rowid)
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
                FOREIGN KEY(condition_id) REFERENCES condition(rowid)
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
                FOREIGN KEY(dfa_id) REFERENCES dfa(rowid),
                FOREIGN KEY(current_state) REFERENCES states(rowid),
                FOREIGN KEY(condition_id) REFERENCES conditions(rowid),
                FOREIGN KEY(effect_id) REFERENCES effects(rowid),
                FOREIGN KEY(next_state) REFERENCES states(rowid),
                UNIQUE(current_state, condition_id) -- no ndfa
            )`);

        this.createConditionUDFs();
        this.createEffectUDFs();
        this.createDispatchers();

        this.createDFA(); 
    }

    public tick(): void { 
        this.run(`DELETE FROM state_buffer`);
        const transitions = this.get(`
            WITH new_states(entity_id, new_state, effect_name) AS (
                SELECT 
                    s.entity_id, 
                    e.next_state,
                    ef.fname
                END
                FROM 
                    entity_states AS s 
                    JOIN edges AS e
                      ON (s.dfa_id, s.state_id) = (e.dfa_id, e.current_state)
                    JOIN conditions AS c 
                      ON e.condition_id = c.rowid
                    LEFT JOIN effects AS ef -- effects can be NULL!
                      ON e.effect_id = ef.rowid
                WHERE 
                    CASE c.fname
                        WHEN 'cond_has_path'       THEN cond_has_path(s.entity_id)
                        WHEN 'cond_true'           THEN cond_true(s.entity_id)
                        WHEN 'cond_has_no_path'    THEN cond_has_no_path(s.entity_id)
                        ELSE FALSE
                    END
                    --true
                    -- dispatch_condition(c.fname, s.entity_id)  
            )
            SELECT entity_id, new_state, effect_name FROM new_states
            --INSERT INTO state_buffer(entity_id, new_state) 
            --SELECT entity_id, new_state FROM new_states`);

        for(const [eid, sid, fname] of transitions) {
            if(fname === "eff_move_next_cell") {
                this.moveNextCell(eid);
            }
            else if(fname === "eff_pathsearch_direct") {
                this.pathsearchDirect(eid);
            }
            this.run(`
                    UPDATE entity_states AS current SET 
                        state_id = ${sid}
                    FROM 
                        state_buffer AS ns 
                    WHERE 
                        current.entity_id = ${eid}
                `);
        }

        
    }

    private createUDFs(funs: {[id: string]: (...params: any) => any}) {
        for(const fname in funs) {
            this.db.inner.create_function(fname, funs[fname]);
        }
    }

    private createDispatchers(): void {
        const funs: {[id: string]: (...params: any) => void} = {
            "dispatch_effect": (fname: string, eid: number) => this.db.inner.getSingleValue(` -- need to return something to satisfy SELECT CASE
                SELECT CASE '${fname}'
                    WHEN 'eff_move_next_cell'      THEN eff_move_next_cell(${eid})
                    WHEN 'eff_pathsearch_direct'   THEN eff_pathsearch_direct(${eid})
                END`),
            "dispatch_condition": (fname: string, eid: number) => {
                const res = this.db.inner.getSingleValue(`
                SELECT CASE '${fname}'
                    WHEN 'cond_has_path'       THEN FALSE -- cond_has_path(${eid})
                    WHEN 'cond_true'           THEN FALSE -- cond_true(${eid})
                    WHEN 'cond_has_no_path'    THEN FALSE -- cond_has_no_path(${eid})
                    ELSE FALSE
                END`);
                return res;
            }
        };
        this.createUDFs(funs);
    }

    private createConditionUDFs() {
        const funs: {[id: string]: (...params: any) => boolean} = { 
            "cond_true": (eid: number) => this.db.getSingleValue("SELECT TRUE"),
            "cond_has_path": (eid: number) => this.db.getSingleValue(`
                            SELECT COUNT(*) > 0 FROM complete_paths WHERE entity_id = ${eid}`),
            "cond_has_no_path": (eid: number) => this.db.getSingleValue(`
                            SELECT COUNT(*) = 0 FROM complete_paths WHERE entity_id = ${eid}`),
         };
        this.createUDFs(funs);
    }

    private moveNextCell(eid) {
        console.log("move");
         this.run(`
            UPDATE position_components 
            SET 
                x = new.position_x, 
                y = new.position_y
            FROM 
                (SELECT position_x, position_y FROM complete_paths WHERE entity_id = ${eid} ORDER BY steps ASC LIMIT 1) AS new
            WHERE
                entity_id = ${eid}
            `);
        this.run(`
            DELETE FROM 
                complete_paths
            WHERE 
                rowid = (SELECT rowid FROM complete_paths WHERE entity_id = ${eid} ORDER BY steps ASC LIMIT 1)`);
    }

    private pathsearchDirect(eid) {
        this.pathfinding.initGhostToPacmanSearch(eid);
    }

    private createEffectUDFs() {
        return;
        const funs: {[id: string]: (eid: number) => void} = { 
            "eff_move_next_cell": this.moveNextCell,
            "eff_pathsearch_direct": this.pathsearchDirect
        };
        this.createUDFs(funs);
    }

    private createDFA() {
        this.run(`INSERT INTO conditions(fname) VALUES 
            ('cond_has_path'),   -- 1
            ('cond_has_no_path') -- 2
            `);

        this.run(`INSERT INTO effects(fname) VALUES 
            ('eff_move_next_cell'),   -- 1
            ('eff_pathsearch_direct') -- 2
            `);

        this.run(`INSERT INTO states(name) VALUES 
            ('chasing'),  -- 1
            ('searching') -- 2
            `);

        this.run(`INSERT INTO dfa(name, initial_state) VALUES 
                ('stupid ghost', 1)
            `);

        this.run(`INSERT INTO edges(
            dfa_id, current_state, condition_id, effect_id, next_state, weight) VALUES
            (    1,             1,            1,         1,          1,     10),
            (    1,             1,            2,         2,          2,     10),
            (    1,             2,            1,      null,          1,     10)
            `);        
    }

    public setupEntity(eid: number, dfaid: number) {
        console.log("finish")
        this.run(`
            INSERT INTO entity_states(entity_id, dfa_id, state_id) VALUES(
                ${eid},
                ${dfaid},
                (SELECT initial_state FROM dfa WHERE rowid = ${dfaid})
            )`);

    }
}