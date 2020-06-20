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

import { Ref, Class, Doc } from './types'
import { MemDb } from './memdb'

import WebSocket from 'ws'
import { makeResponse, Response } from './rpc'
import { PlatformServer } from './server'

interface CommitInfo {
  created: Doc[]
}

export interface ClientService {
  find (_class: Ref<Class>, query: {}): Promise<Doc[]>
  commit (commitInfo: CommitInfo): Promise<CommitInfo>
  load (domain: string): Promise<Doc[]>
  ping (): Promise<void>
}

export interface ClientControl {
  send (response: Response<unknown>): void
  shutdown (): Promise<void>
}

export async function connect (uri: string, dbName: string, ws: WebSocket, server: PlatformServer): Promise<ClientService & ClientControl> {
  console.log('connecting to ' + uri.substring(25))
  console.log('use ' + dbName)
  const client = await MongoClient.connect(uri, { useUnifiedTopology: true })
  const db = client.db(dbName)
  const model: Doc[] = []
  const cursor = db.collection('model').find({})
  await cursor.forEach(doc => {
    model.push(doc)
  })
  cursor.close()
  console.log('model:')
  console.log(model)
  const memdb = new MemDb()
  memdb.loadModel(model)

  const clientControl = {
    find (_class: Ref<Class>, query: {}): Promise<Doc[]> {
      return memdb.find(_class, query)
    },

    async commit (commitInfo: CommitInfo): Promise<CommitInfo> {
      for (const doc of commitInfo.created) {
        memdb.add(doc)
      }
      server.broadcast(clientControl, { result: commitInfo })
      return commitInfo
    },

    async load (domain: string): Promise<Doc[]> {
      return memdb.dump()
    },

    async ping (): Promise<any> { return null },

    // C O N T R O L

    send<R> (response: Response<R>): void {
      ws.send(makeResponse(response))
    },

    shutdown (): Promise<void> {
      return client.close()
    }
  }

  return clientControl
}
