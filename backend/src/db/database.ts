import * as pg from "pg";
import * as fs from "fs";

const DEBUG: boolean = true;

abstract class DBConnection {
    public inner: any;

    public abstract getLastId(): number;

    public abstract getSingleValue<T>(query: string): T;
}

export class PostgresqlConnection extends DBConnection {
    public constructor() {
        super();
        this.inner = new pg.Pool({
          user: "pacman",
          host: "localhost",
          database: "pacman",
          password: "pacman",
          port: 5432,
        });
    }
    
    public printQueryResult(sql: string) {
        const res = this.inner.exec(sql);
        if(res.length > 0) {
            this.printResult(res[0].columns, res[0].values);  
        } else {
            console.log("empty result");  
        }
    }

    public printResult(columns: any, values: any[]) {
        console.log(columns)
        for(const row of values) {
            console.log(row);
        }  
    }

    public getLastId(): number {
        return this.getSingleValue(`SELECT last_insert_rowid()`);
    }

    public getSingleValue<T>(query: string): T {
        return this.inner.exec(query)[0].values[0][0] as T;
    }
}

export class DBUnit { // in an attempt to not call it DBComponent to not confuse it with the component-pattern
    protected db: DBConnection;
    protected sqlfile: string;
    
    public constructor(db: DBConnection, sqlfile: string) {
        this.db = db;
        this.sqlfile = sqlfile;
    }

    public async init() {
        const data: string = fs.readFileSync(this.sqlfile, "utf8");
        const stmts: string[] = data.split(";--");
        for(let i = 0; i < stmts.length; i++) {
            await this.run(stmts[i]);
        }        
    }

    public exec(sql: string): Promise<any> {
        return this.db.inner.query(sql);
    }

    public get(sql: string): any[] {
        const res = this.exec(sql);
        return res === undefined || res[0] === undefined 
                ? []
                : res[0].values ?? []
    }

    public run(sql: string): Promise<any> {
        return this.exec(sql);
        /*
        if(DEBUG) {
            console.log(sql);
            console.log("-------------")
        }
        return this.db.inner.query(sql);
        */
    }

    public func(fname: string, args: any[] = []) {
        return this.run(`SELECT ${fname}(${args.join(", ")})`);
    }
}

import * as env from "./environment";
import { DFA } from "./dfa";
import * as pf from "./pathfinding";

export class PacmanDB {
    readonly environment: env.Environment;
    readonly dfa: DFA;
    readonly pathfinding: pf.Pathfinding;

    public constructor() {
        const connection = new PostgresqlConnection();
        this.environment = new env.Environment(connection);       
        this.pathfinding = new pf.Pathfinding(connection);
        this.dfa = new DFA(connection, this.pathfinding);
    }

    public async init() {
        await this.environment.init();
        await this.pathfinding.init();
        await this.dfa.init();
    }
}

export const str = (x: any): string => `'${x}'`;