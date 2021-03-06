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

import { MongoClient, Db } from 'mongodb'

import { Ref, Class, Doc } from '@anticrm/platform'
import { MemDb, Layout, AnyLayout } from '@anticrm/memdb'

import WebSocket from 'ws'
import { makeResponse, Response } from './rpc'
import { PlatformServer } from './server'

import { CoreProtocol } from '@anticrm/rpc'

interface CommitInfo {
  created: Doc[]
}

export interface ClientControl {
  ping (): Promise<void>
  send (response: Response<unknown>): void
  shutdown (): Promise<void>
}

export async function connect (uri: string, dbName: string, ws: WebSocket, server: PlatformServer): Promise<CoreProtocol & ClientControl> {
  console.log('connecting to ' + uri.substring(25))
  console.log('use ' + dbName)
  const client = await MongoClient.connect(uri, { useUnifiedTopology: true })
  const db = client.db(dbName)
  const model: Layout<Doc>[] = await db.collection('model').find({}).toArray()
  console.log('model:')
  console.log(model)
  const memdb = new MemDb()
  memdb.loadModel(model)

  const clientControl = {
    find (_class: Ref<Class<Doc>>, query: AnyLayout): Promise<Layout<Doc>[]> {
      const domain = memdb.getDomain(_class)
      return db.collection(domain).find({ ...query, _class }).toArray()
    },

    delete (_class: Ref<Class<Doc>>, query: AnyLayout): Promise<void> {
      console.log('DELETE', _class, query)
      const domain = memdb.getDomain(_class)
      return db.collection(domain).deleteMany({ ...query }).then(result => { })
    },

    async commit (commitInfo: CommitInfo): Promise<void> {
      // group by domain
      const byDomain = commitInfo.created.reduce((group: Map<string, Doc[]>, doc) => {
        const domain = memdb.getDomain(doc._class)
        let g = group.get(domain)
        if (!g) { group.set(domain, g = []) }
        g.push(doc)
        return group
      }, new Map())

      await Promise.all(Array.from(byDomain.entries()).map(domain => db.collection(domain[0]).insertMany(domain[1])))

      server.broadcast(clientControl, { result: commitInfo })
    },

    async load (): Promise<Layout<Doc>[]> {
      return memdb.dump()
    },

    async ping (): Promise<any> { return null },

    // C O N T R O L

    send<R> (response: Response<R>): void {
      ws.send(makeResponse(response))
    },

    // TODO rename to `close`
    shutdown (): Promise<void> {
      return client.close()
    },

    serverShutdown (password: string): Promise<void> {
      return server.shutdown(password)
    }

  }

  return clientControl
}
