import initSqlJs, * as sqljs from "sql.js";

// required, because constructor for sqlite needs async 
// connection routine, which can not be used for constructors
export class DBFactory {
    public createSqliteDB() {
        return SqliteDB.getInstance();
    }
}

abstract class DB {
    public inner: any;

    public abstract getLastId(): number;

    public abstract getSingleValue<T>(query: string): T;
}

export class PostgresDB extends DB {
    public getLastId(): number {
        return this.getSingleValue(`SELECT last_insert_rowid()`);
    }

    public getSingleValue<T>(query: string): T {
        return this.inner.exec(query)[0].values[0][0] as T;
    }
}

export class SqliteDB extends DB {
    
    private static instance: SqliteDB | undefined = undefined;

    public static async getInstance(): Promise<SqliteDB> {
        if(!SqliteDB.instance) {
            const SQL = await initSqlJs({
              // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
              // You can omit locateFile completely when running in node
              //locateFile: (file: string) => `https://sql.js.org/dist/${file}`
            });
            SqliteDB.instance = new SqliteDB(new SQL.Database());
        }
        return SqliteDB.instance as SqliteDB;
    }

    private constructor(db: any) {
        super();
        this.inner = db;
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
    protected db: DB;
    protected tables: string[];
    
    public constructor(db: DB) {
        this.db = db;
        this.tables = [];
    }

    public clearTables(): void {
        for(const table of this.tables) {
            console.log(`clearing table ${table}`);
            this.run(`DELETE FROM ${table}`);    
        }    
    }

    public exec(sql: string) {
        return this.db.inner.exec(sql);
    }

    public get(sql: string): any[] {
        const res = this.exec(sql);
        return res === undefined || res[0] === undefined 
                ? []
                : res[0].values ?? []
    }

    public run(sql: string) {
        this.db.inner.run(sql);
    }
}