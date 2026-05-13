import axios, {AxiosError, AxiosInstance} from 'axios'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const REQUEST_TIMEOUT_MS = 30000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createHttpClient(baseURL: string): AxiosInstance {
  const client = axios.create({baseURL, timeout: REQUEST_TIMEOUT_MS})

  client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as any
    if (!config) return Promise.reject(error)

    config.__retryCount = config.__retryCount || 0

    const isRetryable =
      !error.response || error.response.status >= 500 || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'

    if (!isRetryable || config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error)
    }

    config.__retryCount++
    const backoff = BASE_DELAY_MS * Math.pow(2, config.__retryCount - 1)
    console.log(`Retrying request ${config.method?.toUpperCase()} ${config.url} (attempt ${config.__retryCount}/${MAX_RETRIES})`)
    await delay(backoff)

    return client.request(config)
  })

  return client
}
