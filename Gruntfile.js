// Compatibility entry point for existing integrations using `grunt default`.
module.exports = function (grunt) {
    grunt.registerTask('default', function () {
        var done = this.async();
        require('child_process').spawn(process.execPath, ['scripts/build.js'], {
            cwd: __dirname,
            stdio: 'inherit'
        }).on('error', function (error) {
            grunt.log.error(error);
            done(false);
        }).on('exit', function (code) {
            done(code === 0);
        });
    });
};
