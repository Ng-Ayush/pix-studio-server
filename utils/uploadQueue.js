const PQueue = require('p-queue').default;

// Tune per worker
const uploadQueue = new PQueue({
  concurrency: 3,   // only 3 batches at once per worker
  intervalCap: 6,   // max 6 jobs
  interval: 1000,  // per second
  timeout: 10 * 60 * 1000,
  throwOnTimeout: true
});

module.exports = uploadQueue;