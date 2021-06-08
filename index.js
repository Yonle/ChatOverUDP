const readline = require("readline");
const dgram = require("dgram");
const cli = readline.createInterface(process.stdin, process.stdout);
const question = (q) => new Promise(res => cli.question(q, res));
const log = console.log;
const clear = console.clear;
let socket = null;
let server = null;
let chatting = false;
let timeout = null;
let chat = {};
let acknowledged = false;
cli.on('line', async str => {
	if (!socket) return menu();
	await send(str);
	cli.prompt();
});
cli.on('close', () => {
	if (chatting) {
		chatting = false;
		if (socket) socket.unref();
		socket = null;
		return menu();
	}
	log("\nHave a nice day!");
	process.exit(0);
});
clear();
menu();

async function menu () {
	if (socket) {
		socket.unref();
		try {
			socket.disconnect();
		} catch (error) {}
		socket = null;
		chatting = false;
	}
	clear();
	acknowledged = false;
	cli.resume();
	server = false;
	chat = {}
	log("ChatOverUDP V1")
	log("[0] Exit");
	log("[1] Connect");
	log("[2] Create Server");
	log("[3] Continue where i left off")
	let num = await question("Select: ");
	switch (num) {
		case "1":
			createSocket(connectTo);
			break;
		case "2":
			bind();
			break;
		case "3":
			continue_Where_I_Left_Off();
			break;
		default:
			log("\nHave a nice day!");
			process.exit(0);
			break;
	}
}

async function createSocket(fct) {
	clear();
	log("Socket Type");
	log("[0] Main Menu");
	log("[1] udp4 (Recommended for Beginner)");
	log("[2] udp6");
	let num = await question("Select: ");
	switch (num) {
		case "1":
			fct("udp4");
			break;
		case "2":
			fct("udp6");
			break;
		default:
			menu();
			break;
	}
}

async function connectTo(type) {
	if (!type && !socket) return createSocket(connectTo);
	clear();
	if (!socket) {
		socket = new dgram.Socket(type);
		socket.on('error', e => process.emit("unhandledRejection", e));
	}
	let host = await question("Host (Empty to Menu): ");
	if (!host.length) return menu();
	chat.address = host;
	let port = await question("Port (Empty to Menu): ");
	if (!port.length) return menu();
	chat.port = port;
	clear();
	log("Waiting Server Acknowledge....");
	chatting = true;
	send("ping");
	timeout = setTimeout(() => {
		log("Response Timed out. Back to Menu....");
		setTimeout(menu, 2000);
	}, 10000);
	listen();
}

async function bind(type) {
	if (!type) return createSocket(bind);
	socket = new dgram.Socket(type);
	socket.on('error', e => process.emit("unhandledRejection", e));
	clear();
	let port = await question("Port to Bind (Empty to Menu): ");
	if (!port) return menu();
	socket.bind(Number(port), () => {
		log("Binded on Port", Number(port));
		log("Waiting for Incomming Message....");
		//cli.pause();
		chatting = true;
		server = true;
		listen();
	});
}

async function continue_Where_I_Left_Off(type) {
	if (!type) return createSocket(continue_Where_I_Left_Off);
	clear();
	let address = await question("Enter your last IP address (Not Server IP): ")
	if (!address.length) return menu();
	let port = await question("Enter your last PORT (Not Server Port): ");
	if (!port.length) return menu();
	socket = new dgram.Socket(type);
	socket.on('error', e => process.emit("unhandledRejection", e));
	try {
		socket.bind(port, address);
		connectTo();
	} catch (error) {
		process.emit("unhandledRejection", error);
	}
}

function listen() {
	if (!socket) return menu();
	socket.on('message', async (c, remote) => {
		let msg = new Buffer.from(c, 'utf8');
		if (!chat.port && !chat.address && msg == "ping") {
			chat.port = remote.port;
			chat.address = remote.address;
			await send("pong");
			socket.me = socket.address();
			cli.setPrompt(`${socket.me.address}:${socket.me.port} (You): `);
			console.log("Connected!");
			return cli.prompt();
		}

		if (msg == "pong" && !acknowledged) {
			acknowledged = true;
			clearTimeout(timeout);
			log("Server Acknowledged. Marking as Connected.");
			socket.me = socket.address();
			cli.setPrompt(`${socket.me.address}:${socket.me.port} (You): `);
			return cli.prompt();
		}

		log(`\n${remote.address}:${remote.port}: ${msg}`);
		cli.prompt();
	});
}

function send(c) {
	let chunk = new Buffer.from(c, 'utf8');
	if (!socket) return menu();
	return new Promise((res, rej) => socket.send(chunk, 0, chunk.length, chat.port, chat.address, (err) => {
		if (err) return rej(err);
		res();
	}));
}

process.on('unhandledRejection', error => {
	if (timeout) clearTimeout(timeout);
	console.error(error);
	log("Will back to menu after 5 second....");
	setTimeout(menu, 3000);
});
