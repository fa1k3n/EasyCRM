/* The program the build writes to server/dist/node.mjs: starts the local server (node.ts) with the command's arguments. */
import {main} from './node';

void main(process.argv.slice(2));
