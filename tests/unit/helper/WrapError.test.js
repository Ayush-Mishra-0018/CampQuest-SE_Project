const WrapError = require('../../../helper/WrapError');

describe('WrapError', () => {
  const req = {};
  const res = {};

  test('calls next with error when promise rejects', async () => {
    const error = new Error('Boom');
    const next = jest.fn();

    const asyncHandler = jest.fn(() => Promise.reject(error));
    const wrapped = WrapError(asyncHandler);

    // Call wrapped and wait for microtask queue to flush
    await wrapped(req, res, next);

    expect(asyncHandler).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  test('does not call next when promise resolves', async () => {
    const next = jest.fn();
    const asyncHandler = jest.fn(() => Promise.resolve('ok'));
    const wrapped = WrapError(asyncHandler);

    await wrapped(req, res, next);

    expect(asyncHandler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});
