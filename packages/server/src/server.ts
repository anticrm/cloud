//
// Copyright © 2020 Anticrm Platform Contributors.
// 
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { makeResponse, getRequest, Response } from './rpc'
import { createServer, IncomingMessage } from 'http'
import WebSocket, { Server } from 'ws'

import { decode } from 'jwt-simple'
import { connect, ClientControl } from './service'

export interface Client {
  tenant: string
}

interface Service {
  [key: string]: (...args: any[]) => Promise<any>
}

type ClientService = Service & ClientControl

export interface PlatformServer {
  broadcast<R> (from: ClientControl, response: Response<R>): void
}

export function start (port: number, dbUri: string) {

  console.log('starting server on port ' + port + '...')

  const server = createServer()
  const wss = new Server({ noServer: true })

  const clients = new Map<string, Promise<ClientService>>()

  const platformServer: PlatformServer = {
    broadcast<R> (from: ClientControl, response: Response<R>) {
      for (const client of clients.values()) {
        client.then(client => {
          if (client !== from) {
            client.send(response)
          }
        })
      }
    }
  }

  function createClient (uri: string, tenant: string, ws: WebSocket): Promise<ClientService> {
    const service = new Promise<ClientService>((resolve, reject) => {
      connect(uri, tenant, ws, platformServer).then(service => { resolve(service as unknown as ClientService) }).catch(err => reject(err))
    })
    clients.set(tenant, service)
    return service
  }

  wss.on('connection', function connection (ws: WebSocket, request: any, client: Client) {
    ws.on('message', async (msg: string) => {
      const request = getRequest(msg)
      let service = clients.get(client.tenant)
      if (!service) {
        service = createClient(dbUri, client.tenant, ws)
      }
      const s = await service
      console.log('call method `' + request.method + '` on:')
      console.log(s)
      const f = s[request.method]
      const result = await f.apply(null, request.params ?? [])
      ws.send(makeResponse({
        id: request.id,
        result
      }))
    })
  })

  function auth (request: IncomingMessage, done: (err: Error | null, client: Client | null) => void) {
    const token = request.url?.substring(1) // remove leading '/'
    if (!token) {
      done(new Error('no authorization token'), null)
    } else {
      const payload = decode(token, 'secret', false)
      done(null, payload)
    }
  }

  server.on('upgrade', function upgrade (request: IncomingMessage, socket, head: Buffer) {
    auth(request, (err: Error | null, client: Client | null) => {
      if (!client) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      wss.handleUpgrade(request, socket, head, function done (ws) {
        wss.emit('connection', ws, request, client);
      })
    })
  })

  const httpServer = server.listen(port)

  console.log('server started.')

  return async function shutdown () {
    for (const client of clients) {
      (await client[1]).shutdown()
    }
    httpServer.close()
  }
}
