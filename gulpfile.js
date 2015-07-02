var gulp = require('gulp'),
  del = require('del');

gulp.task('clean', function (cb) {
  del(['build'], cb);
});

gulp.task('build', ['clean'], function () {
  return gulp.src('src/**/*')
    .pipe(gulp.dest('build'));
});

gulp.task('default', ['build']);
