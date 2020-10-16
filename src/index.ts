
//const initSqlJs = require('sql.js');
import initSqlJs, * as sqljs from "sql.js";
import { DB } from "./database";
import * as pf from "./pathfinding";
import * as env from "./environment";


async function test(db: any, environment: env.Environment, pathfinding: pf.Pathfinding) {
    environment.createEntity(1,1, 1,0);
    environment.createEntity(1,1);
    let res = db.exec(`SELECT * FROM entity_components`);
    environment.printResult(res[0].columns, res[0].values);
    environment.updatePositions();
    res = db.exec(`SELECT * FROM cells`);
    environment.printResult(res[0].columns, res[0].values);
    res = db.exec(`SELECT * FROM entity_components`);
    environment.printResult(res[0].columns, res[0].values);


    environment.printQueryResult("SELECT * FROM cell_neighbours");
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
      // NOTE: You can also use new SQL.Database(data) where
    // data is an Uint8Array representing an SQLite database file
    
    // Execute some sql
    let sqlstr: string = "";
    sqlstr = "CREATE TABLE hello (a int, b char);";
    sqlstr += "INSERT INTO hello VALUES (0, 'hello');"
    sqlstr += "INSERT INTO hello VALUES (1, 'world');"
    db.run(sqlstr); // Run the query without returning anything

    var res = db.exec("SELECT * FROM hello");
    /*
    [
      {columns:['a','b'], values:[[0,'hello'],[1,'world']]}
    ]
    */

    console.log(res);

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