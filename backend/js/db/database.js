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
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PacmanDB = exports.DBUnit = exports.PostgresqlConnection = void 0;
const pg = __importStar(require("pg"));
const DEBUG = false;
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
    }
    async init() {
        const fs = require("fs");
        const data = fs.readFileSync(this.sqlfile, "utf8");
        const stmts = data.split(";");
        for (let i = 0; i < stmts.length; i++) {
            await this.run(stmts[i]);
        }
    }
    exec(sql) {
        return this.db.inner.query(sql);
    }
    get(sql) {
        const res = this.exec(sql);
        return res === undefined || res[0] === undefined
            ? []
            : res[0].values ?? [];
    }
    run(sql) {
        if (DEBUG)
            console.log(sql);
        return this.db.inner.query(sql);
    }
}
exports.DBUnit = DBUnit;
const env = __importStar(require("./environment"));
class PacmanDB {
    constructor() {
        const connection = new PostgresqlConnection();
        this.environment = new env.Environment(connection);
    }
    async init() {
        await this.environment.init();
    }
}
exports.PacmanDB = PacmanDB;
