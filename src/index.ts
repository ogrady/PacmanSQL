
//const initSqlJs = require('sql.js');
import initSqlJs, * as sqljs from "sql.js";
import { DB } from "./database";
import * as pf from "./pathfinding";
import * as env from "./environment";
import * as dfa from "./dfa";
export * as fe from "./frontend";
import * as be from "./backend";

export const PI: number=42;

async function test(db: any, environment: env.Environment, pathfinding: pf.Pathfinding) {

}

 
async function main() {
    const db = await DB.getInstance();
    const environment: env.Environment = new env.Environment(db);
    const pathfinding: pf.Pathfinding = new pf.Pathfinding(db);

    const map = `
███ ███ ███
█        █
████████████`
    environment.setMap(map);
    test(db, environment, pathfinding);
}

main(); 
