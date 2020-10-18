
//const initSqlJs = require('sql.js');
import initSqlJs, * as sqljs from "sql.js";
import { DB } from "./database";
import * as pf from "./pathfinding";
import * as env from "./environment";


async function test(db: any, environment: env.Environment, pathfinding: pf.Pathfinding) {
    /*environment.createEntity(3,0, 1,0);
    const eid = environment.createEntity(1,1);
    pathfinding.initSearch(eid, [3, 0], [7, 0]); 
    //pathfinding.printQueryResult("SELECT * FROM node_list");
    for(let i = 0; i < 10; i++) {
        for(const path of pathfinding.tickPathsearch()) {
            console.log(path);
        }
    }*/
    function add(a: number, b: number) {return db.inner.exec("SELECT COUNT(*) FROM entities")}
    // Specifies the SQL function's name, the number of it's arguments, and the js function to use
    db.inner.create_function("add_js", add);
    db.printQueryResult("SELECT add_js(1,1)")
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


async function garbage(db: any) {

    // Prepare an sql statement
    var stmt = db.prepare("SELECT * FROM hello WHERE a=:aval AND b=:bval");

    // Bind values to the parameters and fetch the results of the query
    var result = stmt.getAsObject({':aval' : 1, ':bval' : 'world'});
    console.log(result); // Will print {a:1, b:'world'}

    // Bind other values
    stmt.bind([0, 'hello']);
    while (stmt.step()) console.log(stmt.get()); // Will print [0, 'hello']
    // free the memory used by the statement
    stmt.free();
    // You can not use your statement anymore once it has been freed.
    // But not freeing your statements causes memory leaks. You don't want that.

    // You can also use JavaScript functions inside your SQL code
    // Create the js function you need
    function add(a: number, b: number) {return a+b;}
    // Specifies the SQL function's name, the number of it's arguments, and the js function to use
    db.create_function("add_js", add);
    // Run a query in which the function is used
    db.run("INSERT INTO hello VALUES (add_js(7, 3), add_js('Hello ', 'world'));"); // Inserts 10 and 'Hello world'

    // Export the database to an Uint8Array containing the SQLite database file
    var binaryArray = db.export();
}