import * as express from "express";
import * as socketio from "socket.io";
import * as path from "path";
import * as db from "../db/database";
import * as env from "../db/environment";

const STATIC_PATH = "../frontend/dist"; // FIXME

interface Client {
    socket: socketio.Socket;
    entityId: number;
}

export class WebServer {
    private pacdb: db.PacmanDB;
    private clients: {[key: number]: Client};
    private server;

    public constructor(pacdb: db.PacmanDB) {
        this.clients = {};
        this.pacdb = pacdb;
    }

    public start() {
        // don"t use import-as-syntax, because default imports in TypeScript are a mess.
        const app = require("express")();
        app.set("port", process.env.PORT || 3000);
        app.use(express.static(STATIC_PATH));

        const http = require("http").Server(app);
        const io = require("socket.io")(http);

        http.listen(3000, () => console.log("listening on *:3000"));
        io.on("connection", this.initSocket.bind(this));
    }

    private async sendMap(socket: socketio.Socket) {
        console.log("requested map");
        const size = await this.pacdb.environment.getMapDimensions();
        const shape = await this.pacdb.environment.getWallShapes();
        const contents = await this.pacdb.environment.getCellContents();
        await socket.emit("map", {size: size, walls: shape, contents: contents});
    }

    public async initSocket(socket: socketio.Socket): Promise<void> {
        console.log(`user ${socket.id} connected`);

        // create player
        const playerId = await this.pacdb.environment.createPlayer({controller: socket.id});
        // fixme: network component in DB


        // bindings
        socket.on("disconnect", async reason => {
            console.log(`disconnecting user ${socket.id}: ${reason}`);
            const eid = await this.pacdb.environment.destroyPlayer(socket.id);
            delete this.clients[socket.id];
            console.log(eid);
            this.broadcast("destroy-entity", {id: eid});
        });

        socket.on("move", data => {
            const x = data.x === 0 ? 0 : data.x / Math.abs(data.x); // no speed hacks! >:(
            const y = data.y === 0 ? 0 : data.y / Math.abs(data.y);
            this.pacdb.environment.setPlayerMovement(this.clients[socket.id].entityId, x, y);
        });

        socket.on("get-map", async () => this.sendMap(socket));

        socket.emit("self", {id: playerId});
        await this.sendMap(socket);
        socket.emit("entities", await this.pacdb.environment.getEntities());

        // add to clients lastly to avoid overrunning the client with events before it is set up properly
        this.clients[socket.id] = {socket: socket, entityId: playerId};
    }

    public broadcast(type: string, message: any) {
        for(const [socketid, client] of Object.entries(this.clients)) {
            client.socket.emit(type, message);
        }
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