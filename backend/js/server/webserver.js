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
exports.WebServer = void 0;
const express = __importStar(require("express"));
const STATIC_PATH = "../frontend/dist"; // FIXME
class WebServer {
    constructor(pacdb) {
        this.clients = {};
        this.pacdb = pacdb;
        // don"t use import-as-syntax, because default imports in TypeScript are a mess.
        const app = require("express")();
        app.set("port", process.env.PORT || 3000);
        app.use(express.static(STATIC_PATH));
        const http = require("http").Server(app);
        const io = require("socket.io")(http);
        http.listen(3000, () => console.log("listening on *:3000"));
        io.on("connection", this.initSocket.bind(this));
    }
    initSocket(socket) {
        console.log(`user ${socket.id} connected`);
        this.clients[socket.id] = socket;
        socket.on("disconnect", reason => {
            console.log(`disconnecting user ${socket.id}: ${reason}`);
            delete this.clients[socket.id];
        });
        socket.on("move", data => {
            console.log(data.eid);
        });
        socket.on("spawn", (data) => {
            //const eid = createEntity(data.type, data.x, data.y, data.ẟx, data.ẟy, data.speed);
        });
        socket.on("map", async () => {
            console.log("requested map");
            const map = await this.pacdb.environment.getBlockedAreas();
            console.log(map);
            socket.emit("map", map);
        });
    }
}
exports.WebServer = WebServer;
