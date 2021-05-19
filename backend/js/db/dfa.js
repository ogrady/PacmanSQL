"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DFA = void 0;
const db = __importStar(require("./database"));
class DFA extends db.DBUnit {
    constructor(db, pathfinding) {
        super(db, "./src/db/sql/dfa.sql");
        this.pathfinding = pathfinding;
    }
    async init() {
        await super.init();
        await this.func("dfa.create_dfa");
    }
    async tick() {
        return this.exec("SELECT dfa.tick()");
    }
    pathsearchDirect(eid) {
        this.pathfinding.initGhostToPacmanSearch(eid);
    }
    async createEffect(name) {
        console.log(`creating effect with name ${name}`);
        return this.exec(`INSERT INTO dfa.effects(fname)
                                (VALUES (${db.str(name)})) 
                                RETURNING id`);
    }
    async createCondition(name) {
        console.log(`creating condition with name ${name}`);
        return this.exec(`INSERT INTO dfa.conditions(fname)
                                (VALUES (${db.str(name)})) 
                                RETURNING id`);
    }
    async createDFA(name, initState) {
        console.log(`creating DFA ${name} with initial state ${initState}`);
        return (await this.exec(`INSERT INTO dfa.dfa(name, initial_state) 
                                    (VALUES (${db.str(name)}, 
                                            (SELECT id FROM dfa.states WHERE name = ${db.str(initState)})
                                    ))
                                  RETURNING id`)).rows[0].id;
    }
    async createDispatchers() {
        // conditions
        const conditions = (await this.exec("SELECT fname FROM dfa.conditions")).rows
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
        const effects = (await this.exec("SELECT fname FROM dfa.effects")).rows
            .map(row => `WHEN '${row.fname}' THEN dfa.${row.fname}(_eid)`);
        await this.exec(`
            CREATE OR REPLACE FUNCTION dfa.dispatch_effect(_eid INT, _fname TEXT)
            RETURNS VOID AS $$
                SELECT CASE _fname
                    ${effects.join("\n")}
                END; 
            $$ LANGUAGE sql;`);
    }
    async createState(name) {
        console.log(`creating state ${name}`);
        return (await this.exec(`INSERT INTO dfa.states(name) 
                                    (VALUES (${db.str(name)}))
                                  RETURNING id`)).rows[0].id;
    }
    async createEdge(dfa, state1, state2, effect, condition, weight = 1) {
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
exports.DFA = DFA;
