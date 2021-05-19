export abstract class Game {
    private running: boolean;
    private tickDelay: number;
    private refreshIntervalId: NodeJS.Timeout | undefined;
    private lastTick: number | undefined; // FIXME: use.

    public isRunning(): boolean {
        return this.refreshIntervalId !== undefined;
    }

    public constructor(tickDelay: number = 33) { //targetFrames: number = 30) { // tickDelay: number = 33
        this.running = false;
        this.tickDelay = tickDelay; //1000 / targetFrames;
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

    private tick() {
        const now = Date.now();
        const delta = now - (this.lastTick ?? now);
        this.update(delta);
        this.lastTick = now;
    }

    protected abstract update(delta: number);
}
