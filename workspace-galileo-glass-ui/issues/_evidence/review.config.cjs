module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/review-*.test.tsx'],
  transform: {'^.+\\.(ts|tsx)$': ['babel-jest', {presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript']}]},
};
