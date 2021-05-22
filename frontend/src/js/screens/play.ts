import me from "../me";
import { PacScreen } from "../screen";
import game from "../game";
import HUD from "../entities/HUD";

import * as fe from "../frontend";
import * as t from "../types";
import * as fp from "../functools";
import * as bs from "../main";
import * as U from "../util";

const DRAW_GRID = false;

enum Direction {
  None, // me.input.bindKey doesn't seem to like to be bound to the first enum value (= 0?), so here is a no-op.
  Up,
  Down,
  Left,
  Right
}

class PlayScreen extends PacScreen {
    private HUD: HUD | undefined;
    private playerId: number = 0;
    private pacman: fe.DBEntity | undefined;
    private entities: {[key: number]: any};
    private canvasSize: t.Dimensions;
    private blockSize: t.Dimensions;
    private map: any;
    private touchDirection: Direction;

    public constructor(canvasSize: t.Dimensions) {
        super();
        this.entities = {};
        this.canvasSize = canvasSize;
        this.blockSize = [0,0];
        this.touchDirection = Direction.None;
    }

    private hashCoordinate(x: number, y: number): string {
        return `${x}|${y}`; // hurrr
    }


    public onload() {
        console.log("loading...")
    }

    private doKeyBinds(): void {
        me.input.bindKey(me.input.KEY.W, Direction.Up);
        me.input.bindKey(me.input.KEY.S, Direction.Down);
        me.input.bindKey(me.input.KEY.A, Direction.Left);
        me.input.bindKey(me.input.KEY.D, Direction.Right);
    }

    private destroyEntity(eid: number) {
        console.log(`destroying ${eid}`);
        const e = this.entities[eid];
        if(e !== undefined) {
            me.game.world.removeChild(e);
            delete this.entities[eid];
        }
    }

    private processEntities(entities) {
        const [w, h] = this.blockSize;
        for(const e of entities) {
            if(!(e.entity_id in this.entities)) {
                let dbentity: fe.Pacman | fe.Ghost | fe.Pellet | null = null;
                if(e.type === "pacman") {
                    dbentity = new fe.Pacman(e.entity_id, [e.x * w, e.y * h], U.rgbToHex([e.red, e.green, e.blue]));
                } else if(e.type === "ghost") {
                    dbentity = new fe.Ghost(e.entity_id, [e.x * w, e.y * h], U.rgbToHex([e.red, e.green, e.blue]));
                } else if(e.type === "pellet") {
                    dbentity = new fe.Pellet([e.x * w + w/2, e.y * h + h/2], U.rgbToHex([e.red, e.green, e.blue])); //new fe.Pellet([e.x * w , e.y * h ], U.rgbToHex([e.red, e.green, e.blue]));
                } else {
                    console.error(`unknown entity type "${e.type}"`);
                }
                console.log(`adding ${e.type} at position (${e.x},${e.y})`);
                this.entities[e.entity_id] = dbentity;
                me.game.world.addChild(dbentity, e.z);
            } else {
                const dbentity = this.entities[e.entity_id];
                dbentity.setPosition(e.x * w, e.y * h);
            }
        }
        me.game.world.sort();
    }

    public async onResetEvent() {
        //me.audio.play("bgm");
        console.log("Show play screen");
        const that = this;

        bs.Bootstrap.getInstance().on("touch-up",   () => that.touchDirection = Direction.Up);
        bs.Bootstrap.getInstance().on("touch-down", () => that.touchDirection = Direction.Down);
        bs.Bootstrap.getInstance().on("touch-left", () => that.touchDirection = Direction.Left);
        bs.Bootstrap.getInstance().on("touch-right",() => that.touchDirection = Direction.Right);

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

        this.socket.on("entities", this.processEntities.bind(this));
        this.socket.on("entity-updates",   this.processEntities.bind(this));

        this.socket.on("removed-cell-contents", items => items.contents.map(eid => this.destroyEntity(eid)));

        this.socket.on("destroy-entity", entity => this.destroyEntity(entity.id));

        this.doKeyBinds();
    }

    public update(ms) {
        const res = super.update(ms);

        let x: number = 0;
        let y: number = 0;
        if (me.input.isKeyPressed(Direction.Left) || this.touchDirection == Direction.Left)  {
            x = -1;
        } else if (me.input.isKeyPressed(Direction.Right) || this.touchDirection == Direction.Right)  {
            x = 1;
        } else if (me.input.isKeyPressed(Direction.Up) || this.touchDirection == Direction.Up) {
            y = -1;
        } else if (me.input.isKeyPressed(Direction.Down) || this.touchDirection == Direction.Down)  {
            y = 1;
        }
        this.touchDirection = Direction.None;

        if(x != 0 || y != 0) {
            this.socket.emit("move", {x:x, y:y});
        }
        return res;
    }
}

export default PlayScreen;
