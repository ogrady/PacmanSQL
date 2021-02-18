// tools for initial reading of data into the DB
import * as fs from "fs";
const dotparse = require("dotparser");


async function parseGraph(pacdb, graph) {
    // http://magjac.com/graphviz-visual-editor/
    const dfaName: string = graph.id;
    let initState: string | null = null;

    const states: string[] = [];
    const edges: [string, string, string, string, string][] = [];
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
            const to = c.edge_list[0].id;
            const weight = c.attr_list.find(attr => attr.id === "weight")?.eq || 1;
            let [condition, effect] = c.attr_list.find(attr => attr.id === "label").eq
                                            .replaceAll(" ", "_")
                                            .split(";");
            if(!condition) {
                condition = "true";
            }
            condition = "cond_" + condition;
            effect = effect ? "eff_" + effect : null;
            edges.push([dfaName, from, to, effect, condition]);
            conditions.add(condition);
            effects.add(effect);
        }
    }

    if(initState === null) {
        throw `no init state for DFA ${dfaName}. Create exactly one node with attribute init=true`;
    }

    states.map(async name => await pacdb.dfa.createState(name));

    Array.from(effects).filter(x => x).map(async name => await pacdb.dfa.createEffect(name));
    Array.from(conditions).filter(x => x).map(async name => await pacdb.dfa.createCondition(name));

    const dfaId = await pacdb.dfa.createDFA(dfaName, initState);

    edges.map(async ([dfaName, from, to, effect, condition]) => await pacdb.dfa.createEdge(dfaName, from, to, effect, condition));

    pacdb.dfa.createDispatchers();
}

export function readDFAs(pacdb, file) {
    const gviz = dotparse(fs.readFileSync(file, "utf8")).map(g => parseGraph(pacdb, g));
}