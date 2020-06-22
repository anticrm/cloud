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

import { Binary } from 'bson'
import { Db } from 'mongodb'

import { randomBytes, pbkdf2Sync } from 'crypto'
import { Buffer } from 'buffer'

export class AccountInfo {
  name: string

  constructor(name: string) {
    this.name = name
  }
}

class Account {
  email: string
  hash: Binary
  salt: Binary
  disabled?: boolean
  info: AccountInfo

  constructor(email: string, hash: Binary, salt: Binary, info: AccountInfo) {
    this.email = email
    this.hash = hash,
      this.salt = salt
    this.info = info
  }
}

export type JustAccount = Omit<Account, 'info'>

/////////////

class HashAndSalt {
  hash: Buffer
  salt: Buffer

  constructor(hash: Buffer, salt: Buffer) {
    this.hash = hash
    this.salt = salt
  }
}

function pbkdf2 (password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, 1000, 32, 'sha256')
}

async function encodePassword (password: string): Promise<HashAndSalt> {
  const salt = randomBytes(32)
  return new HashAndSalt(pbkdf2(password, salt), salt)
}

async function verifyPassword (password: string, hashAndSalt: HashAndSalt): Promise<boolean> {
  return Buffer.compare(hashAndSalt.hash, pbkdf2(password, hashAndSalt.salt)) === 0
}

const accounts = 'accounts'

//////////////

export function setupIndexes (db: Db): Promise<string> {
  return db.collection(accounts).createIndex({ email: 1 }, { unique: true })
}

//////////////

export async function createAccount (db: Db, email: string, password: string, info: AccountInfo): Promise<void> {
  const hashAndSalt = await encodePassword(password)
  const account = new Account(
    email,
    new Binary(hashAndSalt.hash),
    new Binary(hashAndSalt.salt),
    info
  )
  await db.collection(accounts).insertOne(account)
}

export async function findAccount (db: Db, email: string): Promise<JustAccount> {
  const account = await db.collection(accounts).findOne(
    { email: email },
    { projection: { info: false } }
  )
  if (account !== null) {
    return account
  }
  throw new CoreError(CoreModel.status.Unauthorized)
}

export async function login (db: Db, email: string, password: string): Promise<JustAccount> {
  const account = await findAccount(db, email)
  const hashAndSalt = new HashAndSalt(account.hash.buffer, account.salt.buffer)
  if (await verifyPassword(password, hashAndSalt)) {
    return account
  }
  throw new CoreError(CoreModel.status.Unauthorized)
}

export async function disable (db: Db, email: string): Promise<void> {
  await db.collection(accounts).updateOne({ email: email }, { $set: { disabled: true } })
}

export async function enable (db: Db, email: string): Promise<void> {
  await db.collection(accounts).updateOne({ email: email }, { $set: { disabled: false } })
}
