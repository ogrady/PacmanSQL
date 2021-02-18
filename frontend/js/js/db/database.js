"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBUnit = exports.SqliteDB = exports.PostgresDB = exports.DBFactory = void 0;
const sql_js_1 = __importDefault(require("sql.js"));
// required, because constructor for sqlite needs async 
// connection routine, which can not be used for constructors
class DBFactory {
    createSqliteDB() {
        return SqliteDB.getInstance();
    }
}
exports.DBFactory = DBFactory;
class DB {
}
class PostgresDB extends DB {
    getLastId() {
        return this.getSingleValue(`SELECT last_insert_rowid()`);
    }
    getSingleValue(query) {
        return this.inner.exec(query)[0].values[0][0];
    }
}
exports.PostgresDB = PostgresDB;
let SqliteDB = /** @class */ (() => {
    class SqliteDB extends DB {
        constructor(db) {
            super();
            this.inner = db;
        }
        static async getInstance() {
            if (!SqliteDB.instance) {
                const SQL = await sql_js_1.default({
                // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
                // You can omit locateFile completely when running in node
                //locateFile: (file: string) => `https://sql.js.org/dist/${file}`
                });
                SqliteDB.instance = new SqliteDB(new SQL.Database());
            }
            return SqliteDB.instance;
        }
        printQueryResult(sql) {
            const res = this.inner.exec(sql);
            if (res.length > 0) {
                this.printResult(res[0].columns, res[0].values);
            }
            else {
                console.log("empty result");
            }
        }
        printResult(columns, values) {
            console.log(columns);
            for (const row of values) {
                console.log(row);
            }
        }
        getLastId() {
            return this.getSingleValue(`SELECT last_insert_rowid()`);
        }
        getSingleValue(query) {
            return this.inner.exec(query)[0].values[0][0];
        }
    }
    SqliteDB.instance = undefined;
    return SqliteDB;
})();
exports.SqliteDB = SqliteDB;
class DBUnit {
    constructor(db) {
        this.db = db;
        this.tables = [];
    }
    clearTables() {
        for (const table of this.tables) {
            console.log(`clearing table ${table}`);
            this.run(`DELETE FROM ${table}`);
        }
    }
    exec(sql) {
        return this.db.inner.exec(sql);
    }
    get(sql) {
        const res = this.exec(sql);
        return res === undefined || res[0] === undefined
            ? []
            : res[0].values ?? [];
    }
    run(sql) {
        this.db.inner.run(sql);
    }
}
exports.DBUnit = DBUnit;
