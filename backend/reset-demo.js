const fs = require('fs');
const path = require('path');
const usersFile = path.join(__dirname, 'users.json');
const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
const filtered = users.filter(u => u.email !== 'developer@shopdeck.dev');
fs.writeFileSync(usersFile, JSON.stringify(filtered, null, 2));
console.log('Developer user removed. Remaining users:', filtered.length);
