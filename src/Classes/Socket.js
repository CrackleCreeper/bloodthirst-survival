// socket.js
import { io } from 'socket.io-client';
export const socket = io('http://localhost:3000', {
    transports: ['websocket']
});

export let multiplayer = false;

export function setMultiplayerMode(isMulti) {
    multiplayer = isMulti;
}

