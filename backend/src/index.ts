//import * as express from "express";
import * as socketio from "socket.io";
import * as path from "path";
import * as db from "./db/database";
import * as reader from "./util/datareader";
import * as ws from "./server/webserver";

const server = new ws.WebServer();

/*
// don"t use import-as-syntax, because default imports in TypeScript are a mess.
const express = require("express");


const app = express();
app.set("port", process.env.PORT || 3000);

const http = require("http").Server(app);
const io = require("socket.io")(http);

app.get("/", (req: any, res: any) => {
  res.sendFile(path.resolve("./index.html"));
});


const clients: {[key: number]: socketio.Socket}  = {};

io.on("connection", initSocket);

const server = http.listen(3000, function() {
  console.log("listening on *:3000");
});




function initSocket(socket: socketio.Socket) {
  console.log(`user ${socket.id} connected`);
  clients[socket.id] = socket;

  socket.on("disconnect", reason => {
    console.log(`disconnecting user ${socket.id}: ${reason}`);
    delete clients[socket.id];
  });

  socket.on("move", data => {
    console.log(data.eid);
  });

  socket.on("spawn", (data: SpawnData) => {
      //const eid = createEntity(data.type, data.x, data.y, data.ẟx, data.ẟy, data.speed);
  })    
}

interface SpawnData {
    readonly type: string;
    readonly x: number;
    readonly y: number;
    readonly ẟx: number;
    readonly ẟy: number;
    readonly speed: number;
}
*/

async function main() {
    const daba = await db.PacmanDB.create();
    await reader.readMap(daba, "./data/map.txt");
    await daba.environment.createGhost(1,1);
    await daba.pathfinding.initSearch(1, [1,1], [4,4]);
    for(let i = 0; i < 10; i++) {
        const x = await daba.pathfinding.tickPathsearch();
        console.log(x);    
    }    
}

async function test() {    
    const pacdb = await db.PacmanDB.create();
    await reader.readDFAs(pacdb, "./data/dfa/ghosts.gviz")
    /*
    const res = await pacdb.environment.get("SELECT * FROM dfa.edges");
    console.log("HERE GOES")
    console.log(res);
    console.log(await pacdb.environment.getSingleValue("SELECT * FROM dfa.edges"));
    */
}

//main();
test();

