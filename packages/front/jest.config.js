// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  coverageDirectory: "coverage",
  testEnvironment: "node",
  roots: [
    '<rootDir>/src'
  ],
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"]
}
