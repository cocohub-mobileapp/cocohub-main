const { PassThrough } = require('stream');

function archiver() {
  const stream = new PassThrough();
  stream.append = jest.fn().mockReturnThis();
  stream.finalize = jest.fn().mockImplementation(() => {
    stream.end();
    return Promise.resolve();
  });
  return stream;
}

module.exports = archiver;
