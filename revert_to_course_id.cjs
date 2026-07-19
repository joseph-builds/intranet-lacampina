const fs = require('fs');
const path = require('path');

function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(findFiles(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = findFiles('src');
let changed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Reverse modulo_id back to course_id
  content = content.replace(/modulo_id/g, 'course_id');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Reverted to course_id in:', file);
    changed++;
  }
});

console.log('Total files reverted:', changed);
