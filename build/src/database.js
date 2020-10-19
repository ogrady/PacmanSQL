"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBUnit = exports.DB = void 0;
const sql_js_1 = __importDefault(require("sql.js"));
let DB = /** @class */ (() => {
    class DB {
        constructor(db) {
            this.inner = db;
        }
        static getInstance() {
            return __awaiter(this, void 0, void 0, function* () {
                if (!DB.instance) {
                    const SQL = yield sql_js_1.default({
                    // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
                    // You can omit locateFile completely when running in node
                    //locateFile: (file: string) => `https://sql.js.org/dist/${file}`
                    });
                    DB.instance = new DB(new SQL.Database());
                }
                return DB.instance;
            });
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
    DB.instance = undefined;
    return DB;
})();
exports.DB = DB;
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
    run(sql) {
        this.db.inner.run(sql);
    }
}
exports.DBUnit = DBUnit;
