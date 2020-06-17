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

export interface ClientService {
  find (_class: Ref<Class>, query: {}): Promise<Doc[]>
  load (domain: string): Promise<Doc[]>
  ping (): Promise<void>
}

export async function connect (uri: string, dbName: string): Promise<ClientService & { shutdown: () => Promise<void> }> {
  // console.log('connecting to ' + uri)
  console.log('use ' + dbName)
  const client = await MongoClient.connect(uri, { useUnifiedTopology: true })
  const db = client.db(dbName)
  const model: Doc[] = []
  const cursor = db.collection('model').find({})
  await cursor.forEach(doc => {
    model.push(doc)
  })
  cursor.close()
  const memdb = new MemDb()
  memdb.loadModel(model)

  return {
    find (_class: Ref<Class>, query: {}): Promise<Doc[]> {
      return memdb.find(_class, query)
    },

    async load (domain: string): Promise<Doc[]> {
      return memdb.dump()
    },

    async ping (): Promise<any> { return null },

    shutdown (): Promise<void> {
      return client.close()
    }
  }
}
