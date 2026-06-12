const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    record_delimiter: ["\r\n", "\n"],
  });
}

function writeCsv(filePath, rows, headers) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = stringify(rows, {
    header: true,
    columns: headers,
  });
  fs.writeFileSync(filePath, content, 'utf8');
}

function appendCsv(filePath, row, headers) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const fileExists = fs.existsSync(filePath);
  const content = stringify([row], {
    header: !fileExists,
    columns: headers,
  });
  
  fs.appendFileSync(filePath, content, 'utf8');
}

function ensureCsvFile(filePath, headers) {
  if (!fs.existsSync(filePath)) {
    writeCsv(filePath, [], headers);
  }
}

module.exports = {
  readCsv,
  writeCsv,
  appendCsv,
  ensureCsvFile,
};
