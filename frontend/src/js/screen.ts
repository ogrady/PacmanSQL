import me from "./me";
import io from 'socket.io-client';

export class PacScreen extends me.Stage {
	protected socket: io.Socket;

	public constructor() {
		super();
		this.socket = io.io("http://127.0.0.1:3000");
	}
}