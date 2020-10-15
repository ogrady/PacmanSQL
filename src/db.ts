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