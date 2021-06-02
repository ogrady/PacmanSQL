export abstract class Game {
    private running: boolean;
    private tickDelay: number;
    private refreshIntervalId: NodeJS.Timeout | undefined;
    private lastTick: number | undefined; // FIXME: use.
    private busy: boolean;
    private components: GameComponent<any>[];

    public isRunning(): boolean {
        return this.refreshIntervalId !== undefined;
    }

    public constructor(tickDelay: number = 33) { //targetFrames: number = 30) { // tickDelay: number = 33
        this.running = false;
        this.busy = false;
        this.tickDelay = tickDelay; //1000 / targetFrames;
        this.components = [] as GameComponent<any>[];
    }

    public addComponent(comp: GameComponent<any>) {
        this.components.push(comp);
    }

    public stop() {
        if(this.isRunning()) {
            clearInterval(this.refreshIntervalId as NodeJS.Timeout);
            this.refreshIntervalId = undefined;
        }
    }

    public start() {
        if(!this.isRunning()) {
            this.refreshIntervalId = setInterval(this.tick.bind(this), this.tickDelay); // 33 milliseconds = ~ 30 frames per sec
        }
    }

    private async tick() {
        if(!this.busy) {
            this.busy = true;
            const now = Date.now();
            const delta = now - (this.lastTick ?? now);
            //await this.update(delta);
            for(const comp of this.components) {
                await comp.tick(delta, this);
            }
            this.lastTick = now;
            this.busy = false;
        }

    }

    //protected abstract update(delta: number);
}


export class GameComponent<G extends Game> {
    private delay: number;
    private idleFor: number;
    private callback: ((game: G) => void);

    public constructor(delay: number = 30, callback: ((game: G) => void)) {
        this.delay = delay;
        this.idleFor = 0;
        this.callback = callback;
    }

    public async tick(delta: number, game: G) {
        this.idleFor += delta;
        if(this.idleFor >= this.delay) {
            this.idleFor = this.idleFor % this.delay;
            await this.callback(game);
        }
    }
}