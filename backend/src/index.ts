//import * as express from "express";
import * as socketio from "socket.io";
import * as path from "path";
import * as db from "./db/database";
import * as reader from "./util/datareader";
import * as ws from "./server/webserver";
import * as g from "./game";

// this is basically just a type alias to shorten the constructor calls because I'm that kinda guy...
class gc extends g.GameComponent<PacmanGame> {
    constructor(n, g) { super(n,g); }
}

class PacmanGame extends g.Game {
    public readonly pacdb: db.PacmanDB;
    public readonly webserver: ws.WebServer;

    public constructor(pacdb: db.PacmanDB, webserver: ws.WebServer, tickDelay: number) {
        super(tickDelay);
        this.pacdb = pacdb;
        this.webserver = webserver;

        this.addComponent(new gc(20, async game => await game.pacdb.pathfinding.tickPathsearch()));
        this.addComponent(new gc(20, async game => await game.pacdb.dfa.tick()));
        this.addComponent(new gc(20, async game => {
            await game.pacdb.environment.updatePositions();
            await game.pacdb.environment.handleCollisions();
        }));
        this.addComponent(new gc(50, async game => {
            const updates = await game.pacdb.environment.getEntityDelta();
            if(updates.length > 0) {
                await game.pacdb.environment.checkpoint();
                await game.webserver.broadcast("entity-updates", updates);
            }
        }));
    }
}



async function main() {
    const pacdb = await db.PacmanDB.create();
    await reader.readDFAs(pacdb, "./data/dfa/ghosts.gviz")
    await reader.readMap(pacdb, "./data/map.txt");
    await pacdb.environment.createGhost(1,1, "wandering"); //"aggressive");

    const webserver = new ws.WebServer(pacdb);
    const game = new PacmanGame(pacdb, webserver, 50);

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

