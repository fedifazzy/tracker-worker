import axios, {AxiosInstance} from 'axios'

type RpcResponse = {
  result: string
  arguments?: Record<string, any>
}

const REQUEST_TIMEOUT_MS = 15000

export class TransmissionRPC {
  private sessionId = ''
  private readonly client: AxiosInstance

  constructor(baseUrl: string) {
    this.client = axios.create({baseURL: baseUrl, timeout: REQUEST_TIMEOUT_MS})
  }

  async request(method: string, args: Record<string, any> = {}): Promise<RpcResponse> {
    try {
      const {data} = await this.client.post<RpcResponse>('', {method, arguments: args}, {
        headers: {'X-Transmission-Session-Id': this.sessionId},
      })
      return data
    } catch (error: any) {
      if (error.response?.status === 409) {
        this.sessionId = error.response.headers['x-transmission-session-id'] ?? ''
        return this.request(method, args)
      }
      throw error
    }
  }
}

export const transmissionRpc = new TransmissionRPC('http://localhost:9091/torrent/rpc')
