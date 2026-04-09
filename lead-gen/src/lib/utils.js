function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getLocalDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

module.exports = { randomBetween, delay, getLocalDateKey };
