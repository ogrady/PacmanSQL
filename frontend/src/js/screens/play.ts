import me from "../me";
import { PacScreen } from "../screen";
import game from "../game";
import HUD from "../entities/HUD";

import * as fe from "../frontend";
import * as t from "../types";
import * as fp from "../functools";

const DRAW_GRID = false;

enum Direction {
  None, // me.input.bindKey doesn't seem to like to be bound to the first enum value (= 0?), so here is a no-op.
  Up,
  Down,
  Left,
  Right
}

/*
  var socket = io();

  var form = document.getElementById("form");
  var input = document.getElementById("input");

  socket.emit("move", {eid: 1, x: 1, y: 0});
*/


class PlayScreen extends PacScreen {
    private HUD: HUD | undefined;
    private playerId: number = 0;
    private pacman: fe.DBEntity | undefined;
    private entities: {[key: number]: any};
    private pellets: {[key: string]: any};
    private canvasSize: t.Dimensions;
    private blockSize: t.Dimensions;
    private map: any;

    public constructor(canvasSize: t.Dimensions) {
        super();
        this.entities = {};
        this.pellets = {};
        this.canvasSize = canvasSize;
        this.blockSize = [0,0];
    }

    private hashCoordinate(x: number, y: number): string {
        return `${x}|${y}`; // hurrr
    }

    onload() {
        console.log("loading...")
    }

    private doKeyBinds(): void {
        me.input.bindKey(me.input.KEY.W, Direction.Up);
        me.input.bindKey(me.input.KEY.S, Direction.Down);
        me.input.bindKey(me.input.KEY.A, Direction.Left);
        me.input.bindKey(me.input.KEY.D, Direction.Right);
    }


    public async onResetEvent() {
        //me.audio.play("bgm");
        console.log("Show play screen");

        this.socket.on("map", map => {
            this.blockSize = [Math.round(this.canvasSize[0] / map.size.width), Math.round(this.canvasSize[1] / map.size.height)];
            const [w, h] = this.blockSize;

            // GRID
            if(DRAW_GRID) {
                for(let i = 0; i < this.canvasSize[0] / w; i++) {
                    for(let j = 0; j < this.canvasSize[1] / h; j++) {
                        const [sx, sy] = [i * w, j * h];
                        me.game.world.addChild(new fe.Wall([[sx,sy], [sx+w,sy], [sx+w,sy+h], [sx,sy+h], [sx,sy]  ], "#3d3d3d", 10,1));
                    }
                }
            }

            map.walls.map(wall => me.game.world.addChild(new fe.Wall(wall.coordinates.map(([x,y]) => [x * w, y * h]))));

        });

        this.socket.on("self", entity => {
            console.log("received self");
            console.log(entity);
        });

        this.socket.on("spawn", entity => {
            console.log("spawned", entity);
        });

        this.socket.on("entities", entities => {
            const [w, h] = this.blockSize;
            for(const e of entities) {
                if(!(e.entity_id in this.entities)) {
                    const dbentity = e.type === "pacman" ? new fe.Pacman(e.entity_id, [e.x * w, e.y * h]) : new fe.Ghost(e.entity_id, [e.x * w, e.y * h], "#0000ff");
                    this.entities[e.entity_id] = dbentity;
                    me.game.world.addChild(dbentity);
                } else {
                    const dbentity = this.entities[e.entity_id];
                    dbentity.setPosition(e.x * w, e.y * h);
                }
            }
        });

        await this.socket.emit("map");
        this.doKeyBinds();
    }

    public update(ms) {
        const res = super.update(ms);

        let x: number = 0;
        let y: number = 0;
        if (me.input.isKeyPressed(Direction.Left))  {
            x = -1;
        } else if (me.input.isKeyPressed(Direction.Right))  {
            x = 1;
        } else if (me.input.isKeyPressed(Direction.Up)) {
            y = -1;
        } else if (me.input.isKeyPressed(Direction.Down))  {
            y = 1;
        }

        if(x != 0 || y != 0) {
            this.socket.emit("move", {x:x, y:y});
        }
        return res;
    }
}

export default PlayScreen;