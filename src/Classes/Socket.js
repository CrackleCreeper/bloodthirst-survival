// socket.js
import { io } from 'socket.io-client';
export const socket = io(
    import.meta.env.DEV ? 'http://0.0.0.0:10000' : undefined,
    { transports: ['websocket'] }
);

export let multiplayer = false;

export function setMultiplayerMode(isMulti) {
    multiplayer = isMulti;
}

