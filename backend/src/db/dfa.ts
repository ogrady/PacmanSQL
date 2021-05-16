import * as db from "./database";
import * as pf from "./pathfinding";

export class DFA extends db.DBUnit {
    private pathfinding: pf.Pathfinding; // FIXME: this needs to go into a subclass that is disconnected from creating the general DFA stuff

    public constructor(db: db.PostgresqlConnection, pathfinding: pf.Pathfinding) {
        super(db, "./src/db/sql/dfa.sql");
        this.pathfinding = pathfinding;
    }

    public async init(): Promise<void> {
        await super.init();
        await this.func("dfa.create_dfa");
    }

    public async tick(): Promise<void> { 
        return this.exec("SELECT dfa.tick()");
    }

    private pathsearchDirect(eid) {
        this.pathfinding.initGhostToPacmanSearch(eid);
    }

    public async createEffect(name: string): Promise<number> {
        console.log(`creating effect with name ${name}`);
        return this.exec(`INSERT INTO dfa.effects(fname)
                                (VALUES (${db.str(name)})) 
                                RETURNING id`);
    }

    public async createCondition(name: string): Promise<number> {
        console.log(`creating condition with name ${name}`);
        return this.exec(`INSERT INTO dfa.conditions(fname)
                                (VALUES (${db.str(name)})) 
                                RETURNING id`);
    }

    public async createDFA(name: string, initState: string): Promise<number> {
        console.log(`creating DFA ${name} with initial state ${initState}`);
        return (await this.exec(`INSERT INTO dfa.dfa(name, initial_state) 
                                    (VALUES (${db.str(name)}, 
                                            (SELECT id FROM dfa.states WHERE name = ${db.str(initState)})
                                    ))
                                  RETURNING id`)).rows[0].id;
    }

    public async createDispatchers(): Promise<void> {
        // conditions
        const conditions: string[] = (await this.exec("SELECT fname FROM dfa.conditions")).rows
                                        .map(row => `WHEN '${row.fname}' THEN dfa.${row.fname}(_eid)`);
        await this.exec(`
            CREATE OR REPLACE FUNCTION dfa.dispatch_condition(_eid INT, _fname TEXT)
            RETURNS BOOLEAN AS $$
                SELECT CASE _fname
                    ${conditions.join("\n")}
                    ELSE FALSE
                END; 
            $$ LANGUAGE sql;`);

        // effects
        const effects: string[] = (await this.exec("SELECT fname FROM dfa.effects")).rows
                                        .map(row => `WHEN '${row.fname}' THEN dfa.${row.fname}(_eid)`);
        await this.exec(`
            CREATE OR REPLACE FUNCTION dfa.dispatch_effect(_eid INT, _fname TEXT)
            RETURNS VOID AS $$
                SELECT CASE _fname
                    ${effects.join("\n")}
                END; 
            $$ LANGUAGE sql;`);
    }

    public async createState(name: string): Promise<number> {
        console.log(`creating state ${name}`);
        return (await this.exec(`INSERT INTO dfa.states(name) 
                                    (VALUES (${db.str(name)}))
                                  RETURNING id`)).rows[0].id;
    }

    public async createEdge(dfa: string, state1: string, state2: string, effect: string, condition: string, weight = 1): Promise<number> {
        console.log(`creating edge ${state1} -[IF ${condition} THEN ${effect}]→ ${state2}`);
        return (await this.exec(`INSERT INTO dfa.edges(dfa_id, current_state, next_state, effect_id, condition_id, weight) (VALUES (
                                    (SELECT id FROM dfa.dfa WHERE name = ${db.str(dfa)}),
                                    (SELECT id FROM dfa.states WHERE name = ${db.str(state1)}),
                                    (SELECT id FROM dfa.states WHERE name = ${db.str(state2)}),
                                    (SELECT id FROM dfa.effects WHERE fname = ${db.str(effect)}),
                                    (SELECT id FROM dfa.conditions WHERE fname = ${db.str(condition)}),
                                    ${weight}
                                ))
                          RETURNING id`)).rows[0].id;
    }

}