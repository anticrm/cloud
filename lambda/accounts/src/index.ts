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
import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyHandler, Context } from "aws-lambda"
import { getRequest, makeErrorResponse } from '@anticrm/rpc'

import methods from '@anticrm/accounts'

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
let client: MongoClient

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  context.callbackWaitsForEmptyEventLoop = false

  if (!event.body) {
    return {
      statusCode: 400,
      body: "Bad request, expecting RPC method call in POST body."
    }
  }

  const request = getRequest(event.body)
  const method = methods[request.method]

  if (!request.method) {
    return {
      statusCode: 200,
      body: makeErrorResponse(0, request.id, 'unknown method')
    }
  }

  if (!client) {
    client = await MongoClient.connect(dbUri)
  }
  const db = client.db('accounts')

  const result = await method(db, request)
  return {
    statusCode: 200,
    body: result
  }
}
