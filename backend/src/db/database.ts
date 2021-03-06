import * as pg from "pg";
import * as fs from "fs";

export let DEBUG = false;

abstract class DBConnection {
    public inner: any;
    public abstract getLastId(): number;
    public abstract getSingleValue<T>(query: string): T;
    public verbose: boolean = false;
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
        this.verbose = false;
    }

    public printQueryResult(sql: string): void {
        const res = this.inner.exec(sql);
        if(res.length > 0) {
            this.printResult(res[0].columns, res[0].values);
        } else {
            console.log("empty result");
        }
    }

    public printResult(columns: any, values: any[]): void {
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
    protected tables: string[];

    public constructor(db: DBConnection, sqlfile: string) {
        this.db = db;
        this.sqlfile = sqlfile;
        this.tables = [];
    }

    private generateWatchTriggerStatement(namespace: string, tableName: string, columns: string[]): [string, string] {
        const name = `update_${tableName}_timestamp`;
        const schemaAndName = `${namespace}.${tableName}`;
        return [`DROP TRIGGER IF EXISTS ${name} ON ${schemaAndName}`,
                `CREATE TRIGGER ${name} BEFORE UPDATE OF ${columns.join(",")}
                    ON ${schemaAndName}
                    FOR EACH ROW
                    WHEN ((${columns.map(c => "OLD." + c).join(",")}) IS DISTINCT FROM (${columns.map(c => "NEW." + c).join(",")}))
                    EXECUTE PROCEDURE update_last_update_column()
                ;`];
    }

    public async init(): Promise<void> {
        const data: string = fs.readFileSync(this.sqlfile, "utf8");
        const stmts: string[] = data.split(";--");
        for(let i = 0; i < stmts.length; i++) {
            await this.run(stmts[i]);
            const tableNames = [...stmts[i]
                                .matchAll(/CREATE TABLE.* ([^\s]*)\s?\(/gm)]
                                .map(m => m[1]);
            if(tableNames.length > 0) { // statement is a CREATE TABLE STATEMENT
                const watchedColumns = [...stmts[i].matchAll(/^\s+([^\s]+)\s.* -- WATCHED/gm)].map(m => m[1]);
                if(watchedColumns.length > 0) {
                    const tokens = tableNames[0].split(".");
                    const namespace = tokens.length > 1 ? tokens[0] : "";
                    const tableName = tokens.length > 1 ? tokens[1] : tokens[0];
                    const [drop, create] = this.generateWatchTriggerStatement(namespace, tableName, watchedColumns);
                    await this.run(drop);
                    await this.run(create);
                    console.log(`generated a WATCH trigger on ${namespace}.${tableName}(${watchedColumns.join(",")})`);
                }
            }
            this.tables = this.tables.concat(tableNames);
        }
        console.log(`intialised tables: [${this.tables.join(", ")}]`);
    }

    public async clearTables(): Promise<void> {
        for(let i = 0; i < this.tables.length; i++) {
            await this.run(`DELETE FROM ${this.tables[i]}`);
        }
    }

    public exec(sql: string): Promise<any> {
        return this.run(sql);
    }

    public async get(sql: string): Promise<any[]> {
        const res = await this.run(sql);
        if(res === undefined) {
            throw new Error(`res is undefined for get(${sql})`);
        }
        return res.rowCount === 0 ? [] : res.rows;
    }

    public async getSingleValue(sql: string): Promise<any> {
        const res = await this.get(sql);
        return res.length === 0 ? undefined : res[0][Object.keys(res[0])[0]];
    }

    public run(sql: string): Promise<any> {
        if(this.db.verbose) {
            console.log(sql);
            console.log("-------------")
        }
        return this.db.inner.query(sql).catch(error => console.error("DB ERROR", error));
    }

    public async func(fname: string, args: any[] = []): Promise<any> {
        const res = await this.run(`SELECT ${fname}(${args.join(", ")})`);
        return res.rowCount === 0 ? [] : res.rows;
    }
}

import * as env from "./environment";
import { DFA } from "./dfa";
import * as pf from "./pathfinding";
import * as mg from "./mapgeneration";

export class PacmanDB {
    readonly environment: env.Environment;
    readonly dfa: DFA;
    readonly pathfinding: pf.Pathfinding;
    readonly mapgeneration: mg.Mapgeneration;
    private connection: DBConnection;

    private constructor() {
        const conn = new PostgresqlConnection();;
        this.connection = conn;
        this.environment = new env.Environment(conn);
        this.pathfinding = new pf.Pathfinding(conn);
        this.dfa = new DFA(conn, this.pathfinding);
        this.mapgeneration = new mg.Mapgeneration(conn);
    }

    private async init() {
        await this.environment.init();
        await this.pathfinding.init();
        await this.dfa.init();
        await this.mapgeneration.init();
    }

    public static async create(): Promise<PacmanDB> {
        const instance: PacmanDB = new PacmanDB();
        await instance.init();
        return instance;
    }

    public setVerbose(b: boolean): void {
        this.connection.verbose = b;
    }
}

export const str = (x: any): string => `'${x}'`;
export const optional = (x: any): string => x === null || x === undefined ? "null" : x;