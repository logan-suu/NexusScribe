import {defineConfig, devices} from '@playwright/test';

const offline = {NEXUS_LIVE_ENABLED:'false', NEXUS_OVERAGE_CONFIRMED_OFF:'false'};
const preview = port => ({
  command: `npm run preview -- --port ${port}`,
  url: `http://127.0.0.1:${port}`,
  reuseExistingServer:false,
  env:offline,
});

export default defineConfig({
  testDir:'./release-e2e',
  timeout:45000,
  forbidOnly:!!process.env.CI,
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
    {name:'mobile-chromium',use:devices['Pixel 7']},
  ],
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure',
    launchOptions:process.env.NEXUS_CHROMIUM_EXECUTABLE
      ? {executablePath:process.env.NEXUS_CHROMIUM_EXECUTABLE} : {},
  },
  outputDir:'test-results/compiled-recovery',
  webServer:[
    {command:'npm run server:built',url:'http://127.0.0.1:8787/api/status',reuseExistingServer:false,env:offline},
    preview(4173),
    preview(4174),
  ],
});
