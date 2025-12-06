const ExpressError = require('../../../helper/ExpressError');

describe('ExpressError', () => {
  test('sets message and status', () => {
    const err = new ExpressError('Not Found', 404);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ExpressError);
    expect(err.message).toBe('Not Found');
    expect(err.status).toBe(404);
  });

  test('inherits stack and name', () => {
    const err = new ExpressError('Oops', 500);
    expect(err.name).toBe('Error');
    expect(typeof err.stack).toBe('string');
  });
});
