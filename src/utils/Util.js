const fetch = require("node-fetch");
const fs = require("fs");

function space(str, size) {
  str = String(str);
  while (str.length < size) {
    str += " ";
  }
  return str;
}

function saveNote(noteId, data) {
  return fetch("https://misr.xyz/api/note/" + noteId, {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9,la;q=0.8,ja;q=0.7",
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: "content=" + data,
    method: "POST"
  });
}

function fetchGet(url) {
  return fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*"
    }
  }).then(res => res.json());
}

function fileIsExists(path) {
  try {
    if (fs.existsSync(path)) {
      return true;
    } else {
      return false;
    }
  } catch(err) {
    return false;
  }
  return false;
}
module.exports = {
  space,
  saveNote,
  fetchGet,
  fileIsExists
};
