
//const initSqlJs = require('sql.js');
import initSqlJs, * as sqljs from "sql.js";
import { DB } from "./db";
import * as pf from "./pathfinding";

function printQueryResult(db: any, sql: string) {
    const res = db.exec(sql);
    printResult(res[0].columns, res[0].values);
}

function printResult(columns: any, values: any[]) {
    console.log(columns)
    for(const row of values) {
        console.log(row);
    }
}

function getLastId(db: any): number {
    return db.exec(`SELECT last_insert_rowid()`)[0].values[0][0];
}

function createTables(db: any): void {
    console.log("creating tables");

    db.run(`CREATE TABLE cells(
                x INT, 
                y INT, 
                passable BOOLEAN, 
                UNIQUE(x, y)
            )`);
    
    // entities
    db.run(`CREATE TABLE entities(
                type TEXT
            )`);

    // components
    db.run(`CREATE TABLE position_components(
                entity_id INT, 
                x         INT, 
                y         INT,
                FOREIGN KEY(entity_id) REFERENCES entities(rowid)                
            )`);

    db.run(`CREATE TABLE movement_components(
                entity_id INT, 
                ẟx        INT, 
                ẟy        INT,
                FOREIGN KEY(entity_id) REFERENCES entities(rowid)
            )`);

    console.log("creating views");
    // views
    db.run(`CREATE VIEW entity_components(entity_id, x, y, ẟx, ẟy) AS 
            SELECT 
                e.rowid,
                pc.x, 
                pc.y,
                mc.ẟx,
                mc.ẟy
            FROM 
                entities AS e 
                LEFT JOIN position_components AS pc 
                  ON pc.entity_id = e.rowid
                LEFT JOIN movement_components AS mc 
                  ON mc.entity_id = e.rowid
    `);

    db.run(`CREATE VIEW cell_neighbours(this_id, this_x, this_y, neighbour_id, neighbour_x, neighbour_y) AS 
            SELECT 
                this.rowid,
                this.x,
                this.y,
                that.rowid,
                that.x,
                that.y
            FROM 
                cells AS this
                JOIN cells AS that
                  ON (ABS(this.x - that.x), ABS(this.y - that.y)) IN (VALUES (1,0), (0,1))
    `);
}

function clearTables(db: any): void {
    console.log("clearing tables");
    for(const table of ["position_components", "movement_components", "cells", "entities"]) {
        db.run(`DELETE FROM ${table}`);    
    }    
}

function createEntity(db: any, x: number, y: number, ẟx: number = 0, ẟy: number = 0) {
    console.log(`creating entity at (${x}, ${y}) with movement (${ẟx}, ${ẟy})`);
    db.run(`INSERT INTO entities(type) VALUES ('entity')`);
    const res: number = getLastId(db);
    db.run(`INSERT INTO position_components(entity_id, x, y) VALUES (${res}, ${x}, ${y})`);
    db.run(`INSERT INTO movement_components(entity_id, ẟx, ẟy) VALUES (${res}, ${ẟx}, ${ẟy})`);
}

function createMap(db: any, w: number, h: number) {
    db.run(`
        WITH RECURSIVE 
        xs(x) AS (
            SELECT 0
            UNION ALL
            SELECT x + 1 FROM xs WHERE x + 1 < ${w}
        ),
        ys(y) AS (
            SELECT 0
            UNION ALL
            SELECT y + 1 FROM ys WHERE y + 1 < ${h}
        )
        INSERT INTO cells(x, y, passable) 
        SELECT 
            xs.x,
            ys.y,
            TRUE
        FROM 
            xs,
            ys
    `);
}

// neat little trick I stole from https://stackoverflow.com/a/37417976
const range = (length: number) => Array(length).fill(undefined).map((element, index) => index);

// https://stackoverflow.com/a/22015930
const zip = <A,B>(xs: A[], ys: B[]) : [A,B][] => xs.map((k, i) => [k, ys[i]]);

function setMap(db: any, descriptor: string) {
    // yes, this may have been easier to read with two for-loops, but I am polishing my FP a bit.
    const blocked: [number, number][] = descriptor
                                        .split("\n")                                        // rows by themselves
                                        .filter(row => row)                                 // remove rows that are completely empty
                                        .map(row => zip(row.split(""), range(row.length)))  // give each symbol their x-coordinate
                                        .map((row, y) => row.filter(char => char[0].trim()) // filter out all elements that are empty (= passable)
                                        .map(char => [char[1], y] as [number, number]))     // attach y-coordinate and remove block symbol
                                        .reduce((acc, row) => acc.concat(row), []);         // reduce 2d array into sequence
    for(const [x,y] of blocked) {
        db.run(`UPDATE cells SET passable = FALSE WHERE (x,y) = (${x},${y})`);
    }
}

function updatePositions(db: any) {
    db.run(`
        WITH upd(entity_id, new_x, new_y) AS (
            SELECT 
                ec.entity_id,
                c.x,
                c.y
            FROM
                entity_components AS ec 
                JOIN cells AS c 
                  ON ec.x + ec.ẟx = c.x AND 
                     ec.y + ec.ẟy = c.y
            WHERE 
                c.passable
        )
        UPDATE 
            position_components AS pc
        SET 
            x = upd.new_x,
            y = upd.new_y
        FROM 
            upd
        WHERE 
            pc.entity_id = upd.entity_id
    `);
}

async function test(db: any) {
    createEntity(db, 1,1, 1,0);
    createEntity(db, 1,1);
    let res = db.exec(`SELECT * FROM entity_components`);
    printResult(res[0].columns, res[0].values);
    updatePositions(db);
    res = db.exec(`SELECT * FROM cells`);
    printResult(res[0].columns, res[0].values);
    res = db.exec(`SELECT * FROM entity_components`);
    printResult(res[0].columns, res[0].values);


    printQueryResult(db, "SELECT * FROM cell_neighbours");

    new pf.Pathfinding(db);
}


async function main() {
    const db = await DB.getInstance();
    createTables(db);
    clearTables(db);
    createMap(db, 10, 10);

    

    const map = `
███ ███ ███
█        █
████████████`
    setMap(db, map);
    test(db);
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