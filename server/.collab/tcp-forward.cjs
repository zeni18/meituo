const net=require('node:net');
const [host,remoteText,localText]=process.argv.slice(2);
const remote=Number(remoteText),local=Number(localText);
if(!host || ![remote,local].every(n=>Number.isInteger(n)&&n>1024&&n<65536)) throw Error('Usage: node tcp-forward.cjs HOST REMOTE_PORT LOCAL_PORT');
const sockets=new Set();
const server=net.createServer(client=>{
  const upstream=net.connect({host,port:remote});
  sockets.add(client);sockets.add(upstream);
  client.pipe(upstream);upstream.pipe(client);
  client.on('error',()=>upstream.destroy());
  upstream.on('error',err=>{console.error('Peer connection failed: '+err.code);client.destroy();});
  client.on('close',()=>{sockets.delete(client);upstream.destroy();});
  upstream.on('close',()=>{sockets.delete(upstream);client.destroy();});
});
server.on('error',err=>{console.error(err.message);process.exitCode=1;});
server.listen(local,'127.0.0.1',()=>console.log(`Listening only on localhost:${local}`));
process.on('SIGINT',()=>{for(const socket of sockets)socket.destroy();server.close();});
