var gulp = require('gulp'),
  del = require('del'),
  install = require('gulp-install');

gulp.task('clean', function (cb) {
  del(['static'], cb);
});

gulp.task('install', function () {
  return gulp.src('./package.json')
    .pipe(install());
});

gulp.task('build', ['clean', 'install'], function () {
  return gulp.src('content/**/*')
    .pipe(gulp.dest('static'));
});

gulp.task('default', ['build']);
