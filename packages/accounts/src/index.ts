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

import { Binary, Db } from 'mongodb'
import { Request, Response } from '@anticrm/rpc'
import { randomBytes, pbkdf2Sync } from 'crypto'
import { Buffer } from 'buffer'
import { encode } from 'jwt-simple'

const server = '3.12.129.141'
const port = '18080'
const secret = 'secret'

const WORKSPACE_COLLECTION = 'workspace'
const ACCOUNT_COLLECTION = 'account'

interface Account {
  email: string
  workspace: string
  hash: Binary
  salt: Binary
}

interface LoginInfo {
  workspace: string
  server: string
  port: string
  token: string
}

function hashWithSalt (password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, 1000, 32, 'sha256')
}

function verifyPassword (password: string, hash: Buffer, salt: Buffer): boolean {
  return Buffer.compare(hash, hashWithSalt(password, salt)) === 0
}

async function login (db: Db, request: Request<[string, string, string]>): Promise<Response<LoginInfo>> {
  const [email, password, workspace] = request.params

  const ws = await db.collection(WORKSPACE_COLLECTION).findOne({ workspace })
  if (!ws) {
    return {
      id: request.id, error: { code: 0, message: 'workspace not found' }
    }
  }

  const account = await db.collection(ACCOUNT_COLLECTION).findOne<Account>({ email, workspace: ws._id })
  if (!account || !verifyPassword(password, account.hash.buffer, account.salt.buffer)) {
    return { id: request.id, error: { code: 0, message: 'Account not found or incorrect password' } }
  }

  const result = {
    workspace,
    server,
    port,
    token: encode({ email, workspace }, secret)
  }

  return { result, id: request.id }
}

async function createAccount (db: Db, request: Request<[string, string, string]>): Promise<Response<boolean>> {
  const [email, password, workspace] = request.params

  const ws = await db.collection(WORKSPACE_COLLECTION).findOne({ workspace })
  if (!ws) {
    return {
      id: request.id, error: { code: 0, message: 'workspace not found' }
    }
  }

  const salt = randomBytes(32)
  const hash = hashWithSalt(password, salt)

  try {
    await db.collection(ACCOUNT_COLLECTION).insertOne({
      email,
      workspace: ws._id,
      hash,
      salt,
    })
    return { result: true, id: request.id }

  } catch (err) {
    return {
      id: request.id, error: { code: 0, message: err.toString() }
    }
  }
}

async function createWorkspace (db: Db, request: Request<[string, string, string]>): Promise<Response<string>> {
  const [email, password, organisation] = request.params

  const workspace = 'ws-' + randomBytes(8).toString('hex')

  try {
    await db.collection('workspace').insertOne({
      workspace,
      organisation
    })

    return { result: workspace, id: request.id }

  } catch (err) {
    return {
      id: request.id, error: { code: 0, message: err.toString() }
    }
  }
}

const methods: { [key: string]: (db: Db, request: Request<any>) => Promise<Response<any>> } = {
  login,
  createAccount,
  createWorkspace
}

export default methods
