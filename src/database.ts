import initSqlJs, * as sqljs from "sql.js";

export class DB {
    private static instance : any = undefined;

    public static async getInstance() {
        if(!DB.instance) {
            const SQL = await initSqlJs({
              // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
              // You can omit locateFile completely when running in node
              //locateFile: (file: string) => `https://sql.js.org/dist/${file}`
            });
            DB.instance = new SQL.Database();
        }
        return DB.instance;
    }
}

export class DBUnit { // in an attempt to not call it DBComponent to not confuse it with the component-pattern
    protected db: any;
    protected tables: string[];
    
    public constructor(db: any) {
        this.db = db;
        this.tables = [];
    }

    public getLastId(): number {
        return this.db.exec(`SELECT last_insert_rowid()`)[0].values[0][0];
    }

    public getSingleValue(query: string): any {
        return this.db.exec(query)[0].values[0][0];
    }

    public clearTables(): void {

        for(const table of this.tables) {
            console.log(`clearing table ${table}`);
            this.db.run(`DELETE FROM ${table}`);    
        }    
    }

    public printQueryResult(sql: string) {
        const res = this.db.exec(sql);
        this.printResult(res[0].columns, res[0].values);
    }

    public printResult(columns: any, values: any[]) {
        console.log(columns)
        for(const row of values) {
            console.log(row);
        }
    }
}