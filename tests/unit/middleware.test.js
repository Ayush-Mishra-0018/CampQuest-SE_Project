const { isLogin, storeReturnTo, hasPermission, canUpdateReview } = require('../../middleware');


const createMockReq = (overrides = {}) => ({
  isAuthenticated: jest.fn().mockReturnValue(false),
  session: {},
  flash: jest.fn(),
  params: {},
  user: { _id: { equals: jest.fn().mockReturnValue(false) } },
  originalUrl: '/protected',
  ...overrides,
});

const createMockRes = () => ({
  redirect: jest.fn(),
  locals: {},
});

const createNext = () => jest.fn();


jest.mock('../../Models/Background', () => ({
  findById: jest.fn(),
}));

jest.mock('../../Models/review', () => ({
  findById: jest.fn(),
}));

const Background = require('../../Models/Background');
const Review = require('../../Models/review');

describe('middleware.isLogin', () => {
  test('redirects to /login and flashes error when not authenticated', async () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = createNext();

    await isLogin(req, res, next);

    expect(req.session.returnTo).toBe('/protected');
    expect(req.flash).toHaveBeenCalledWith('error', 'You Need To Be SignedIn');
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when user is authenticated', async () => {
    const req = createMockReq({ isAuthenticated: jest.fn().mockReturnValue(true) });
    const res = createMockRes();
    const next = createNext();

    await isLogin(req, res, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe('middleware.storeReturnTo', () => {
  test('copies session.returnTo to res.locals.returnTo', () => {
    const req = createMockReq({ session: { returnTo: '/campgrounds' } });
    const res = createMockRes();
    const next = createNext();

    storeReturnTo(req, res, next);

    expect(res.locals.returnTo).toBe('/campgrounds');
    expect(next).toHaveBeenCalled();
  });

  test('does nothing when session.returnTo is not set', () => {
    const req = createMockReq({ session: {} });
    const res = createMockRes();
    const next = createNext();

    storeReturnTo(req, res, next);

    expect(res.locals.returnTo).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

describe('middleware.hasPermission', () => {
  test('redirects when current user is not campground author', async () => {
    const reqUserId = { equals: jest.fn().mockReturnValue(false) };
    const req = createMockReq({
      params: { id: '123' },
      user: { _id: reqUserId },
    });
    const res = createMockRes();
    const next = createNext();

    Background.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        author: { _id: { equals: jest.fn().mockReturnValue(false) } },
      }),
    });

    await hasPermission(req, res, next);

    expect(req.flash).toHaveBeenCalledWith('error', 'You are not the author');
    expect(res.redirect).toHaveBeenCalledWith('/campgrounds');
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when current user is campground author', async () => {
    const authorId = { equals: jest.fn().mockReturnValue(true) };
    const req = createMockReq({
      params: { id: '123' },
      user: { _id: authorId },
    });
    const res = createMockRes();
    const next = createNext();

    Background.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({ author: { _id: authorId } }),
    });

    await hasPermission(req, res, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe('middleware.canUpdateReview', () => {
  test('redirects when current user is not review owner', async () => {
    const req = createMockReq({
      params: { id: 'campId', revid: 'revId' },
      user: { _id: { equals: jest.fn().mockReturnValue(false) } },
    });
    const res = createMockRes();
    const next = createNext();

    Review.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        owner: { _id: { equals: jest.fn().mockReturnValue(false) } },
      }),
    });

    await canUpdateReview(req, res, next);

    expect(req.flash).toHaveBeenCalledWith('error', 'You are not the author');
    expect(res.redirect).toHaveBeenCalledWith('/campgrounds/campId');
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when current user is review owner', async () => {
    const ownerId = { equals: jest.fn().mockReturnValue(true) };
    const req = createMockReq({
      params: { id: 'campId', revid: 'revId' },
      user: { _id: ownerId },
    });
    const res = createMockRes();
    const next = createNext();

    Review.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({ owner: { _id: ownerId } }),
    });

    await canUpdateReview(req, res, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
