import { assert } from 'superstruct';
import { TypedEventEmitter } from '@8128-33550336/typedeventemitter';
import { apidown, apidownValidator, apiup } from './serverapi';
import { serverhost } from "./env.json";

const signalingServer = `wss://${serverhost}/`;

export class WebsocketWraper extends TypedEventEmitter<{
    message: [value: apidown];
    open: [];
    error: [error: Error];
    close: [];
}> {
    #websocket: WebSocket;
    constructor(client: WebSocket) {
        super();
        this.#websocket = client;

        this.#websocket.addEventListener('message', event => {
            try {
                const message = '' + event.data;
                if (message === 'ping') {
                    this.#websocket.send('pong');
                    return;
                }
                const json = JSON.parse(message);
                assert(json, apidownValidator);
                this.emit('message', json);
            } catch (e) {
                this.emit('error', new Error('parse error', {
                    cause: e
                }));
            }
        });

        this.#websocket.addEventListener('open', () => {
            this.emit('open');
        });

        this.#websocket.addEventListener('close', () => {
            this.emit('close');
        });
    }
    send<T extends apiup['type']>(type: T, payload: (apiup & { type: T; })['data']) {
        this.#websocket.send(JSON.stringify({
            type,
            data: payload
        }));
    }
    static createFromId(id?: string, options?: { apiserver?: string; }) {
        return new WebsocketWraper(new WebSocket(options?.apiserver ?? serverhost + id ?? ''));
    }
}


