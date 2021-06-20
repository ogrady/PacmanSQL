// tools for initial reading of data into the DB
import * as fs from "fs";
import * as db from "../db/database";
const dotparse = require("dotparser");

async function parseGraph(pacdb: db.PacmanDB, graph): Promise<void> {
    // http://magjac.com/graphviz-visual-editor/
    const dfaName: string = graph.id;
    let initState: string | null = null;

    const states: string[] = [];
    const edges: [string, string, string, string, string, number][] = [];
    const conditions: Set<string> = new Set();
    const effects: Set<string> = new Set();

    // we need to collect all nodes and write them into the DB afterwards,
    // because nodes are not guaranteed any order, but we need to write states, then conditions and effects, then edges and finally DFAs,
    // as they are dependent on each other in said order in reverse.
    for(const c of graph.children) {
        if(c.type == "node_stmt") {
            // STATE
            const stateName = c.node_id.id;
            const isInit = c.attr_list.find(attr => attr.id === "init" && attr.eq === "true") !== undefined;
            if(isInit) {
                if(initState !== null) {
                    throw `init state already defined for DFA ${dfaName}`;
                } else {
                    initState = stateName;
                }
            }
            states.push(stateName);
        } else if(c.type == "edge_stmt") {
            // EDGE
            const from = c.edge_list[0].id;
            const to = c.edge_list[1].id;
            const weight = c.attr_list.find(attr => attr.id === "weight")?.eq || 1;
            let [condition, effect] = c.attr_list.find(attr => attr.id === "label").eq
                                            .replaceAll(" ", "_")
                                            .split(";");
            if(!condition) {
                condition = "true";
            }
            condition = "cond_" + condition;
            effect = effect ? "eff_" + effect : null;
            edges.push([dfaName, from, to, effect, condition, weight]);
            conditions.add(condition);
            effects.add(effect);
        }
    }

    if(initState === null) {
        throw `no init state for DFA ${dfaName}. Create exactly one node with attribute init=true`;
    }

    await Promise.all(states.map(async name => await pacdb.dfa.createState(name)));
    await Promise.all(Array.from(effects).filter(x => x).map(async name => await pacdb.dfa.createEffect(name)));
    await Promise.all(Array.from(conditions).filter(x => x).map(async name => await pacdb.dfa.createCondition(name)));
    await pacdb.dfa.createDFA(dfaName, initState);
    await Promise.all(edges.map(async ([dfaName, from, to, effect, condition, weight]) => await pacdb.dfa.createEdge(dfaName, from, to, effect, condition, weight)));
    await pacdb.dfa.createDispatchers();
}

export async function readDFAs(pacdb: db.PacmanDB, file: string): Promise<void> {
    await Promise.all(dotparse(fs.readFileSync(file, "utf8")).map(g => parseGraph(pacdb, g)));
}

export async function readMap(pacdb: db.PacmanDB, file: string): Promise<void> {
    await pacdb.environment.setMap(fs.readFileSync(file, "utf8"));
}

export async function readGameData(pacdb: db.PacmanDB, file: string): Promise<void> {
    await pacdb.environment.setMap(fs.readFileSync(file, "utf8"));
}

type Modrow = [number,number,number];
type Module = [number,number,number][]

export async function readMapModules(pacdb: db.PacmanDB, file: string): Promise<void> {
    const contents = fs.readFileSync(file, "utf8").split("\n").map(line => line.trim().split(""));

    if(contents.length !== 3) {
        throw new Error(`expected exactly 3 lines in the modules file, but found ${contents.length}`);
    }

    if(contents[0].length !== contents[1].length || contents[1].length !== contents[2].length) {
        throw new Error(`all lines in the modules file must be of equal length after trimming, but they are ${contents.map(line => line.length)}`);
    }

    const tiles = {
        "■": 2,
        "□": 1
    };

    const modules: Module[] = [];
    while(contents[0].length > 0) {
        const module: Module = [];
        for(let x = 0; x < 3; x++) {
            for(let y = 0; y < 3; y++) {
                const tile = contents[y].shift();
                if(tile === undefined) {
                    throw new Error(`expected semantic character in line ${y}, but found undefined instead`);
                }
                module.push([x, y, tiles[tile]]);
            }
        }
        for(let i = 0; i < 3; i++) {
            const padding = contents[i].shift();
            if(padding !== " " && padding !== undefined) { // undefined for last module
                throw new Error(`found semantic character while removing spacers in row ${i}: '${padding}'`);
            }
        }
        modules.push(module);
    }

    console.log(`reading ${modules.length} modules from file`);
    for(const module of modules) {
        await pacdb.mapgeneration.addModule(module);
    }
    console.log("recomputing edge compatibilities");
    await pacdb.mapgeneration.refreshCompatibility();
}

/*
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
*/