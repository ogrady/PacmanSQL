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