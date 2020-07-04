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

import { MongoClient } from 'mongodb'
import { Request } from '@anticrm/rpc'
import { createAccount, login, closeDb } from '..'

describe('server', () => {

  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017'

  beforeAll(async () => {
    const conn = await MongoClient.connect(dbUri)
    const db = conn.db('accounts')
    await db.dropDatabase()
    const newDb = conn.db('accounts')
    await newDb.collection('account').createIndex({ email: 1 }, { unique: true })
    await conn.close()
  })

  it('should create account', async () => {
    const request: Request<[string, string, string]> = {
      method: 'createAccount',
      params: ['andrey', '123', 'latest-model']
    }

    const result = await createAccount(request)
    expect(result).toBe('{"result":"OK"}')
  })

  it('should not create, duplicate account', async () => {
    const request: Request<[string, string, string]> = {
      method: 'createAccount',
      params: ['andrey', '123', 'latest-model']
    }

    const result = await createAccount(request)
    expect(result).toBe('{"error":{"code":0,"message":"MongoError: E11000 duplicate key error collection: accounts.account index: email_1 dup key: { email: \\"andrey\\" }"}}')
  })

  it('should login', async () => {
    const request: Request<[string, string]> = {
      method: 'login',
      params: ['andrey', '123']
    }

    const result = await login(request)
    expect(result).toBe('{"result":[{"account":"latest-model","server":"3.12.129.141","token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFuZHJleSIsImFjY291bnQiOiJsYXRlc3QtbW9kZWwifQ.z9sIz9Rgm04FlojiQLuNOs9VAnMkmVdJJdfWK5-dXE8"}]}')
  })

  it('should not login, wrong password', async () => {
    const request: Request<[string, string]> = {
      method: 'login',
      params: ['andrey', '123555']
    }

    const result = await login(request)
    expect(result).toBe('{"error":{"code":0,"message":"Account not found or incorrect password"}}')
  })

  it('should not login, unknown user', async () => {
    const request: Request<[string, string]> = {
      method: 'login',
      params: ['andrey1', '123555']
    }

    const result = await login(request)
    expect(result).toBe('{"error":{"code":0,"message":"Account not found or incorrect password"}}')
  })

  afterAll(async () => {
    await closeDb()
  })

})