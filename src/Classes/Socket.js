// socket.js
import { io } from 'socket.io-client';
export const socket = io(
    import.meta.env.DEV ? 'http://216.24.57.7:443' : undefined,
    { transports: ['websocket'] }
);

export let multiplayer = false;

export function setMultiplayerMode(isMulti) {
    multiplayer = isMulti;
}

