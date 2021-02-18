//import * as express from "express";
import * as socketio from "socket.io";
import * as path from "path";
import * as db from "./db/database";
import * as reader from "./datareader";

// don"t use import-as-syntax, because default imports in TypeScript are a mess.
const express = require("express");


const app = express();
app.set("port", process.env.PORT || 3000);

var http = require("http").Server(app);

// simple "/" endpoint sending a Hello World
// response

let io = require("socket.io")(http);

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

async function main() {
    const daba = new db.PacmanDB();
    await daba.init();
    await daba.environment.setMap(`
xxxxxxxxxxx
x    x    x
x xx x xx x
x  x x x  x
xx       xx
xx xx xx xx
x         x
x x xxx x x
x         x
xxxxxxxxxxx
`);
    await daba.environment.createGhost(1,1);
    await daba.pathfinding.initSearch(1, [1,1], [4,4]);
    for(let i = 0; i < 10; i++) {
        const x = await daba.pathfinding.tickPathsearch();
        console.log(x);    
    }
    
}



async function test() {    
    const pacdb = new db.PacmanDB();
    await pacdb.init();
    reader.readDFAs(pacdb, "./data/dfa/ghosts.gviz")
}

//main();
test();

