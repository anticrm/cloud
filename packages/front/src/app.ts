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

import Application from 'koa'
import KoaRouter from 'koa-router'
import bodyParser from 'koa-bodyparser'
import passport from 'koa-passport'

import { Strategy as LocalStrategy } from 'passport-local'
import {
  Strategy as JwtStrategy,
  ExtractJwt
} from 'passport-jwt'

import { sign } from 'jsonwebtoken'
import { Db } from 'mongodb'

import { CoreModel, CoreError } from '@antierp/platform-core'
import { login, JustAccount } from './account'

function createLocalStrategy (db: Db): LocalStrategy {
  return new LocalStrategy(
    (
      username: string, password: string,
      done: (error?: Error, account?: JustAccount) => void
    ) => {
      login(db, username, password).then(
        account => done(undefined, account)
      ).catch(
        error => done(error, undefined)
      )
    }
  )
}

export interface JwtPayload { email: string }

function createJwtStrategy (db: Db, jwtSecret: string): JwtStrategy {
  return new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret
    },
    (
      payload: JwtPayload,
      done: (error?: Error, payload?: JwtPayload) => void
    ) => {
      done(undefined, payload)
    }
  )
}

const unauthorized = { status: 401, body: 'Unauthorized.' }
const forbidden = { status: 403, body: 'Forbidden.' }
const internalError = { status: 500, body: 'Internal Server Error' }

interface Status {
  status: number
  body: string
}

export function httpStatus (error: Error): Status {
  if (error instanceof CoreError) {
    switch (error.status) {
      case CoreModel.status.Unauthorized: return unauthorized
      case CoreModel.status.Forbidden: return forbidden
      default: return internalError // unreachable
    }
  }
  return internalError // unreachable
}


export function createApp (db: Db, apiPrefix: string, jwtSecret: string): Application {
  const app = new Application()

  app.use(bodyParser())

  passport.use('local', createLocalStrategy(db))
  passport.use('jwt', createJwtStrategy(db, jwtSecret))
  app.use(passport.initialize())

  const router = new KoaRouter({ prefix: apiPrefix })
  router.post('/login', async (ctx, next) => {
    const auth = passport.authenticate('local',
      (error?: Error, account?: JustAccount) => {
        try {
          if (error != null) throw CoreError.make(error)
          if (!account) throw new CoreError(CoreModel.status.Unauthorized)
          else {
            if (account.disabled)
              throw new CoreError(CoreModel.status.Forbidden)
            const jwtPayload: JwtPayload = { email: account.email }
            ctx.status = 200
            ctx.body = sign(jwtPayload, jwtSecret)
          }
        } catch (error) {
          const status = httpStatus(error)
          ctx.status = status.status
          ctx.body = status.body
        }
      }
    )
    await auth(ctx, next)
  })
  router.post('/rpc', async (ctx, next) => {
    const auth = passport.authenticate('jwt', (error?: Error, payload?: JwtPayload) => {
      try {
        if (error != null) throw CoreError.make(error)
        if (!payload) throw new CoreError(CoreModel.status.Unauthorized)
        ctx.status = 200
      } catch (error) {
        const status = httpStatus(error)
        ctx.status = status.status
        ctx.body = status.body
      }
    })
    await auth(ctx, next)
  })

  app.use(router.routes())
  return app
}
