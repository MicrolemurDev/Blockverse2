const http = require('http');
const fs = require('fs');
const path = require('path');

// Server Config
const PORT = 80;
const DATA_PACK_LOCATION = './data/'; // Where is the game data?

const mimeTypes = {
  '.css': 'text/css',
  '.eot': 'application/vnd.ms-fontobject',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.jpg': 'image/jpg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.otf': 'application/font-otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'application/font-ttf',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.woff': 'application/font-woff',
}; // Known MIME Types

// Generate Contentpack Config
console.log('Generating Content Configuration...');
let folders =
  fs.readdirSync(DATA_PACK_LOCATION, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

const folders_ln = folders.length;
if (folders_ln === 0) {
  throw "FATAL! No data packs can load!";
} else {
  for (let i = 0; i < folders_ln; i++) {
    folders[i] = `data/${folders[i].concat('/meta.json')}`;
  }
}

const serverDataContent = {
  data_directories: folders,
}; // Server data stored on runtime as ./server/shared/packs.json

const parsedContent = JSON.stringify(serverDataContent);

try {
  fs.writeFileSync('./server/shared/packs.json', parsedContent);
} catch (e) {
  throw e;
} // Write file for packs.json

// HTTP Server
console.log('Starting HTML Server...')
http.createServer(function (request, response) {
  //console.log('requested ', request.url); // Uncomment to enable debug verbal requests

  let filePath = '.' + request.url;
  if (filePath == './') {
    filePath = './index.html';
  }

  let extname = String(path.extname(filePath)).toLowerCase();
  let contentType = mimeTypes[extname] || 'application/octet-stream';
  fs.readFile(filePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT') {
        fs.readFile('./server/404.html', function(error, content) {
          response.writeHead(404, { 'Content-Type': 'text/html' });
          response.end(content, 'utf-8');
        });
      } else {
        response.writeHead(500);
        response.end(`5XX Error: ${error}`);
      }
    } else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });
}).listen(PORT);

console.log(`Blockverse 2 Instance running at http://localhost:${PORT}`);