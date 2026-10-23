export function removeFirstSlash(input) {
  if(input[0] === '/') return input.slice(1);
  return input;
};

export function splitAndTrim(contents, separator) {
  return contents.split(separator).map(entry => entry.trim());
};