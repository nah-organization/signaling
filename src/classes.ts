import { TypedEventEmitter } from "@8128-33550336/typedeventemitter";
import { WebsocketWraper } from "./websocket";

const tuple = <T extends unknown[]>(...args: T) => args;

export class User extends TypedEventEmitter<{
    leave: [];
}>{
    constructor(public readonly id: string, public readonly me: boolean) {
        super();
    }
}

export class UserList extends TypedEventEmitter<{
    joinUser: [user: User];
    leaveUser: [user: User];
}> {
    #usermap: Map<string, User>;
    #me: User;

    constructor(meId: string, userIds: string[]) {
        super();
        this.#usermap = new Map(
            userIds
                .filter(id => id !== meId)
                .map(userid => tuple(userid, new User(userid, false)))
        );
        this.#me = new User(meId, true);
        this.#usermap.set(meId, this.#me);
    }
    renewUsers<T extends UserList>(this: T, userIds: string[]): T {
        for (const newUserId of userIds) {
            if (!this.#usermap.has(newUserId)) {
                const newUser = new User(newUserId, false);
                this.#usermap.set(newUserId, newUser);
                this.emit('joinUser', newUser);
            }
        }
        for (const oldUser of this.#usermap.values()) {
            if (!userIds.includes(oldUser.id)) {
                this.#usermap.delete(oldUser.id);
                oldUser.emit('leave');
                this.emit('leaveUser', oldUser);
            }
        }
        return this;
    }
    getOrCreateUser(id: string): User {
        const user = this.#usermap.get(id);
        if (user) {
            return user;
        }
        const newUser = new User(id, false);
        this.#usermap.set(id, newUser);
        this.emit('joinUser', newUser);
        return newUser;
    }
    getUsers(): User[] {
        return [...this.#usermap.values()];
    }
    getMe(): User {
        return this.#me;
    }
}

export class Room extends TypedEventEmitter<{
    open: [page: string];
    message: [from: User, to: User[], message: string];
    joinUser: [user: User];
    leaveUser: [user: User];
    error: [error: Error];
    close: [];
}> {
    #websocketwrapper: WebsocketWraper;
    #state: { type: 'connecting' | 'close' | 'failed'; } | { type: 'open'; userlist: UserList; room: string; } = { type: 'connecting' };
    #userlist: UserList | undefined = undefined;
    #room: string | undefined;

    constructor(id?: string, options?: { apiserver?: string; WebSocketConstructor?: typeof WebSocket; }) {
        super();
        this.#websocketwrapper = WebsocketWraper.createFromId(id, options);

        this.#websocketwrapper.on('message', json => {
            switch (json.type) {
                case 'room': {
                    this.#room = json.data.id;
                    this.openIfPossible();
                    break;
                }
                case 'users': {
                    if (this.#userlist) {
                        this.#userlist.renewUsers(json.data.users);
                    } else {
                        this.#userlist = new UserList(json.data.me, json.data.users);
                        this.openIfPossible();

                        this.#userlist.on('joinUser', (user) => {
                            this.emit('joinUser', user);
                        });

                        this.#userlist.on('leaveUser', (user) => {
                            this.emit('leaveUser', user);
                        });
                    }
                    break;
                }
                case 'signal': {
                    if (this.#state.type !== 'open') {
                        return;
                    }
                    const getOrCreateUser = this.#state.userlist.getOrCreateUser.bind(this.#state.userlist);
                    this.emit('message', getOrCreateUser(json.data.sender), json.data.receivers.map(userid => getOrCreateUser(userid)), json.data.data);
                    break;
                }
                default: {
                    break;
                }
            }
        });

        this.#websocketwrapper.on('open', () => {
            this.#websocketwrapper.send('join', {});
        });

        this.#websocketwrapper.on('error', (error) => {
            this.#state = { type: 'failed' };
            this.emit('error', error);
        });

        this.#websocketwrapper.on('close', () => {
            this.#state = { type: 'close' };
            this.emit('close');
        });
    }
    getState() {
        return this.#state.type;
    }
    getPageId(): string {
        const { room } = this.getValueOrThrow();
        return room;
    }
    getUsers(): User[] {
        const { userlist } = this.getValueOrThrow();
        return userlist.getUsers();
    }
    getMe(): User {
        const { userlist } = this.getValueOrThrow();
        return userlist.getMe();
    }
    send(message: string, receivers?: User[]): void {
        this.getValueOrThrow();
        this.#websocketwrapper.send('signal', {
            receivers: (receivers ?? this.getUsers()).map(user => user.id),
            data: message
        });
    }
    close() {
        this.#websocketwrapper.close();
    }
    private openIfPossible() {
        if (!(this.#room && this.#userlist)) {
            return;
        }
        this.#state = { type: 'open', userlist: this.#userlist, room: this.#room };
        this.emit('open', this.#room);
    }
    private getValueOrThrow() {
        if (this.#state.type !== 'open') {
            throw new Error('can\'t send message because not yet open');
        }
        return this.#state;
    }
}
