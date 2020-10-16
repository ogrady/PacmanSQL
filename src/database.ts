import initSqlJs, * as sqljs from "sql.js";

export class DB {
    private static instance: DB | undefined = undefined;
    public inner: any;

    public static async getInstance(): Promise<DB> {
        if(!DB.instance) {
            const SQL = await initSqlJs({
              // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
              // You can omit locateFile completely when running in node
              //locateFile: (file: string) => `https://sql.js.org/dist/${file}`
            });
            DB.instance = new DB(new SQL.Database());
        }
        return DB.instance as DB;
    }

    private constructor(db: any) {
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

    public getSingleValue(query: string): any {
        return this.inner.exec(query)[0].values[0][0];
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

    public run(sql: string) {
        this.db.inner.run(sql);
    }
}