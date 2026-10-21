const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({
    testDir: './tests',
    testMatch: 'browser.spec.js',
    timeout: 30000,
    use: {baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure'},
    projects: [
        {name: 'chromium', use: {browserName: 'chromium'}, metadata: {bundle: 'dist'}},
        {name: 'webkit-min', use: {browserName: 'webkit'}, metadata: {bundle: 'dist-min'}}
    ],
    webServer: {command: 'node tests/test-server.js', port: 4173, reuseExistingServer: !process.env.CI, timeout: 10000}
});
