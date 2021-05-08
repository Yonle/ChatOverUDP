const readline = require("readline");
const dgram = require("dgram");
const cli = readline.createInterface(process.stdin, process.stdout);
const log = console.log;
const clear = console.clear;
let socket = null;
let server = null;
let locked = false;
let timeout = null;
let chat = {};
let acknowledged = false;
cli.on('line', async str => {
	if (!socket) return menu();
	await send(str);
	cli.prompt();
});
cli.on('close', () => {
	if (locked) {
		locked = false;
		if (socket) socket.unref();
		socket = null;
		return menu();
	}
	log("\nHave a nice day!");
	process.exit(0);
});
clear();
menu();

function menu () {
	if (socket) {
		socket.unref();
		try {
			socket.disconnect();
		} catch (error) {}
		socket = null;
	}
	clear();
	acknowledged = false;
	cli.resume();
	server = false;
	chat = {}
	log("ChatOverUDP V0.1")
	log("[0] Exit");
	log("[1] Connect");
	log("[2] Create Server");
	cli.question("Select: ", num => {
		switch (num) {
			case "1":
				createSocket(connectTo);
				break;
			case "2": 
				bind();
				break;
			default:
				log("\nHave a nice day!");
				process.exit(0);
				break;
		}
	});
}

function createSocket(fct) {
	clear();
	log("Socket Type");
	log("[0] Main Menu");
	log("[1] udp4 (Recommended for Beginner)");
	log("[2] udp6");
	cli.question("Select: ", num => {
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
	});
}

function connectTo(type) {
	clear();
	socket = new dgram.Socket(type);
	cli.question("Host (Empty to Menu): ", host => {
		if (!host.length) return menu();
		chat.address = host;
		cli.question ("Port (Empty to Menu): ", port => {
			if (!port.length) return menu();
			chat.port = port;
			clear();
			log("Waiting Server Acknowledge....");
			send("Ack");
			timeout = setTimeout(() => {
				log("Response Timed out. Back to Menu....");
				setTimeout(menu, 2000);
			}, 10000);
			listen();
		});
	});
}

function bind(type) {
	if (!type) return createSocket(bind);
	socket = new dgram.Socket(type);
	clear();
	cli.question("Port to Bind (Empty to Menu): ", port => {
		if (!port) return menu();
		socket.bind(Number(port), () => {
			log("Binded on Port", Number(port));
			log("Waiting for Incomming Message....");
			//cli.pause();
			locked = true;
			server = true;
			listen();
		});
	});
}

function listen() {
	if (!socket) return menu();
	socket.on('message', (c, remote) => {
		let msg = new Buffer.from(c, 'utf8');
		if (!chat.port && !chat.address && msg == "Ack") {
			chat.port = remote.port;
			chat.address = remote.address;
			send("Acknowledged");
			locked = false;
			console.log("Connected!");
			return cli.prompt();
		} else if (`${chat.address}:${chat.port}` !== `${remote.address}:${remote.port}`) {
			return socket.send("Rejected", 0, 8, remote.port, remote.address);
		}
		
		if (msg == "Acknowledged" && !acknowledged) {
			acknowledged = true;
			clearTimeout(timeout);
			log("Server Acknowledged. Marking as Connected.")
			return cli.prompt();
		} else if(msg == "Rejected" && !acknowledged) {
			clearTimeout(timeout);
			log("Server Rejected your Request.");
			log("\nServer rejected your request because the server is already connected with another client. Try again later.");
			cli.pause();
			return cli.question("Press ENTER to back to menu.", menu);
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
	console.error(error);
	log("-----> Will back to menu after 5 second....");
	setTimeout(menu, 3000);
});
