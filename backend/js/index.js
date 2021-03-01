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
const path = __importStar(require("path"));
const db = __importStar(require("./db/database"));
const reader = __importStar(require("./datareader"));
// don"t use import-as-syntax, because default imports in TypeScript are a mess.
const express = require("express");
const app = express();
app.set("port", process.env.PORT || 3000);
var http = require("http").Server(app);
// simple "/" endpoint sending a Hello World
// response
let io = require("socket.io")(http);
app.get("/", (req, res) => {
    res.sendFile(path.resolve("./index.html"));
});
const clients = {};
io.on("connection", initSocket);
const server = http.listen(3000, function () {
    console.log("listening on *:3000");
});
function initSocket(socket) {
    console.log(`user ${socket.id} connected`);
    clients[socket.id] = socket;
    socket.on("disconnect", reason => {
        console.log(`disconnecting user ${socket.id}: ${reason}`);
        delete clients[socket.id];
    });
    socket.on("move", data => {
        console.log(data.eid);
    });
    socket.on("spawn", (data) => {
        //const eid = createEntity(data.type, data.x, data.y, data.ẟx, data.ẟy, data.speed);
    });
}
async function main() {
    const daba = await db.PacmanDB.create();
    await reader.readMap(daba, "./data/map.txt");
    await daba.environment.createGhost(1, 1);
    await daba.pathfinding.initSearch(1, [1, 1], [4, 4]);
    for (let i = 0; i < 10; i++) {
        const x = await daba.pathfinding.tickPathsearch();
        console.log(x);
    }
}
async function test() {
    const pacdb = await db.PacmanDB.create();
    await reader.readDFAs(pacdb, "./data/dfa/ghosts.gviz");
    const res = await pacdb.environment.get("SELECT * FROM dfa.edges");
    console.log("HERE GOES");
    console.log(res);
    console.log(await pacdb.environment.getSingleValue("SELECT * FROM dfa.edges"));
}
//main();
test();
