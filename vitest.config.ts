import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // config.ts validates at import time and every service module reaches it
    // through the singletons they export, so the required variables have to
    // exist before anything is loaded.
    env: {
      TRACKER_API_URL: 'http://127.0.0.1:1/test',
      TG_USERNAME: 'test',
    },
  },
})
