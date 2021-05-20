//import * as express from "express";
import * as socketio from "socket.io";
import * as path from "path";
import * as db from "./db/database";
import * as reader from "./util/datareader";
import * as ws from "./server/webserver";
import * as g from "./game";


let ghostid = 0;

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
        this.pacdb.environment.updatePositions();
        this.webserver.broadcast("entities", await this.pacdb.environment.getEntities());
    }
}



async function main() {
    const pacdb = await db.PacmanDB.create();
    await reader.readDFAs(pacdb, "./data/dfa/ghosts.gviz")
    await reader.readMap(pacdb, "./data/map.txt");
    ghostid = await pacdb.environment.createGhost(1,1, "aggressive");
    /*await pacdb.environment.exec(`insert into dfa.entity_states(entity_id, dfa_id, state_id) (values
        (1,
        (select dfa_id from dfa.edges where current_state = (select id from dfa.states where name='turning') limit 1),
        (select id from dfa.states where name='turning')))`);
*/
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

