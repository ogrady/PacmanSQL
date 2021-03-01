"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.str = exports.PacmanDB = exports.DBUnit = exports.PostgresqlConnection = void 0;
const pg = __importStar(require("pg"));
const fs = __importStar(require("fs"));
const DEBUG = true;
class DBConnection {
}
class PostgresqlConnection extends DBConnection {
    constructor() {
        super();
        this.inner = new pg.Pool({
            user: "pacman",
            host: "localhost",
            database: "pacman",
            password: "pacman",
            port: 5432,
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
exports.PostgresqlConnection = PostgresqlConnection;
class DBUnit {
    constructor(db, sqlfile) {
        this.db = db;
        this.sqlfile = sqlfile;
        this.tables = [];
    }
    async init() {
        const data = fs.readFileSync(this.sqlfile, "utf8");
        const stmts = data.split(";--");
        for (let i = 0; i < stmts.length; i++) {
            await this.run(stmts[i]);
            this.tables.concat([...stmts[i].matchAll(/CREATE TABLE.* ([^\s]*)\s?\(/gm)]
                .map(m => m[1])); // table names
        }
        console.log(`intialised tables: [${this.tables.join(", ")}]`);
    }
    async clearTables() {
        for (let i = 0; i < this.tables.length; i++) {
            await this.run(`DELETE FROM ${this.tables[i]}`);
        }
    }
    exec(sql) {
        return this.run(sql);
    }
    async get(sql) {
        const res = await this.run(sql);
        return res.rowCount === 0
            ? []
            : res.rows;
    }
    async getSingleValue(sql) {
        const res = await this.get(sql);
        return res.length === 0 ? undefined : res[0][Object.keys(res[0])[0]];
    }
    run(sql) {
        if (DEBUG) {
            console.log(sql);
            console.log("-------------");
        }
        return this.db.inner.query(sql);
    }
    func(fname, args = []) {
        return this.run(`SELECT ${fname}(${args.join(", ")})`);
    }
}
exports.DBUnit = DBUnit;
const env = __importStar(require("./environment"));
const dfa_1 = require("./dfa");
const pf = __importStar(require("./pathfinding"));
class PacmanDB {
    constructor() {
        const connection = new PostgresqlConnection();
        this.environment = new env.Environment(connection);
        this.pathfinding = new pf.Pathfinding(connection);
        this.dfa = new dfa_1.DFA(connection, this.pathfinding);
    }
    async init() {
        await this.environment.init();
        await this.pathfinding.init();
        await this.dfa.init();
    }
    static async create() {
        const instance = new PacmanDB();
        await instance.init();
        return instance;
    }
}
exports.PacmanDB = PacmanDB;
exports.str = (x) => `'${x}'`;
