//import * as express from "express";
import * as socketio from "socket.io";
import * as path from "path";
import * as db from "./db/database";
import * as reader from "./util/datareader";
import * as ws from "./server/webserver";
import * as g from "./game";


class PacmanGame extends g.Game {
    private pacdb: db.PacmanDB;
    private webserver: ws.WebServer;

    public constructor(pacdb: db.PacmanDB, webserver: ws.WebServer) {
        super();
        this.pacdb = pacdb;
        this.webserver = webserver;
    }

    protected async update(delta: number) {
        this.pacdb.pathfinding.tickPathsearch();
        this.pacdb.dfa.tick();
        const clearedCells = await this.pacdb.environment.updatePositions();
        if(clearedCells.length > 0) {
            this.webserver.broadcast("removed-cell-contents", {contents: clearedCells.map(([cid, x, y]) => cid)});
        }
        this.webserver.broadcast("actors", await this.pacdb.environment.getActors());
    }
}



async function main() {
    const pacdb = await db.PacmanDB.create();
    await reader.readDFAs(pacdb, "./data/dfa/ghosts.gviz")
    await reader.readMap(pacdb, "./data/map.txt");
    await pacdb.environment.createGhost(1,1, "aggressive");

    const webserver = new ws.WebServer(pacdb);
    const game = new PacmanGame(pacdb, webserver);

    webserver.start();
    game.start();

}

async function test() {
    const pacdb = await db.PacmanDB.create();
    await reader.readDFAs(pacdb, "./data/dfa/ghosts.gviz")
    /*await pacdb.pathfinding.initSearch(1, [1,1], [4,4]);
    for(let i = 0; i < 10; i++) {
        const x = await pacdb.pathfinding.tickPathsearch();
        console.log(x);
    }*/
    /*
    const res = await pacdb.environment.get("SELECT * FROM dfa.edges");
    console.log("HERE GOES")
    console.log(res);
    console.log(await pacdb.environment.getSingleValue("SELECT * FROM dfa.edges"));
    */
}

main();
//test();

