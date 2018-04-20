module.exports = function (config) {
  config.set({
    basePath: '..',
    frameworks: ['browserify', 'tap'],
    reporters: ['mocha'],
    mochaReporter: { output: 'minimal'},
    files: ['test/*.js'],
    preprocessors: { 'test/*.js': [ 'browserify' ] },
    browserify: {
      transform: [ 'babelify' ]
    },
    singleRun: true,
  });
};
