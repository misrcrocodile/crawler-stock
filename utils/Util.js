function space(str, size) {
    str = String(str);
    while (str.length < size) {
        str += " "
    }
    return str;
}

module.exports = {
    space
}