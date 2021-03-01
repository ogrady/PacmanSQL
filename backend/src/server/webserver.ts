import * as express from "express";
import * as socketio from "socket.io";
import * as path from "path";
import * as db from "../db/database";

const STATIC_PATH = "../frontend/dist"; // FIXME

export class WebServer {
    private pacdb: db.PacmanDB;
    private clients: {[key: number]: socketio.Socket};
    private server;
  
    public constructor(pacdb: db.PacmanDB) {
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
  
    public initSocket(socket: socketio.Socket): void {
        console.log(`user ${socket.id} connected`);
        this.clients[socket.id] = socket;
    
        socket.on("disconnect", reason => {
          console.log(`disconnecting user ${socket.id}: ${reason}`);
          delete this.clients[socket.id];
        });
    
        socket.on("move", data => {
          console.log(data.eid);
        });
    
        socket.on("spawn", (data: SpawnData) => {
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

interface SpawnData {
    readonly type: string;
    readonly x: number;
    readonly y: number;
    readonly ẟx: number;
    readonly ẟy: number;
    readonly speed: number;
}