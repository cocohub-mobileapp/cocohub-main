const QRCode = {
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  toString: jest.fn().mockResolvedValue('<svg>mock</svg>'),
};
module.exports = QRCode;
