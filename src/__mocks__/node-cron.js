/**
 * node-cronのモック
 */

const mockJob = {
  stop: jest.fn(),
  destroy: jest.fn()
};

const schedule = jest.fn().mockImplementation((cronExpression, callback, options = { timezone: 'UTC' }) => {
  return mockJob;
});

module.exports = {
  schedule,
  mockJob
}; 