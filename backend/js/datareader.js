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
exports.readMap = exports.readDFAs = void 0;
// tools for initial reading of data into the DB
const fs = __importStar(require("fs"));
const dotparse = require("dotparser");
async function parseGraph(pacdb, graph) {
    // http://magjac.com/graphviz-visual-editor/
    const dfaName = graph.id;
    let initState = null;
    const states = [];
    const edges = [];
    const conditions = new Set();
    const effects = new Set();
    // we need to collect all nodes and write them into the DB afterwards,
    // because nodes are not guaranteed any order, but we need to write states, then conditions and effects, then edges and finally DFAs,
    // as they are dependent on each other in said order in reverse.
    for (const c of graph.children) {
        if (c.type == "node_stmt") {
            // STATE
            const stateName = c.node_id.id;
            const isInit = c.attr_list.find(attr => attr.id === "init" && attr.eq === "true") !== undefined;
            if (isInit) {
                if (initState !== null) {
                    throw `init state already defined for DFA ${dfaName}`;
                }
                else {
                    initState = stateName;
                }
            }
            states.push(stateName);
        }
        else if (c.type == "edge_stmt") {
            // EDGE
            const from = c.edge_list[0].id;
            const to = c.edge_list[0].id;
            const weight = c.attr_list.find(attr => attr.id === "weight")?.eq || 1;
            let [condition, effect] = c.attr_list.find(attr => attr.id === "label").eq
                .replaceAll(" ", "_")
                .split(";");
            if (!condition) {
                condition = "true";
            }
            condition = "cond_" + condition;
            effect = effect ? "eff_" + effect : null;
            edges.push([dfaName, from, to, effect, condition]);
            conditions.add(condition);
            effects.add(effect);
        }
    }
    if (initState === null) {
        throw `no init state for DFA ${dfaName}. Create exactly one node with attribute init=true`;
    }
    await Promise.all(states.map(async (name) => await pacdb.dfa.createState(name)));
    await Promise.all(Array.from(effects).filter(x => x).map(async (name) => await pacdb.dfa.createEffect(name)));
    await Promise.all(Array.from(conditions).filter(x => x).map(async (name) => await pacdb.dfa.createCondition(name)));
    await pacdb.dfa.createDFA(dfaName, initState);
    await Promise.all(edges.map(async ([dfaName, from, to, effect, condition]) => await pacdb.dfa.createEdge(dfaName, from, to, effect, condition)));
    await pacdb.dfa.createDispatchers();
}
async function readDFAs(pacdb, file) {
    await Promise.all(dotparse(fs.readFileSync(file, "utf8")).map(g => parseGraph(pacdb, g)));
}
exports.readDFAs = readDFAs;
async function readMap(pacdb, file) {
    await pacdb.environment.setMap(fs.readFileSync(file, "utf8"));
}
exports.readMap = readMap;
