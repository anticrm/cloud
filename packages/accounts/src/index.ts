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
import { makeErrorResponse, makeDataResponse, Request } from '@anticrm/rpc'
import { randomBytes, pbkdf2Sync } from 'crypto'
import { Buffer } from 'buffer'
import { encode } from 'jwt-simple'

const server = '3.12.129.141'
const secret = 'secret'

interface Account {
  email: string
  hash: Binary
  salt: Binary
  accounts: string[]
  disabled?: boolean
}

function hashWithSalt (password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, 1000, 32, 'sha256')
}

function verifyPassword (password: string, hash: Buffer, salt: Buffer): boolean {
  return Buffer.compare(hash, hashWithSalt(password, salt)) === 0
}

async function login (db: Db, request: Request<[string, string]>): Promise<string> {
  const [email, password] = request.params

  const account = await db.collection('account').findOne<Account>({ email })
  if (!account || !verifyPassword(password, account.hash.buffer, account.salt.buffer)) {
    return makeErrorResponse(0, request.id, 'Account not found or incorrect password')
  }

  const result = account.accounts.map(account => ({
    account,
    server,
    token: encode({ email, account }, secret)
  }))

  return makeDataResponse(result, request.id)
}

async function createAccount (db: Db, request: Request<[string, string, string]>): Promise<string> {
  const [email, password, account] = request.params

  const salt = randomBytes(32)
  const hash = hashWithSalt(password, salt)

  try {
    await db.collection('account').insertOne({
      email,
      hash,
      salt,
      accounts: [account]
    })

    return makeDataResponse('OK', request.id)
  } catch (err) {
    return makeErrorResponse(0, request.id, err.toString())
  }
}

const methods: { [key: string]: (db: Db, request: Request<any>) => Promise<string> } = {
  login,
  createAccount
}

export default methods
